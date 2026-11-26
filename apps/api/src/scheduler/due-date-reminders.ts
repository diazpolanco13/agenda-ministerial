import {
  and,
  between,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import db from "../database";
import {
  agendaNtfySubscriptionTable,
  columnTable,
  projectTable,
  taskReminderSentTable,
  taskTable,
  userNotificationPreferenceTable,
  workspaceUserTable,
} from "../database/schema";
import {
  dispatchNotification,
  persistNotification,
} from "../notification/controllers/create-notification";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";
import {
  DUE_DATE_DURATION_MS,
  REMINDER_WINDOW_MINUTES,
} from "./reminder-timing";

type ReminderType =
  | "configured_before"
  | "overdue"
  | "due_tomorrow"
  | "due_today";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// America/Caracas is fixed UTC-4 year-round.
const CARACAS_OFFSET_MS = 4 * 60 * MINUTE_MS;

function buildWindows(now: Date) {
  // Shift the window to stored day-start timestamps, preserving indexed lookups.
  const nowMs = now.getTime() - DUE_DATE_DURATION_MS;
  const windowEnd = new Date(nowMs);

  const caracasShifted = new Date(now.getTime() - CARACAS_OFFSET_MS);
  const caracasTodayStartMs =
    Date.UTC(
      caracasShifted.getUTCFullYear(),
      caracasShifted.getUTCMonth(),
      caracasShifted.getUTCDate(),
      0,
      0,
      0,
      0,
    ) + CARACAS_OFFSET_MS;

  const caracasTodayStart = new Date(caracasTodayStartMs);
  const caracasTomorrowStart = new Date(caracasTodayStartMs + DAY_MS);
  const caracasDayAfterStart = new Date(caracasTodayStartMs + 2 * DAY_MS);

  return {
    upcoming: {
      start: new Date(nowMs - REMINDER_WINDOW_MINUTES * MINUTE_MS),
      end: windowEnd,
      type: "configured_before" as ReminderType,
      notificationType: "due_date_reminder" as const,
      requireNtfySubscription: false,
    },
    dueTomorrow: {
      start: caracasTomorrowStart,
      end: caracasDayAfterStart,
      type: "due_tomorrow" as ReminderType,
      notificationType: "due_date_reminder" as const,
      requireNtfySubscription: true,
    },
    dueToday: {
      start: caracasTodayStart,
      end: caracasTomorrowStart,
      type: "due_today" as ReminderType,
      notificationType: "due_date_reminder" as const,
      requireNtfySubscription: true,
    },
    overdue: {
      end: windowEnd,
      start: new Date(nowMs - 10 * MINUTE_MS),
      type: "overdue" as ReminderType,
      notificationType: "task_overdue" as const,
      requireNtfySubscription: false,
    },
  };
}

async function getTasksNeedingReminder(
  windowStart: Date,
  windowEnd: Date,
  reminderType: ReminderType,
  requireNtfySubscription: boolean,
) {
  const baseQuery = db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      projectId: taskTable.projectId,
      leadTimeMinutes:
        userNotificationPreferenceTable.dueDateReminderLeadTimeMinutes,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
        eq(workspaceUserTable.userId, taskTable.userId),
      ),
    )
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .leftJoin(
      userNotificationPreferenceTable,
      eq(userNotificationPreferenceTable.userId, taskTable.userId),
    )
    .leftJoin(
      taskReminderSentTable,
      and(
        eq(taskReminderSentTable.taskId, taskTable.id),
        eq(taskReminderSentTable.reminderType, reminderType),
      ),
    );

  const joinedQuery = requireNtfySubscription
    ? baseQuery.innerJoin(
        agendaNtfySubscriptionTable,
        and(
          eq(agendaNtfySubscriptionTable.userId, taskTable.userId),
          eq(agendaNtfySubscriptionTable.enabled, true),
        ),
      )
    : baseQuery;

  const dateCondition =
    reminderType === "configured_before"
      ? sql`${taskTable.dueDate} - (COALESCE(${userNotificationPreferenceTable.dueDateReminderLeadTimeMinutes}, 1440) * interval '1 minute') BETWEEN ${windowStart.toISOString()} AND ${windowEnd.toISOString()}`
      : reminderType === "overdue"
        ? between(taskTable.dueDate, windowStart, windowEnd)
        : and(
            gte(taskTable.dueDate, windowStart),
            lt(taskTable.dueDate, windowEnd),
          );

  return joinedQuery.where(
    and(
      isNotNull(taskTable.userId),
      isNotNull(taskTable.dueDate),
      dateCondition,
      isNull(taskReminderSentTable.id),
      or(
        isNull(userNotificationPreferenceTable.id),
        eq(userNotificationPreferenceTable.dueDateReminderEnabled, true),
      ),
      // Exclude tasks in final columns (completed); include tasks with no column
      or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
      // Archived tasks keep their due date but should not notify anyone
      ne(taskTable.status, "archived"),
      workspaceIsActive(projectTable.workspaceId),
    ),
  );
}

async function processReminder(
  task: {
    id: string;
    title: string;
    userId: string | null;
    dueDate: Date | null;
    projectId: string;
    leadTimeMinutes: number | null;
  },
  reminderType: ReminderType,
  notificationType: "due_date_reminder" | "task_overdue",
) {
  if (!task.userId) return;

  const notification = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(taskReminderSentTable)
      .values({
        taskId: task.id,
        reminderType,
      })
      .onConflictDoNothing({
        target: [
          taskReminderSentTable.taskId,
          taskReminderSentTable.reminderType,
        ],
      })
      .returning();
    if (!claimed) return null;

    const leadTimeMinutes =
      reminderType === "due_tomorrow"
        ? 1440
        : reminderType === "due_today"
          ? 0
          : (task.leadTimeMinutes ?? 1440);

    const created = await persistNotification(
      {
        userId: task.userId!,
        type: notificationType,
        eventData: {
          taskTitle: task.title,
          reminderType,
          leadTimeMinutes,
          dueDate: task.dueDate?.toISOString() ?? null,
        },
        resourceId: task.id,
        resourceType: "task",
      },
      tx,
    );
    if (!created)
      await tx
        .delete(taskReminderSentTable)
        .where(eq(taskReminderSentTable.id, claimed.id));
    return created;
  });
  if (notification) await dispatchNotification(notification);
}

export async function checkDueDateReminders(): Promise<{ degraded: boolean }> {
  const now = new Date();
  const windows = buildWindows(now);
  let degraded = false;

  for (const window of Object.values(windows)) {
    try {
      const tasks = await getTasksNeedingReminder(
        window.start,
        window.end,
        window.type,
        window.requireNtfySubscription,
      );

      for (const task of tasks) {
        try {
          await processReminder(task, window.type, window.notificationType);
        } catch (error) {
          degraded = true;
          console.error("Failed to process due date reminder", {
            taskId: task.id,
            reminderType: window.type,
            error,
          });
        }
      }
    } catch (error) {
      degraded = true;
      console.error("Failed to query tasks for due date reminders", {
        reminderType: window.type,
        error,
      });
    }
  }

  return { degraded };
}

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  labelTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { rankInsignia } from "../../sigefanb/military-assets";
import { getSubtaskCounts } from "../get-subtask-counts";
import { taskIsCompleted } from "../task-is-completed";
import { resolveReadableTaskWorkspaces } from "./resolve-accessible-workspaces";

const DELEGATED_TASKS_LIMIT = 150;
const CARACAS_TZ = "America/Caracas";
const CARACAS_OFFSET = "-04:00";
const DAY_MS = 24 * 60 * 60 * 1000;

const caracasDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARACAS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function computeOverdueDays(dueDate: Date | null, isFinal: boolean): number {
  if (!dueDate || isFinal) return 0;
  const todayKey = caracasDayFormatter.format(new Date());
  const dueKey = caracasDayFormatter.format(dueDate);
  if (dueKey >= todayKey) return 0;
  const startToday = new Date(`${todayKey}T00:00:00${CARACAS_OFFSET}`);
  const startDue = new Date(`${dueKey}T00:00:00${CARACAS_OFFSET}`);
  return Math.max(
    1,
    Math.round((startToday.getTime() - startDue.getTime()) / DAY_MS),
  );
}

const isTaskFinalExpr = sql<boolean>`coalesce((
  select ${columnTable.isFinal} from ${columnTable}
  where ${columnTable.id} = ${taskTable.columnId}
    and ${columnTable.projectId} = ${taskTable.projectId}
), ${taskIsCompleted})`;

export type GetDelegatedTasksOptions = {
  includeCompleted?: boolean;
  allWorkspaces?: boolean;
};

export async function getDelegatedTasks(
  workspaceId: string,
  userId: string,
  options: GetDelegatedTasksOptions = {},
) {
  const includeCompleted = options.includeCompleted !== false;
  const allWorkspaces = options.allWorkspaces === true;

  const targetWorkspaceIds = await resolveReadableTaskWorkspaces(
    workspaceId,
    userId,
    allWorkspaces,
  );

  const workspaceScope =
    targetWorkspaceIds.length === 1
      ? eq(projectTable.workspaceId, targetWorkspaceIds[0]!)
      : inArray(projectTable.workspaceId, targetWorkspaceIds);

  const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS);

  // Tasks created by `userId` (either stored in `created_by` or legacy `activity.type = 'created'`)
  // and assigned to someone else.
  const createdByMe = or(
    eq(taskTable.createdBy, userId),
    and(
      isNull(taskTable.createdBy),
      sql`exists (
        select 1 from ${activityTable}
        where ${activityTable.taskId} = ${taskTable.id}
          and ${activityTable.userId} = ${userId}
          and ${activityTable.type} in ('created', 'create')
      )`,
    ),
  );

  const completionCondition = includeCompleted
    ? or(
        sql`not ${isTaskFinalExpr}`,
        and(isTaskFinalExpr, gte(taskTable.updatedAt, fourteenDaysAgo)),
      )
    : sql`not ${isTaskFinalExpr}`;

  const statusColumn = db
    .select({
      name: columnTable.name,
      icon: columnTable.icon,
      isFinal: columnTable.isFinal,
    })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, taskTable.projectId),
        eq(columnTable.slug, taskTable.status),
      ),
    )
    .orderBy(
      sql`case when ${columnTable.id} = ${taskTable.columnId} then 0 else 1 end`,
      asc(columnTable.position),
      asc(columnTable.createdAt),
      asc(columnTable.id),
    )
    .limit(1)
    .as("delegated_status_column");

  const lastActivity = db
    .select({
      type: activityTable.type,
      createdAt: activityTable.createdAt,
      content: activityTable.content,
    })
    .from(activityTable)
    .where(eq(activityTable.taskId, taskTable.id))
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(1)
    .as("delegated_last_activity");

  const lastReminder = db
    .select({
      createdAt: activityTable.createdAt,
    })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.taskId, taskTable.id),
        eq(activityTable.type, "reminder"),
      ),
    )
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(1)
    .as("delegated_last_reminder");

  const rows = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: workspaceTable.id,
      workspaceName: workspaceTable.name,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      columnId: taskTable.columnId,
      statusName: statusColumn.name,
      statusIcon: statusColumn.icon,
      isFinal: sql<boolean>`coalesce(${statusColumn.isFinal}, false)`,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      updatedAt: taskTable.updatedAt,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      projectIcon: projectTable.icon,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeImage: userTable.image,
      assigneeCedula: militarPerfilTable.cedula,
      assigneeGrado: militarPerfilTable.grado,
      assigneeComponente: militarPerfilTable.componente,
      assigneeUnidad: militarPerfilTable.unidad,
      lastActivityAt: lastActivity.createdAt,
      lastActivityType: lastActivity.type,
      lastRemindedAt: lastReminder.createdAt,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(
      militarPerfilTable,
      eq(taskTable.userId, militarPerfilTable.userId),
    )
    .leftJoinLateral(statusColumn, sql`true`)
    .leftJoinLateral(lastActivity, sql`true`)
    .leftJoinLateral(lastReminder, sql`true`)
    .where(
      and(
        workspaceScope,
        isNull(projectTable.archivedAt),
        isNull(workspaceTable.archivedAt),
        ne(taskTable.status, "archived"),
        isNotNull(taskTable.userId),
        ne(taskTable.userId, userId),
        createdByMe,
        completionCondition,
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(
      sql`case when coalesce(${statusColumn.isFinal}, false) then 1 else 0 end`,
      sql`${taskTable.dueDate} asc nulls last`,
      desc(taskTable.updatedAt),
    )
    .limit(DELEGATED_TASKS_LIMIT);

  const taskIds = rows.map((r) => r.id);
  const labels = taskIds.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(inArray(labelTable.taskId, taskIds))
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const list = labelsByTask.get(taskId) ?? [];
    list.push(label);
    labelsByTask.set(taskId, list);
  }

  // Group subtask counts by workspaceId so cross-workspace queries stay accurate.
  const subtaskCounts = new Map<string, { completed: number; total: number }>();
  const tasksByWorkspace = new Map<string, string[]>();
  for (const row of rows) {
    const list = tasksByWorkspace.get(row.workspaceId) ?? [];
    list.push(row.id);
    tasksByWorkspace.set(row.workspaceId, list);
  }
  await Promise.all(
    Array.from(tasksByWorkspace.entries()).map(async ([wsId, wsTaskIds]) => {
      const counts = await getSubtaskCounts(
        db as unknown as Parameters<typeof getSubtaskCounts>[0],
        wsTaskIds,
        wsId,
        false,
        userId,
      );
      for (const [tid, c] of counts) {
        subtaskCounts.set(tid, c);
      }
    }),
  );

  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const projectColumns = projectIds.length
    ? await db
        .select({
          id: columnTable.id,
          projectId: columnTable.projectId,
          slug: columnTable.slug,
          name: columnTable.name,
          icon: columnTable.icon,
          isFinal: columnTable.isFinal,
          position: columnTable.position,
        })
        .from(columnTable)
        .where(inArray(columnTable.projectId, projectIds))
        .orderBy(asc(columnTable.position), asc(columnTable.createdAt))
    : [];

  const columnsByProject: Record<
    string,
    Array<{
      id: string;
      slug: string;
      name: string;
      icon: string | null;
      isFinal: boolean;
      position: number;
    }>
  > = {};
  for (const col of projectColumns) {
    const list = columnsByProject[col.projectId] ?? [];
    list.push({
      id: col.id,
      slug: col.slug,
      name: col.name,
      icon: col.icon,
      isFinal: col.isFinal,
      position: col.position,
    });
    columnsByProject[col.projectId] = list;
  }

  return {
    tasks: rows.map((row) => {
      const isFinal = Boolean(row.isFinal);
      const overdueDays = computeOverdueDays(row.dueDate, isFinal);
      return {
        ...row,
        isFinal,
        overdueDays,
        assigneeInsignia: row.assigneeGrado
          ? (rankInsignia(
              row.assigneeGrado,
              row.assigneeComponente,
              row.assigneeUnidad,
            )?.src ?? null)
          : null,
        assigneeFotoUrl: row.assigneeCedula
          ? `/api/sigefanb/foto/${row.assigneeCedula}`
          : null,
        lastActivityAt: row.lastActivityAt ?? row.updatedAt,
        lastActivityType: row.lastActivityType ?? null,
        lastRemindedAt: row.lastRemindedAt ?? null,
        subtaskCounts: subtaskCounts.get(row.id) ?? { completed: 0, total: 0 },
        labels: labelsByTask.get(row.id) ?? [],
      };
    }),
    total: rows.length,
    columnsByProject,
  };
}

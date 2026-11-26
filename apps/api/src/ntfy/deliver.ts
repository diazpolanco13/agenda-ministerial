import { and, eq } from "drizzle-orm";
import db from "../database";
import { agendaNtfySubscriptionTable } from "../database/schema";
import { decryptSecret } from "../notification-preferences/secrets";
import {
  getAgendaPublicUrl,
  isNtfyConfigured,
  publishNtfyMessage,
} from "./client";

export type AgendaNtfyPayload = {
  title: string;
  body: string;
  priority: 1 | 2 | 3 | 4 | 5;
  tags: string;
};

type SubscriptionRow = typeof agendaNtfySubscriptionTable.$inferSelect;

function getString(
  data: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const val = data?.[key];
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

export function buildPublicTaskClickUrl(input: {
  workspaceId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}): string {
  const base = getAgendaPublicUrl();
  if (input.workspaceId && input.projectId && input.taskId) {
    return `${base}/dashboard/workspace/${input.workspaceId}/project/${input.projectId}/task/${input.taskId}`;
  }
  return `${base}/dashboard`;
}

export function mapNotificationToAgendaNtfy(
  notification: {
    type: string;
    title: string | null;
    content: string | null;
    eventData: Record<string, unknown> | null;
  },
  subscription: Pick<
    SubscriptionRow,
    | "eventTaskAssigned"
    | "eventMentionComment"
    | "eventDueTomorrow"
    | "eventDueToday"
    | "eventOverdue"
    | "eventMinisterOrder"
  >,
): AgendaNtfyPayload | null {
  const taskTitle = getString(notification.eventData, "taskTitle");
  const titleLabel = taskTitle ? `«${taskTitle}»` : "una tarea";

  switch (notification.type) {
    case "task_assignee_changed":
    case "task_created": {
      if (!subscription.eventTaskAssigned) return null;
      return {
        title: "Tarea asignada",
        body: taskTitle
          ? `Se te asignó la tarea: ${taskTitle}`
          : "Se te asignó una nueva tarea en AGENDA.",
        priority: 3,
        tags: "clipboard",
      };
    }

    case "task_mention": {
      if (!subscription.eventMentionComment) return null;
      const mentioner = getString(notification.eventData, "mentionerName");
      return {
        title: mentioner ? `${mentioner} te mencionó` : "Te mencionaron",
        body: `Mención en ${titleLabel}.`,
        priority: 4,
        tags: "loudspeaker",
      };
    }

    case "task_comment": {
      if (!subscription.eventMentionComment) return null;
      const commenter = getString(notification.eventData, "commenterName");
      const preview = getString(notification.eventData, "commentPreview");
      return {
        title: commenter
          ? `${commenter} comentó en tu tarea`
          : "Nuevo comentario",
        body: preview
          ? `${titleLabel}: ${preview}`
          : `Nuevo comentario en ${titleLabel}.`,
        priority: 3,
        tags: "speech_balloon",
      };
    }

    case "due_date_reminder": {
      const reminderType = getString(notification.eventData, "reminderType");
      if (reminderType === "due_today") {
        if (!subscription.eventDueToday) return null;
        return {
          title: "Vence hoy",
          body: `${titleLabel} vence hoy.`,
          priority: 4,
          tags: "alarm_clock",
        };
      }

      if (reminderType === "due_tomorrow") {
        if (!subscription.eventDueTomorrow) return null;
        return {
          title: "Vence mañana",
          body: `${titleLabel} vence mañana.`,
          priority: 3,
          tags: "calendar",
        };
      }

      // `configured_before` is superseded by `due_tomorrow` / `due_today` for
      // AGENDA mobile subscribers so reminders are never sent twice.
      return null;
    }

    case "task_overdue": {
      if (!subscription.eventOverdue) return null;
      return {
        title: "Tarea vencida",
        body: `${titleLabel} superó su fecha límite.`,
        priority: 4,
        tags: "rotating_light",
      };
    }

    case "minister_order": {
      if (!subscription.eventMinisterOrder) return null;
      const origen = getString(notification.eventData, "origenTitulo");
      return {
        title: "Orden del Ministro",
        body: origen
          ? `Nueva orden asignada: ${titleLabel} (${origen})`
          : `Nueva orden del Ministro asignada: ${titleLabel}`,
        priority: 4,
        tags: "mega,star",
      };
    }

    default:
      return null;
  }
}

export async function deliverAgendaNtfyNotification(input: {
  userId: string;
  type: string;
  title: string | null;
  content: string | null;
  eventData: Record<string, unknown> | null;
  workspaceId: string | null;
  projectId: string | null;
  taskId: string | null;
}): Promise<boolean> {
  if (!isNtfyConfigured()) return false;

  const subscription = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: and(
      eq(agendaNtfySubscriptionTable.userId, input.userId),
      eq(agendaNtfySubscriptionTable.enabled, true),
    ),
  });

  if (!subscription) return false;

  const payload = mapNotificationToAgendaNtfy(
    {
      type: input.type,
      title: input.title,
      content: input.content,
      eventData: input.eventData,
    },
    subscription,
  );
  if (!payload) return false;

  const topic = decryptSecret(subscription.topicEncrypted);
  if (!topic) return false;

  const clickUrl = buildPublicTaskClickUrl({
    workspaceId:
      input.workspaceId ?? getString(input.eventData, "workspaceId"),
    projectId: input.projectId ?? getString(input.eventData, "projectId"),
    taskId: input.taskId,
  });

  await publishNtfyMessage({
    topic,
    title: payload.title,
    body: payload.body,
    priority: payload.priority,
    tags: payload.tags,
    clickUrl,
  });

  return true;
}

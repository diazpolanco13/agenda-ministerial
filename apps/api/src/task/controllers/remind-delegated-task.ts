import { and, desc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";

const REMIND_COOLDOWN_MS = 60_000;

export async function remindDelegatedTask({
  taskId,
  currentUserId,
  canAssign,
  message,
}: {
  taskId: string;
  currentUserId: string;
  canAssign: boolean;
  message?: string;
}) {
  const [task] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      userId: taskTable.userId,
      createdBy: taskTable.createdBy,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      number: taskTable.number,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, { message: "Tarea no encontrada" });
  }

  if (!task.userId) {
    throw new HTTPException(400, {
      message: "La tarea no tiene un responsable asignado",
    });
  }

  if (task.userId === currentUserId) {
    throw new HTTPException(400, {
      message: "No puedes enviarte un recordatorio a ti mismo",
    });
  }

  let isCreator = task.createdBy === currentUserId;
  if (!isCreator && !task.createdBy) {
    const [createdActivity] = await db
      .select({ id: activityTable.id })
      .from(activityTable)
      .where(
        and(
          eq(activityTable.taskId, task.id),
          eq(activityTable.userId, currentUserId),
          inArray(activityTable.type, ["created", "create"]),
        ),
      )
      .limit(1);
    isCreator = Boolean(createdActivity);
  }

  if (!isCreator && !canAssign) {
    throw new HTTPException(403, {
      message: "Solo quien delegó la tarea o un coordinador puede enviar recordatorios",
    });
  }

  const [lastReminder] = await db
    .select({ createdAt: activityTable.createdAt })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.taskId, task.id),
        eq(activityTable.type, "reminder"),
        eq(activityTable.userId, currentUserId),
      ),
    )
    .orderBy(desc(activityTable.createdAt))
    .limit(1);

  if (
    lastReminder &&
    Date.now() - lastReminder.createdAt.getTime() < REMIND_COOLDOWN_MS
  ) {
    throw new HTTPException(429, {
      message: "Ya enviaste un recordatorio hace menos de un minuto",
    });
  }

  const [sender] = await db
    .select({
      name: userTable.name,
      grado: militarPerfilTable.grado,
    })
    .from(userTable)
    .leftJoin(militarPerfilTable, eq(userTable.id, militarPerfilTable.userId))
    .where(eq(userTable.id, currentUserId))
    .limit(1);

  const senderLabel = sender?.grado
    ? `${sender.grado} ${sender.name}`
    : (sender?.name ?? "Un coordinador");
  const code =
    task.number != null ? `${task.projectSlug}-${task.number}` : task.projectSlug;
  const customNote = message?.trim();
  const content = customNote
    ? `${senderLabel} te recuerda "${task.title}" (${code}): ${customNote}`
    : `${senderLabel} solicitó seguimiento sobre "${task.title}" (${code} · ${task.projectName}).`;

  const sentAt = new Date();

  await Promise.all([
    createNotification({
      userId: task.userId,
      type: "task_reminder",
      title: `Recordatorio · ${code}`,
      content,
      eventData: {
        taskTitle: task.title,
        remindedByName: senderLabel,
        projectName: task.projectName,
        ...(customNote ? { message: customNote } : {}),
      },
      resourceId: task.id,
      resourceType: "task",
    }),
    db.insert(activityTable).values({
      taskId: task.id,
      type: "reminder",
      userId: currentUserId,
      content: customNote || "Recordatorio de seguimiento enviado",
      eventData: {
        targetUserId: task.userId,
        sentAt: sentAt.toISOString(),
      },
    }),
  ]);

  return {
    success: true,
    notifiedUserId: task.userId,
    sentAt: sentAt.toISOString(),
  };
}

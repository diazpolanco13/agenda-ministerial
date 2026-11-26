import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  orderEscalationSentTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import {
  dispatchNotification,
  persistNotification,
} from "../notification/controllers/create-notification";
import { splitRoles } from "../utils/split-roles";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";

export type OrderEscalationLevel = "t0_jefe_despacho" | "t48_ministro";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Clasifica el nivel máximo de escalamiento según la diferencia entre `now` y `dueDate`.
 * - `now < dueDate` -> `null`
 * - `now - dueDate >= 48h` -> `"t48_ministro"` (también aplica T+0 si no se envió)
 * - `now - dueDate >= 0` -> `"t0_jefe_despacho"`
 */
export function classifyEscalationLevel(
  dueDate: Date,
  now: Date,
): OrderEscalationLevel | null {
  const overdueMs = now.getTime() - dueDate.getTime();
  if (overdueMs < 0) return null;
  if (overdueMs >= FORTY_EIGHT_HOURS_MS) return "t48_ministro";
  return "t0_jefe_despacho";
}

/**
 * Devuelve los niveles de escalamiento aplicables en orden (T+0 y opcionalmente T+48h).
 */
export function getApplicableEscalationLevels(
  dueDate: Date,
  now: Date,
): OrderEscalationLevel[] {
  const highest = classifyEscalationLevel(dueDate, now);
  if (!highest) return [];
  if (highest === "t48_ministro") {
    return ["t0_jefe_despacho", "t48_ministro"];
  }
  return ["t0_jefe_despacho"];
}

async function claimAndNotifyEscalation(params: {
  taskId: string;
  taskTitle: string;
  folio: string | null;
  dueDate: Date;
  assigneeName: string | null;
  projectId: string;
  workspaceId: string;
  level: OrderEscalationLevel;
  recipientUserId: string;
}): Promise<boolean> {
  const notificationType =
    params.level === "t48_ministro"
      ? "order_escalation_t48"
      : "order_escalation_t0";

  const folioPrefix = params.folio ? `[${params.folio}] ` : "";
  const title =
    params.level === "t48_ministro"
      ? "Escalamiento crítico T+48h al Ministro"
      : "Escalamiento T+0 al Jefe de Despacho";
  const content =
    params.level === "t48_ministro"
      ? `${folioPrefix}«${params.taskTitle}» superó las 48 horas de vencimiento sin aprobación.`
      : `${folioPrefix}«${params.taskTitle}» alcanzó su fecha límite sin aprobación.`;

  const notification = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(orderEscalationSentTable)
      .values({
        taskId: params.taskId,
        level: params.level,
        recipientUserId: params.recipientUserId,
      })
      .onConflictDoNothing({
        target: [
          orderEscalationSentTable.taskId,
          orderEscalationSentTable.level,
          orderEscalationSentTable.recipientUserId,
        ],
      })
      .returning();

    if (!claimed) return null;

    const created = await persistNotification(
      {
        userId: params.recipientUserId,
        type: notificationType,
        title,
        content,
        eventData: {
          taskTitle: params.taskTitle,
          folio: params.folio,
          dueDate: params.dueDate.toISOString(),
          assigneeName: params.assigneeName,
          level: params.level,
          projectId: params.projectId,
          workspaceId: params.workspaceId,
        },
        resourceId: params.taskId,
        resourceType: "task",
      },
      tx,
    );

    if (!created) {
      await tx
        .delete(orderEscalationSentTable)
        .where(eq(orderEscalationSentTable.id, claimed.id));
    }

    return created;
  });

  if (!notification) return false;
  await dispatchNotification(notification);
  return true;
}

/**
 * Revisa órdenes vencidas no aprobadas y despacha escalamientos T+0 (jefe_despacho)
 * y T+48h (ministro) garantizando no duplicar envíos mediante `order_escalation_sent`.
 */
export async function checkOrderEscalations(
  now = new Date(),
): Promise<{ degraded: boolean; sentCount: number }> {
  let degraded = false;
  let sentCount = 0;

  let overdueOrders: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    orderFolio: string | null;
    projectId: string;
    workspaceId: string;
    assigneeName: string | null;
  }>;

  try {
    overdueOrders = await db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        dueDate: taskTable.dueDate,
        orderFolio: taskTable.orderFolio,
        projectId: taskTable.projectId,
        workspaceId: projectTable.workspaceId,
        assigneeName: userTable.name,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          eq(taskTable.isOrder, true),
          ne(taskTable.orderClosureStatus, "aprobada"),
          ne(taskTable.status, "archived"),
          isNull(projectTable.archivedAt),
          isNotNull(taskTable.dueDate),
          lte(taskTable.dueDate, now),
          or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
          workspaceIsActive(projectTable.workspaceId),
        ),
      );
  } catch (error) {
    console.error("Failed to query overdue orders for escalation:", error);
    return { degraded: true, sentCount: 0 };
  }

  if (overdueOrders.length === 0) {
    return { degraded: false, sentCount: 0 };
  }

  const workspaceIds = [...new Set(overdueOrders.map((o) => o.workspaceId))];

  let members: Array<{
    workspaceId: string;
    userId: string;
    role: string;
  }>;
  try {
    members = await db
      .select({
        workspaceId: workspaceUserTable.workspaceId,
        userId: workspaceUserTable.userId,
        role: workspaceUserTable.role,
      })
      .from(workspaceUserTable)
      .where(inArray(workspaceUserTable.workspaceId, workspaceIds));
  } catch (error) {
    console.error("Failed to load workspace escalation recipients:", error);
    return { degraded: true, sentCount: 0 };
  }

  const recipientsByWorkspace = new Map<
    string,
    { jefeDespacho: string[]; ministro: string[] }
  >();

  for (const member of members) {
    let entry = recipientsByWorkspace.get(member.workspaceId);
    if (!entry) {
      entry = { jefeDespacho: [], ministro: [] };
      recipientsByWorkspace.set(member.workspaceId, entry);
    }
    const roles = splitRoles(member.role);
    if (roles.includes("jefe_despacho")) {
      entry.jefeDespacho.push(member.userId);
    }
    if (roles.includes("ministro")) {
      entry.ministro.push(member.userId);
    }
  }

  for (const order of overdueOrders) {
    if (!order.dueDate) continue;
    const levels = getApplicableEscalationLevels(order.dueDate, now);
    if (levels.length === 0) continue;

    const recipients = recipientsByWorkspace.get(order.workspaceId);
    if (!recipients) continue;

    for (const level of levels) {
      const targetUserIds =
        level === "t48_ministro"
          ? recipients.ministro
          : recipients.jefeDespacho;

      for (const recipientUserId of targetUserIds) {
        try {
          const sent = await claimAndNotifyEscalation({
            taskId: order.id,
            taskTitle: order.title,
            folio: order.orderFolio,
            dueDate: order.dueDate,
            assigneeName: order.assigneeName,
            projectId: order.projectId,
            workspaceId: order.workspaceId,
            level,
            recipientUserId,
          });
          if (sent) {
            sentCount += 1;
          }
        } catch (error) {
          degraded = true;
          console.error("Failed to send order escalation:", {
            taskId: order.id,
            level,
            recipientUserId,
            error,
          });
        }
      }
    }
  }

  return { degraded, sentCount };
}

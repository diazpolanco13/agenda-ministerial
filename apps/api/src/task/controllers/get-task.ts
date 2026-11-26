import { boundedTaskRead } from "../bounded-read";
import { alias } from "drizzle-orm/pg-core";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { isSubtask } from "../is-subtask";
import { getSubtaskCounts } from "../get-subtask-counts";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  canAccessConfidentialTask,
  canViewConfidentialInWorkspace,
} from "../../confidentiality/access";
import db from "../../database";
import {
  militarPerfilTable,
  taskTable,
  userTable,
  projectTable,
  taskRelationTable,
} from "../../database/schema";
import { isRestrictedResponsable } from "../../utils/is-restricted-responsable";

async function getTask(taskId: string, board = false, userId?: string) {
  const task = await db
    .select({
      id: taskTable.id,
      isSubtask,
      title: taskTable.title,
      number: taskTable.number,
      description: board ? boardDescription : taskTable.description,
      ...(board
        ? {
            descriptionDeferred,
          }
        : {}),
      status: taskTable.status,
      columnId: taskTable.columnId,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      recurrence: taskTable.recurrence,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      createdBy: taskTable.createdBy,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      assigneeCedula: militarPerfilTable.cedula,
      assigneeGrado: militarPerfilTable.grado,
      assigneeComponente: militarPerfilTable.componente,
      assigneeUnidad: militarPerfilTable.unidad,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
      projectConfidentialityLevel: projectTable.confidentialityLevel,
      confidentialityLevel: taskTable.confidentialityLevel,
      isOrder: taskTable.isOrder,
      orderFolio: taskTable.orderFolio,
      orderOrigin: taskTable.orderOrigin,
      orderQuote: taskTable.orderQuote,
      orderClosureStatus: taskTable.orderClosureStatus,
      orderEvidenceText: taskTable.orderEvidenceText,
      orderEvidenceAssetId: taskTable.orderEvidenceAssetId,
      orderEvidenceSubmittedAt: taskTable.orderEvidenceSubmittedAt,
      orderEvidenceSubmittedBy: taskTable.orderEvidenceSubmittedBy,
      orderReviewedAt: taskTable.orderReviewedAt,
      orderReviewedBy: taskTable.orderReviewedBy,
      orderReviewComment: taskTable.orderReviewComment,
      orderSealHash: taskTable.orderSealHash,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(
      militarPerfilTable,
      eq(taskTable.userId, militarPerfilTable.userId),
    )
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task.length || !task[0]) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (userId && task[0].workspaceId) {
    const hasRoleAccess = await canViewConfidentialInWorkspace(
      userId,
      task[0].workspaceId,
    );
    if (
      !canAccessConfidentialTask({
        userId,
        taskConfidentiality: task[0].confidentialityLevel,
        projectConfidentiality: task[0].projectConfidentialityLevel,
        assigneeId: task[0].userId,
        createdBy: task[0].createdBy,
        hasRoleAccess,
      })
    ) {
      throw new HTTPException(403, {
        message: "No tienes acceso a esta tarea confidencial",
      });
    }
  }

  if (
    userId &&
    task[0].workspaceId &&
    (await isRestrictedResponsable(userId, task[0].workspaceId)) &&
    task[0].userId !== userId
  ) {
    throw new HTTPException(403, {
      message: "No tienes acceso a esta tarea",
    });
  }

  const { createdBy: _createdBy, ...taskRow } = task[0];

  if (!board) return taskRow;
  const { workspaceId, ...result } = taskRow;
  if (!workspaceId) return result;
  const parent = alias(taskTable, "parent");
  const parents = await db
    .selectDistinct({ id: parent.id })
    .from(taskRelationTable)
    .innerJoin(parent, eq(taskRelationTable.sourceTaskId, parent.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        eq(parent.projectId, result.projectId),
      ),
    );
  const counts = await boundedTaskRead((tx) =>
    getSubtaskCounts(
      tx,
      [taskId, ...parents.map((task) => task.id)],
      workspaceId,
      false,
      userId,
    ),
  );
  return {
    ...result,
    subtaskCounts: counts.get(taskId) ?? { completed: 0, total: 0 },
    parentSubtaskCounts: parents.map(({ id }) => ({
      taskId: id,
      ...(counts.get(id) ?? { completed: 0, total: 0 }),
    })),
  };
}

export default getTask;

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  getConfidentialAuthorizedWorkspaceIds,
  taskConfidentialitySqlFilter,
} from "../../confidentiality/access";
import db from "../../database";
import {
  columnTable,
  labelTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { taskIsCompleted } from "../task-is-completed";
import { resolveReadableTaskWorkspaces } from "./resolve-accessible-workspaces";

// Home and My tasks render this list whole, so it stays one bounded page.
export const ASSIGNED_TASKS_LIMIT = 100;
export const ASSIGNED_TASKS_RICH_LIMIT = 250;

const CARACAS_OFFSET = "-04:00";
const CARACAS_TZ = "America/Caracas";
const DAY_MS = 24 * 60 * 60 * 1000;

const caracasDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARACAS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getCaracasDayBounds(now = new Date()) {
  const dayKey = caracasDayFormatter.format(now);
  const startOfToday = new Date(`${dayKey}T00:00:00${CARACAS_OFFSET}`);
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);
  const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * DAY_MS);
  return { startOfToday, endOfToday, sevenDaysAgo, thirtyDaysAgo };
}

const priorityRank = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

const isTaskFinalExpr = sql<boolean>`coalesce((
  select ${columnTable.isFinal} from ${columnTable}
  where ${columnTable.id} = ${taskTable.columnId}
    and ${columnTable.projectId} = ${taskTable.projectId}
), ${taskIsCompleted})`;

export type GetAssignedTasksOptions = {
  includeCompleted?: boolean;
  allWorkspaces?: boolean;
};

async function getAssignedTasks(
  workspaceId: string,
  userId: string,
  countOnly = false,
  options: GetAssignedTasksOptions = {},
) {
  const includeCompleted = options.includeCompleted === true;
  const allWorkspaces = options.allWorkspaces === true;

  const [targetWorkspaceIds, authorizedConfWsIds] = await Promise.all([
    resolveReadableTaskWorkspaces(workspaceId, userId, allWorkspaces),
    getConfidentialAuthorizedWorkspaceIds(userId),
  ]);

  const authorizedConfList = [...authorizedConfWsIds];
  const confFilter =
    authorizedConfList.length > 0
      ? or(
          inArray(projectTable.workspaceId, authorizedConfList),
          taskConfidentialitySqlFilter(userId, false),
        )
      : taskConfidentialitySqlFilter(userId, false);

  const openCondition = sql`not ${isTaskFinalExpr}`;
  const { startOfToday, endOfToday, sevenDaysAgo, thirtyDaysAgo } =
    getCaracasDayBounds();

  const workspaceScope =
    targetWorkspaceIds.length === 1
      ? eq(projectTable.workspaceId, targetWorkspaceIds[0]!)
      : inArray(projectTable.workspaceId, targetWorkspaceIds);

  const openAndMine = and(
    workspaceScope,
    isNull(projectTable.archivedAt),
    isNull(workspaceTable.archivedAt),
    eq(taskTable.userId, userId),
    ne(taskTable.status, "archived"),
    openCondition,
    projectAccessCondition(userId, projectTable.id),
    confFilter,
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(openAndMine);

  if (countOnly) {
    const [totals] = await totalsQuery;
    return { tasks: [], total: Number(totals?.total ?? 0) };
  }

  const listWhere = includeCompleted
    ? and(
        workspaceScope,
        isNull(projectTable.archivedAt),
        isNull(workspaceTable.archivedAt),
        eq(taskTable.userId, userId),
        ne(taskTable.status, "archived"),
        or(
          openCondition,
          and(isTaskFinalExpr, gte(taskTable.updatedAt, thirtyDaysAgo)),
        ),
        projectAccessCondition(userId, projectTable.id),
        confFilter,
      )
    : openAndMine;

  // Existing databases may contain duplicate slugs from concurrent column
  // creation. A lateral lookup must return at most one decoration per task.
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
    .as("assigned_status_column");

  const limit = includeCompleted
    ? ASSIGNED_TASKS_RICH_LIMIT
    : ASSIGNED_TASKS_LIMIT;

  const [tasks, [totals], kpiRows] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        workspaceId: workspaceTable.id,
        workspaceName: workspaceTable.name,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        columnId: taskTable.columnId,
        position: taskTable.position,
        statusName: statusColumn.name,
        statusIcon: statusColumn.icon,
        isFinal: sql<boolean>`coalesce(${statusColumn.isFinal}, false)`,
        priority: taskTable.priority,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        createdAt: taskTable.createdAt,
        updatedAt: taskTable.updatedAt,
        userId: taskTable.userId,
        assigneeName: userTable.name,
        assigneeImage: userTable.image,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
        assigneeCedula: militarPerfilTable.cedula,
        assigneeGrado: militarPerfilTable.grado,
        assigneeComponente: militarPerfilTable.componente,
        assigneeUnidad: militarPerfilTable.unidad,
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
      .innerJoin(
        workspaceTable,
        eq(projectTable.workspaceId, workspaceTable.id),
      )
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .leftJoin(
        militarPerfilTable,
        eq(taskTable.userId, militarPerfilTable.userId),
      )
      .leftJoinLateral(statusColumn, sql`true`)
      .where(listWhere)
      .orderBy(
        sql`case when coalesce(${statusColumn.isFinal}, false) then 1 else 0 end`,
        sql`${taskTable.dueDate} asc nulls last`,
        desc(priorityRank),
        asc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(limit),
    totalsQuery,
    db
      .select({
        isFinal: isTaskFinalExpr,
        dueDate: taskTable.dueDate,
        updatedAt: taskTable.updatedAt,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .innerJoin(
        workspaceTable,
        eq(projectTable.workspaceId, workspaceTable.id),
      )
      .where(
        and(
          workspaceScope,
          isNull(projectTable.archivedAt),
          isNull(workspaceTable.archivedAt),
          eq(taskTable.userId, userId),
          ne(taskTable.status, "archived"),
          or(
            openCondition,
            and(isTaskFinalExpr, gte(taskTable.updatedAt, thirtyDaysAgo)),
          ),
          projectAccessCondition(userId, projectTable.id),
          confFilter,
        ),
      ),
  ]);

  const projectIds = [...new Set(tasks.map((task) => task.projectId))];
  const taskIds = tasks.map((task) => task.id);

  const [labels, projectColumns] = await Promise.all([
    taskIds.length
      ? db
          .select({
            id: labelTable.id,
            name: labelTable.name,
            color: labelTable.color,
            taskId: labelTable.taskId,
          })
          .from(labelTable)
          .where(inArray(labelTable.taskId, taskIds))
          .orderBy(asc(labelTable.name), asc(labelTable.id))
      : [],
    projectIds.length
      ? db
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
      : [],
  ]);

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const taskLabels = labelsByTask.get(taskId) ?? [];
    taskLabels.push(label);
    labelsByTask.set(taskId, taskLabels);
  }

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

  let overdueCount = 0;
  let dueTodayCount = 0;
  let completedThisWeekCount = 0;
  let completedWithDue30d = 0;
  let completedOnTime30d = 0;

  for (const row of kpiRows) {
    if (!row.isFinal) {
      if (row.dueDate) {
        if (row.dueDate < startOfToday) {
          overdueCount++;
        } else if (row.dueDate >= startOfToday && row.dueDate < endOfToday) {
          dueTodayCount++;
        }
      }
    } else {
      if (row.updatedAt >= sevenDaysAgo) {
        completedThisWeekCount++;
      }
      if (row.updatedAt >= thirtyDaysAgo && row.dueDate) {
        completedWithDue30d++;
        // End of the due day in Caracas counts as on time.
        const dueDayKey = caracasDayFormatter.format(row.dueDate);
        const dueEnd = new Date(
          new Date(`${dueDayKey}T00:00:00${CARACAS_OFFSET}`).getTime() + DAY_MS,
        );
        if (row.updatedAt <= dueEnd) {
          completedOnTime30d++;
        }
      }
    }
  }

  const onTimeRate30d =
    completedWithDue30d > 0
      ? Math.round((completedOnTime30d / completedWithDue30d) * 100)
      : null;

  return {
    tasks: tasks.map((task) => ({
      ...task,
      labels: labelsByTask.get(task.id) ?? [],
    })),
    total: Number(totals?.total ?? 0),
    kpis: {
      overdueCount,
      dueTodayCount,
      completedThisWeekCount,
      completedOnTime30d,
      completedWithDue30d,
      onTimeRate30d,
    },
    columnsByProject,
  };
}

export default getAssignedTasks;

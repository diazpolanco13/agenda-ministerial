import { and, desc, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { redactInaccessibleMoves } from "../../activity/redact-inaccessible-moves";
import {
  canViewConfidentialInWorkspace,
  taskConfidentialitySqlFilter,
} from "../../confidentiality/access";
import db from "../../database";
import {
  activityTable,
  columnTable,
  discursoBorradorTable,
  labelTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { isRestrictedResponsable } from "../../utils/is-restricted-responsable";
import { validateWorkspaceAccess } from "../../utils/validate-workspace-access";
import {
  abreviarGrado,
  resolveMilitarySummaryMeta,
  shortDisplayName,
} from "../rank-abbrev";

const CARACAS_TIMEZONE = "America/Caracas";
const CARACAS_OFFSET = "-04:00";
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_WINDOW_DAYS = 14;
const ACTIVITY_SCAN_LIMIT = 250;
const MAX_AGENDA_HOY = 10;
const MAX_ORDENES_RECIENTES = 8;
const MAX_TOP_RESPONSABLES = 5;
const MAX_ACTIVIDAD_COMPACTA = 12;

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  "no-priority": 0,
};

const caracasDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARACAS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toCaracasDayKey(date: Date): string {
  return caracasDateFormatter.format(date);
}

function getCaracasWindow(now = new Date()) {
  const todayKey = toCaracasDayKey(now);
  const inicioHoyCaracas = new Date(`${todayKey}T00:00:00${CARACAS_OFFSET}`);
  const finHoyCaracas = new Date(inicioHoyCaracas.getTime() + DAY_MS);
  const finSemanaCaracas = new Date(inicioHoyCaracas.getTime() + 8 * DAY_MS);
  return { todayKey, inicioHoyCaracas, finHoyCaracas, finSemanaCaracas };
}

function priorityScore(priority: string | null | undefined): number {
  return PRIORITY_WEIGHT[priority ?? "no-priority"] ?? 0;
}

function isOrderLabelName(name: string): boolean {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toUpperCase();
  return (
    normalized === "ORDEN" ||
    normalized === "ORDENES" ||
    normalized === "ORDEN DEL MINISTRO" ||
    normalized === "ORDEN MINISTERIAL"
  );
}

function hasDiscursoOriginDescription(
  description: string | null | undefined,
): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();
  return (
    lower.includes("origen: discurso") ||
    lower.includes("extraído de discurso") ||
    lower.includes("extraida de discurso") ||
    lower.includes("discurso ministerial")
  );
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildCompactActivitySummary(params: {
  actorDisplay: string;
  createTaskCount: number;
  createOrderCount: number;
  commentTaskCount: number;
  updateTaskCount: number;
  totalDistinctTasks: number;
}): string {
  const {
    actorDisplay,
    createTaskCount,
    createOrderCount,
    commentTaskCount,
    updateTaskCount,
    totalDistinctTasks,
  } = params;

  if (createTaskCount > 0 && commentTaskCount === 0 && updateTaskCount === 0) {
    if (createOrderCount === createTaskCount) {
      return `${actorDisplay} creó ${createOrderCount} ${pluralize(createOrderCount, "orden", "órdenes")}`;
    }
    return `${actorDisplay} creó ${createTaskCount} ${pluralize(createTaskCount, "tarea", "tareas")}`;
  }

  if (commentTaskCount > 0 && createTaskCount === 0 && updateTaskCount === 0) {
    return `${actorDisplay} comentó en ${commentTaskCount} ${pluralize(commentTaskCount, "tarea", "tareas")}`;
  }

  return `${actorDisplay} actualizó ${totalDistinctTasks} ${pluralize(totalDistinctTasks, "tarea", "tareas")}`;
}

export async function getExecutiveSummary(
  workspaceId: string,
  userId: string,
  apiKeyId?: string,
) {
  await validateWorkspaceAccess(userId, workspaceId, apiKeyId);

  const [
    restrictedResponsable,
    canViewConf,
    [currentUserRow],
    accessibleProjects,
  ] = await Promise.all([
    isRestrictedResponsable(userId, workspaceId),
    canViewConfidentialInWorkspace(userId, workspaceId),
      db
        .select({
          userId: userTable.id,
          name: userTable.name,
          image: userTable.image,
          cedula: militarPerfilTable.cedula,
          nacionalidad: militarPerfilTable.nacionalidad,
          grado: militarPerfilTable.grado,
          componente: militarPerfilTable.componente,
          unidad: militarPerfilTable.unidad,
        })
        .from(userTable)
        .leftJoin(
          militarPerfilTable,
          eq(userTable.id, militarPerfilTable.userId),
        )
        .where(eq(userTable.id, userId))
        .limit(1),
      db
        .select({
          id: projectTable.id,
          name: projectTable.name,
          slug: projectTable.slug,
          icon: projectTable.icon,
        })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            isNull(projectTable.archivedAt),
            projectAccessCondition(userId, projectTable.id),
          ),
        ),
    ]);

  const currentUserMeta = resolveMilitarySummaryMeta({
    grado: currentUserRow?.grado,
    componente: currentUserRow?.componente,
    unidad: currentUserRow?.unidad,
    cedula: currentUserRow?.cedula,
    image: currentUserRow?.image,
  });

  const usuario = {
    userId,
    name: currentUserRow?.name ?? "Usuario",
    grado: currentUserMeta.grado,
    gradoCorto: abreviarGrado(
      currentUserMeta.grado,
      currentUserRow?.componente,
      currentUserRow?.unidad,
    ),
    componente: currentUserRow?.componente ?? null,
    unidad: currentUserRow?.unidad ?? null,
    cedula: currentUserRow?.cedula ?? null,
    insignia: currentUserMeta.insignia,
    fotoUrl: currentUserMeta.fotoUrl,
    restrictedResponsable,
  };

  if (accessibleProjects.length === 0) {
    return {
      usuario,
      kpis: {
        vencidas: 0,
        vencenHoy: 0,
        vencenSemana: 0,
        ordenesPendientes: 0,
        cumplimientoATiempoPct: null as number | null,
        cumplimientoEnPlazo: 0,
        cumplimientoBase: 0,
        totalAbiertas: 0,
        totalCompletadas: 0,
      },
      agendaHoy: [],
      ordenesRecientes: [],
      topResponsables: [],
      actividadCompacta: [],
    };
  }

  const projectIds = accessibleProjects.map((project) => project.id);
  const projectById = new Map(
    accessibleProjects.map((project) => [project.id, project]),
  );

  const confTaskFilter = taskConfidentialitySqlFilter(userId, canViewConf);

  const taskConditions = [
    inArray(taskTable.projectId, projectIds),
    ne(taskTable.status, "archived"),
  ];
  if (restrictedResponsable) {
    taskConditions.push(eq(taskTable.userId, userId));
  }
  if (confTaskFilter) {
    taskConditions.push(confTaskFilter);
  }

  const [columns, rawTasks, labelRows, discursoRows] = await Promise.all([
    db
      .select({
        id: columnTable.id,
        projectId: columnTable.projectId,
        slug: columnTable.slug,
        name: columnTable.name,
        isFinal: columnTable.isFinal,
      })
      .from(columnTable)
      .where(inArray(columnTable.projectId, projectIds)),
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        description: taskTable.description,
        status: taskTable.status,
        columnId: taskTable.columnId,
        priority: taskTable.priority,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        createdAt: taskTable.createdAt,
        isOrder: taskTable.isOrder,
        orderFolio: taskTable.orderFolio,
        orderClosureStatus: taskTable.orderClosureStatus,
        assigneeId: taskTable.userId,
        assigneeName: userTable.name,
        assigneeImage: userTable.image,
        assigneeCedula: militarPerfilTable.cedula,
        assigneeNacionalidad: militarPerfilTable.nacionalidad,
        assigneeGrado: militarPerfilTable.grado,
        assigneeComponente: militarPerfilTable.componente,
        assigneeUnidad: militarPerfilTable.unidad,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .leftJoin(
        militarPerfilTable,
        eq(taskTable.userId, militarPerfilTable.userId),
      )
      .where(and(...taskConditions)),
    db
      .select({
        taskId: labelTable.taskId,
        name: labelTable.name,
      })
      .from(labelTable)
      .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
      .where(inArray(taskTable.projectId, projectIds)),
    db
      .select({
        ordenes: discursoBorradorTable.ordenes,
      })
      .from(discursoBorradorTable)
      .where(
        and(
          eq(discursoBorradorTable.workspaceId, workspaceId),
          eq(discursoBorradorTable.estado, "aprobado"),
        ),
      ),
  ]);

  const columnById = new Map(columns.map((column) => [column.id, column]));
  const columnByProjectSlug = new Map<string, (typeof columns)[number]>();
  for (const column of columns) {
    const key = `${column.projectId}::${column.slug}`;
    if (!columnByProjectSlug.has(key)) {
      columnByProjectSlug.set(key, column);
    }
  }

  const orderTaskIds = new Set<string>();
  for (const label of labelRows) {
    if (label.taskId && isOrderLabelName(label.name)) {
      orderTaskIds.add(label.taskId);
    }
  }
  for (const draft of discursoRows) {
    for (const orden of draft.ordenes ?? []) {
      if (orden.createdTaskId) {
        orderTaskIds.add(orden.createdTaskId);
      }
    }
  }

  const { inicioHoyCaracas, finHoyCaracas, finSemanaCaracas } =
    getCaracasWindow();

  const enrichedTasks = rawTasks.map((task) => {
    const column =
      (task.columnId ? columnById.get(task.columnId) : undefined) ??
      columnByProjectSlug.get(`${task.projectId}::${task.status}`);
    const isCompleted = column
      ? column.isFinal
      : task.status === "done" || task.status === "completed";
    const esOrden =
      Boolean(task.isOrder) ||
      orderTaskIds.has(task.id) ||
      hasDiscursoOriginDescription(task.description);
    const project = projectById.get(task.projectId);

    const assigneeMeta = task.assigneeId
      ? resolveMilitarySummaryMeta({
          grado: task.assigneeGrado,
          componente: task.assigneeComponente,
          unidad: task.assigneeUnidad,
          cedula: task.assigneeCedula,
          image: task.assigneeImage,
        })
      : null;

    return {
      id: task.id,
      projectId: task.projectId,
      projectName: project?.name ?? "Proyecto",
      projectSlug: project?.slug ?? "PRJ",
      projectIcon: project?.icon ?? null,
      number: task.number,
      title: task.title,
      status: task.status,
      statusName: column?.name ?? null,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      isCompleted,
      esOrden,
      orderFolio: task.orderFolio,
      orderClosureStatus: task.orderClosureStatus,
      responsable:
        task.assigneeId && assigneeMeta
          ? {
              userId: task.assigneeId,
              name: task.assigneeName ?? "Responsable",
              grado: assigneeMeta.grado,
              componente: task.assigneeComponente ?? null,
              unidad: task.assigneeUnidad ?? null,
              cedula: task.assigneeCedula ?? null,
              fotoUrl: assigneeMeta.fotoUrl,
              insignia: assigneeMeta.insignia,
            }
          : null,
    };
  });

  // KPIs
  let vencidas = 0;
  let vencenHoy = 0;
  let vencenSemana = 0;
  let ordenesPendientes = 0;
  let totalAbiertas = 0;
  let totalCompletadas = 0;
  let tasksWithDueCount = 0;
  let tasksWithDueOnTimeCount = 0;

  for (const task of enrichedTasks) {
    if (task.isCompleted) {
      totalCompletadas += 1;
    } else {
      totalAbiertas += 1;
      if (task.esOrden) {
        ordenesPendientes += 1;
      }
      if (task.dueDate) {
        if (task.dueDate < inicioHoyCaracas) {
          vencidas += 1;
        } else if (task.dueDate < finHoyCaracas) {
          vencenHoy += 1;
        }
        if (
          task.dueDate >= inicioHoyCaracas &&
          task.dueDate < finSemanaCaracas
        ) {
          vencenSemana += 1;
        }
      }
    }

    if (task.dueDate) {
      tasksWithDueCount += 1;
      if (task.isCompleted || task.dueDate >= inicioHoyCaracas) {
        tasksWithDueOnTimeCount += 1;
      }
    }
  }

  let cumplimientoBase = 0;
  let cumplimientoEnPlazo = 0;
  let cumplimientoATiempoPct: number | null = null;
  if (tasksWithDueCount > 0) {
    cumplimientoBase = tasksWithDueCount;
    cumplimientoEnPlazo = tasksWithDueOnTimeCount;
    cumplimientoATiempoPct = Math.round(
      (tasksWithDueOnTimeCount / tasksWithDueCount) * 100,
    );
  } else if (enrichedTasks.length > 0) {
    cumplimientoBase = enrichedTasks.length;
    cumplimientoEnPlazo = totalCompletadas;
    cumplimientoATiempoPct = Math.round(
      (totalCompletadas / enrichedTasks.length) * 100,
    );
  }

  // Agenda de hoy (Caracas)
  const isTodayCaracas = (date: Date | null) =>
    date !== null && date >= inicioHoyCaracas && date < finHoyCaracas;

  const agendaHoy = enrichedTasks
    .filter(
      (task) => isTodayCaracas(task.dueDate) || isTodayCaracas(task.startDate),
    )
    .sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      const priorityDiff =
        priorityScore(b.priority) - priorityScore(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      const aTime = (a.dueDate ?? a.startDate)?.getTime() ?? 0;
      const bTime = (b.dueDate ?? b.startDate)?.getTime() ?? 0;
      return aTime - bTime;
    })
    .slice(0, MAX_AGENDA_HOY)
    .map((task) => ({
      id: task.id,
      projectId: task.projectId,
      projectName: task.projectName,
      projectSlug: task.projectSlug,
      projectIcon: task.projectIcon,
      number: task.number,
      title: task.title,
      status: task.status,
      statusName: task.statusName,
      priority: task.priority,
      completada: task.isCompleted,
      esOrden: task.esOrden,
      startDate: task.startDate,
      dueDate: task.dueDate,
      responsable: task.responsable,
    }));

  // Órdenes recientes del Ministro (o tareas recientes si aún no hay etiquetadas ORDEN)
  const taggedOrders = enrichedTasks.filter((task) => task.esOrden);
  const orderPool = taggedOrders.length > 0 ? taggedOrders : enrichedTasks;
  const ordenesRecientes = [...orderPool]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_ORDENES_RECIENTES)
    .map((task) => ({
      id: task.id,
      projectId: task.projectId,
      projectName: task.projectName,
      projectSlug: task.projectSlug,
      number: task.number,
      title: task.title,
      status: task.status,
      statusName: task.statusName,
      priority: task.priority,
      completada: task.isCompleted,
      esOrden: task.esOrden,
      orderFolio: task.orderFolio,
      orderClosureStatus: task.orderClosureStatus,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      responsable: task.responsable,
    }));

  // Top 5 responsables con más pendientes
  const statsByResponsable = new Map<
    string,
    {
      userId: string;
      name: string;
      grado: string | null;
      componente: string | null;
      unidad: string | null;
      cedula: string | null;
      fotoUrl: string | null;
      insignia: string | null;
      abiertas: number;
      vencidas: number;
      completadas: number;
    }
  >();

  for (const task of enrichedTasks) {
    if (!task.responsable) continue;
    let entry = statsByResponsable.get(task.responsable.userId);
    if (!entry) {
      const created = {
        ...task.responsable,
        abiertas: 0,
        vencidas: 0,
        completadas: 0,
      };
      statsByResponsable.set(task.responsable.userId, created);
      entry = created;
    }
    if (task.isCompleted) {
      entry.completadas += 1;
    } else {
      entry.abiertas += 1;
      if (task.dueDate && task.dueDate < inicioHoyCaracas) {
        entry.vencidas += 1;
      }
    }
  }

  const topResponsables = Array.from(statsByResponsable.values())
    .filter((item) => item.abiertas > 0)
    .sort((a, b) => {
      if (b.abiertas !== a.abiertas) return b.abiertas - a.abiertas;
      if (b.vencidas !== a.vencidas) return b.vencidas - a.vencidas;
      return a.name.localeCompare(b.name, "es-VE");
    })
    .slice(0, MAX_TOP_RESPONSABLES);

  // Actividad compacta (últimos 14 días agrupada por actor + día Caracas)
  const since14Days = new Date(
    inicioHoyCaracas.getTime() - (ACTIVITY_WINDOW_DAYS - 1) * DAY_MS,
  );
  const activityConditions = [
    inArray(taskTable.projectId, projectIds),
    gte(activityTable.createdAt, since14Days),
  ];
  if (restrictedResponsable) {
    activityConditions.push(eq(taskTable.userId, userId));
  }
  if (confTaskFilter) {
    activityConditions.push(confTaskFilter);
  }

  const rawActivities = await db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      createdAt: activityTable.createdAt,
      eventData: activityTable.eventData,
      userId: activityTable.userId,
      userName: userTable.name,
      userImage: userTable.image,
      actorCedula: militarPerfilTable.cedula,
      actorGrado: militarPerfilTable.grado,
      actorComponente: militarPerfilTable.componente,
      actorUnidad: militarPerfilTable.unidad,
      externalUserName: activityTable.externalUserName,
      externalUserAvatar: activityTable.externalUserAvatar,
      taskId: taskTable.id,
      taskTitle: taskTable.title,
      taskNumber: taskTable.number,
      projectId: projectTable.id,
      projectSlug: projectTable.slug,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(activityTable.userId, userTable.id))
    .leftJoin(
      militarPerfilTable,
      eq(activityTable.userId, militarPerfilTable.userId),
    )
    .where(and(...activityConditions))
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(ACTIVITY_SCAN_LIMIT);

  const activities = await redactInaccessibleMoves(userId, rawActivities);

  type ActivityBucket = {
    key: string;
    actorNombre: string;
    actorGrado: string | null;
    actorFotoUrl: string | null;
    actorCedula: string | null;
    actorDisplay: string;
    dia: string;
    ultimaHora: Date;
    ultimaTarea: {
      id: string;
      number: number | null;
      title: string;
      projectId: string;
      projectSlug: string;
    };
    distinctTasks: Set<string>;
    createdTasks: Set<string>;
    createdOrders: Set<string>;
    commentedTasks: Set<string>;
    updatedTasks: Set<string>;
  };

  const buckets = new Map<string, ActivityBucket>();

  for (const row of activities) {
    const actorKey = row.userId
      ? `u:${row.userId}`
      : row.externalUserName
        ? `ext:${row.externalUserName}`
        : "system";
    const dia = toCaracasDayKey(row.createdAt);
    const bucketKey = `${actorKey}::${dia}`;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      const actorNombre = row.userName || row.externalUserName || "Sistema";
      const actorMeta = resolveMilitarySummaryMeta({
        grado: row.actorGrado,
        componente: row.actorComponente,
        unidad: row.actorUnidad,
        cedula: row.actorCedula,
        image: row.userImage ?? row.externalUserAvatar,
      });
      const gradoCorto = abreviarGrado(
        actorMeta.grado,
        row.actorComponente,
        row.actorUnidad,
      );
      const shortName = shortDisplayName(actorNombre) || actorNombre;
      const actorDisplay = gradoCorto
        ? `${gradoCorto} ${shortName}`
        : shortName;

      bucket = {
        key: bucketKey,
        actorNombre,
        actorGrado: actorMeta.grado,
        actorFotoUrl: actorMeta.fotoUrl,
        actorCedula: row.actorCedula ?? null,
        actorDisplay,
        dia,
        ultimaHora: row.createdAt,
        ultimaTarea: {
          id: row.taskId,
          number: row.taskNumber,
          title: row.taskTitle,
          projectId: row.projectId,
          projectSlug: row.projectSlug,
        },
        distinctTasks: new Set(),
        createdTasks: new Set(),
        createdOrders: new Set(),
        commentedTasks: new Set(),
        updatedTasks: new Set(),
      };
      buckets.set(bucketKey, bucket);
    }

    bucket.distinctTasks.add(row.taskId);
    if (
      row.type === "create" ||
      row.type === "created" ||
      row.type === "task"
    ) {
      bucket.createdTasks.add(row.taskId);
      if (orderTaskIds.has(row.taskId)) {
        bucket.createdOrders.add(row.taskId);
      }
    } else if (row.type === "comment") {
      bucket.commentedTasks.add(row.taskId);
    } else {
      bucket.updatedTasks.add(row.taskId);
    }
  }

  const actividadCompacta = Array.from(buckets.values())
    .sort((a, b) => b.ultimaHora.getTime() - a.ultimaHora.getTime())
    .slice(0, MAX_ACTIVIDAD_COMPACTA)
    .map((bucket) => ({
      id: bucket.key,
      actorNombre: bucket.actorNombre,
      actorGrado: bucket.actorGrado,
      actorFotoUrl: bucket.actorFotoUrl,
      actorCedula: bucket.actorCedula,
      dia: bucket.dia,
      resumen: buildCompactActivitySummary({
        actorDisplay: bucket.actorDisplay,
        createTaskCount: bucket.createdTasks.size,
        createOrderCount: bucket.createdOrders.size,
        commentTaskCount: bucket.commentedTasks.size,
        updateTaskCount: bucket.updatedTasks.size,
        totalDistinctTasks: bucket.distinctTasks.size,
      }),
      cantidad: bucket.distinctTasks.size,
      ultimaHora: bucket.ultimaHora,
      ultimaTarea: bucket.ultimaTarea,
    }));

  return {
    usuario,
    kpis: {
      vencidas,
      vencenHoy,
      vencenSemana,
      ordenesPendientes,
      cumplimientoATiempoPct,
      cumplimientoEnPlazo,
      cumplimientoBase,
      totalAbiertas,
      totalCompletadas,
    },
    agendaHoy,
    ordenesRecientes,
    topResponsables,
    actividadCompacta,
  };
}

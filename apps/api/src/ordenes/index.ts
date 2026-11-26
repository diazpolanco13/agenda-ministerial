import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import createActivity from "../activity/controllers/create-activity";
import {
  canAccessConfidentialTask,
  canApproveOrdersInWorkspace,
  canViewConfidentialInWorkspace,
  taskConfidentialitySqlFilter,
} from "../confidentiality/access";
import db from "../database";
import {
  assetTable,
  columnTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";
import { publishEvent } from "../events";
import {
  abreviarGrado,
  resolveMilitarySummaryMeta,
} from "../executive/rank-abbrev";
import assignLabelToTask from "../label/controllers/assign-label-to-task";
import createLabel from "../label/controllers/create-label";
import createNotification from "../notification/controllers/create-notification";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { getSubtaskCounts } from "../task/get-subtask-counts";
import { isRestrictedResponsable } from "../utils/is-restricted-responsable";
import { requireUserSession } from "../utils/require-user-session";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { splitRoles } from "../utils/split-roles";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { allocateOrderFolio, computeOrderSealHash } from "./folio";
import { uploadEvidenceFile } from "./upload-evidence";

const ORDEN_LABEL_COLOR = "#4B5D3A";
const ORDEN_LABEL_NAME = "ORDEN";
const CARACAS_TIMEZONE = "America/Caracas";
const CARACAS_OFFSET = "-04:00";
const DAY_MS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

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

export type OrderSemaforo = "completada" | "rojo" | "amarillo" | "verde";

/**
 * Calcula el semáforo de cumplimiento de una orden según su cierre, columna final y vencimiento.
 */
export function computeOrderSemaforo(params: {
  dueDate: Date | null;
  isFinalColumn: boolean;
  orderClosureStatus: string;
  now?: Date;
}): OrderSemaforo {
  if (params.isFinalColumn || params.orderClosureStatus === "aprobada") {
    return "completada";
  }
  if (!params.dueDate) {
    return "verde";
  }
  const nowMs = (params.now ?? new Date()).getTime();
  const diffMs = params.dueDate.getTime() - nowMs;
  if (diffMs < 0) {
    return "rojo";
  }
  if (diffMs <= FORTY_EIGHT_HOURS_MS) {
    return "amarillo";
  }
  return "verde";
}

/**
 * Calcula el porcentaje de avance de una orden según sus subtareas o su estado de cierre.
 */
export function computeOrderAvancePct(params: {
  subtaskCounts: { completed: number; total: number };
  orderClosureStatus: string;
  isFinalColumn?: boolean;
}): number {
  if (params.subtaskCounts.total > 0) {
    const pct = Math.round(
      (params.subtaskCounts.completed / params.subtaskCounts.total) * 100,
    );
    return Math.max(0, Math.min(100, pct));
  }

  if (params.isFinalColumn || params.orderClosureStatus === "aprobada") {
    return 100;
  }

  switch (params.orderClosureStatus) {
    case "en_revision":
      return 80;
    case "devuelta":
      return 40;
    case "abierta":
    default:
      return 20;
  }
}

function getCaracasDayBounds(now = new Date()) {
  const todayKey = caracasDateFormatter.format(now);
  const startToday = new Date(`${todayKey}T00:00:00${CARACAS_OFFSET}`);
  const endToday = new Date(startToday.getTime() + DAY_MS);
  return { startToday, endToday };
}

function priorityScore(priority: string | null | undefined): number {
  return PRIORITY_WEIGHT[priority ?? "no-priority"] ?? 0;
}

const responsableSchema = z.object({
  userId: z.string(),
  name: z.string(),
  fotoUrl: z.string().nullable(),
  grado: z.string().nullable(),
  gradoCorto: z.string().nullable(),
  insignia: z.string().nullable(),
  componente: z.string().nullable(),
  unidad: z.string().nullable(),
  cedula: z.string().nullable(),
});

const orderItemSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
    projectIcon: z.string().nullable(),
    number: z.number().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    statusName: z.string().nullable(),
    columnId: z.string().nullable(),
    isFinal: z.boolean(),
    priority: z.string(),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    confidentialityLevel: z.string(),
    isOrder: z.boolean(),
    orderFolio: z.string().nullable(),
    orderOrigin: z.string().nullable(),
    orderQuote: z.string().nullable(),
    orderClosureStatus: z.string(),
    orderEvidenceText: z.string().nullable(),
    orderEvidenceAssetId: z.string().nullable(),
    orderEvidenceSubmittedAt: nullableResponseTimestamp,
    orderEvidenceSubmittedBy: z.string().nullable(),
    orderReviewedAt: nullableResponseTimestamp,
    orderReviewedBy: z.string().nullable(),
    orderReviewComment: z.string().nullable(),
    orderSealHash: z.string().nullable(),
    subtaskCounts: z.object({
      completed: z.number().int(),
      total: z.number().int(),
    }),
    semaforo: z.enum(["completada", "rojo", "amarillo", "verde"]),
    avancePct: z.number().int(),
    responsable: responsableSchema.nullable(),
  })
  .openapi("OrderItem");

const listOrdersResponseSchema = z
  .object({
    canApprove: z.boolean(),
    kpis: z.object({
      total: z.number().int(),
      abiertas: z.number().int(),
      enRevision: z.number().int(),
      aprobadas: z.number().int(),
      devueltas: z.number().int(),
      vencidas: z.number().int(),
    }),
    ordenes: z.array(orderItemSchema),
  })
  .openapi("ListOrdersResponse");

const despachoResponseSchema = z
  .object({
    usuario: z.object({
      userId: z.string(),
      name: z.string(),
      grado: z.string().nullable(),
      gradoCorto: z.string().nullable(),
      componente: z.string().nullable(),
      unidad: z.string().nullable(),
      cedula: z.string().nullable(),
      insignia: z.string().nullable(),
      fotoUrl: z.string().nullable(),
      restrictedResponsable: z.boolean(),
    }),
    workspaceName: z.string(),
    canApprove: z.boolean(),
    counts: z.object({
      hoy: z.number().int(),
      requiereVistoBueno: z.number().int(),
      criticasVencidas: z.number().int(),
    }),
    hoy: z.array(orderItemSchema),
    requiereVistoBueno: z.array(orderItemSchema),
    criticasVencidas: z.array(orderItemSchema),
  })
  .openapi("DespachoResponse");

const orderMutationResponseSchema = z
  .object({
    id: z.string(),
    isOrder: z.boolean(),
    orderFolio: z.string().nullable(),
    orderOrigin: z.string().nullable(),
    orderQuote: z.string().nullable(),
    orderClosureStatus: z.string(),
    orderEvidenceText: z.string().nullable(),
    orderEvidenceAssetId: z.string().nullable(),
    orderEvidenceSubmittedAt: nullableResponseTimestamp,
    orderEvidenceSubmittedBy: z.string().nullable(),
    orderReviewedAt: nullableResponseTimestamp,
    orderReviewedBy: z.string().nullable(),
    orderReviewComment: z.string().nullable(),
    orderSealHash: z.string().nullable(),
    status: z.string(),
    columnId: z.string().nullable(),
  })
  .openapi("OrderMutationResponse");

const evidenceUploadResponseSchema = z
  .object({
    assetId: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int(),
    url: z.string(),
  })
  .openapi("OrderEvidenceUploadResponse");

async function loadTaskWithProjectAndVerifyAccess(
  taskId: string,
  userId: string,
  workspaceId: string,
) {
  const [row] = await db
    .select({
      task: taskTable,
      projectConfidentiality: projectTable.confidentialityLevel,
      projectWorkspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!row || row.projectWorkspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Tarea no encontrada." });
  }

  const [hasRoleAccess, restrictedResponsable] = await Promise.all([
    canViewConfidentialInWorkspace(userId, workspaceId),
    isRestrictedResponsable(userId, workspaceId),
  ]);

  if (
    !canAccessConfidentialTask({
      userId,
      taskConfidentiality: row.task.confidentialityLevel,
      projectConfidentiality: row.projectConfidentiality,
      assigneeId: row.task.userId,
      createdBy: row.task.createdBy,
      hasRoleAccess,
    })
  ) {
    throw new HTTPException(403, {
      message: "No tienes acceso a esta orden confidencial.",
    });
  }

  if (restrictedResponsable && row.task.userId !== userId) {
    throw new HTTPException(403, {
      message: "Solo puedes operar sobre las órdenes asignadas a tu cargo.",
    });
  }

  return row.task;
}

async function getActorName(userId: string): Promise<string> {
  const [actor] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return actor?.name ?? "Usuario";
}

function buildResponsableMeta(row: {
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage: string | null;
  assigneeCedula: string | null;
  assigneeGrado: string | null;
  assigneeComponente: string | null;
  assigneeUnidad: string | null;
}) {
  if (!row.assigneeId) return null;
  const meta = resolveMilitarySummaryMeta({
    grado: row.assigneeGrado,
    componente: row.assigneeComponente,
    unidad: row.assigneeUnidad,
    cedula: row.assigneeCedula,
    image: row.assigneeImage,
  });
  return {
    userId: row.assigneeId,
    name: row.assigneeName ?? "Responsable",
    fotoUrl: meta.fotoUrl,
    grado: meta.grado,
    gradoCorto: abreviarGrado(
      meta.grado,
      row.assigneeComponente,
      row.assigneeUnidad,
    ),
    insignia: meta.insignia,
    componente: row.assigneeComponente ?? null,
    unidad: row.assigneeUnidad ?? null,
    cedula: row.assigneeCedula ?? null,
  };
}

async function fetchEnrichedWorkspaceTasks(params: {
  workspaceId: string;
  userId: string;
  onlyOrders: boolean;
  hasRoleAccess: boolean;
  restrictedResponsable: boolean;
  now: Date;
}) {
  const {
    workspaceId,
    userId,
    onlyOrders,
    hasRoleAccess,
    restrictedResponsable,
    now,
  } = params;

  const conditions = [
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    ne(taskTable.status, "archived"),
    projectAccessCondition(userId, projectTable.id),
  ];

  if (onlyOrders) {
    conditions.push(eq(taskTable.isOrder, true));
  }
  if (restrictedResponsable) {
    conditions.push(eq(taskTable.userId, userId));
  }
  const confFilter = taskConfidentialitySqlFilter(userId, hasRoleAccess);
  if (confFilter) {
    conditions.push(confFilter);
  }

  const rawRows = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      projectIcon: projectTable.icon,
      number: taskTable.number,
      title: taskTable.title,
      description: taskTable.description,
      status: taskTable.status,
      columnId: taskTable.columnId,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      updatedAt: taskTable.updatedAt,
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
      assigneeId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeImage: userTable.image,
      assigneeCedula: militarPerfilTable.cedula,
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
    .where(and(...conditions));

  if (rawRows.length === 0) {
    return [];
  }

  const projectIds = [...new Set(rawRows.map((row) => row.projectId))];
  const taskIds = rawRows.map((row) => row.id);

  const [columns, subtaskCountsMap] = await Promise.all([
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
    getSubtaskCounts(
      db as unknown as Parameters<typeof getSubtaskCounts>[0],
      taskIds,
      workspaceId,
      false,
      userId,
    ),
  ]);

  const columnById = new Map(columns.map((col) => [col.id, col]));
  const columnByProjectSlug = new Map<string, (typeof columns)[number]>();
  for (const col of columns) {
    const key = `${col.projectId}::${col.slug}`;
    if (!columnByProjectSlug.has(key)) {
      columnByProjectSlug.set(key, col);
    }
  }

  return rawRows.map((row) => {
    const column =
      (row.columnId ? columnById.get(row.columnId) : undefined) ??
      columnByProjectSlug.get(`${row.projectId}::${row.status}`);
    const isFinalColumn = column
      ? column.isFinal
      : row.status === "done" || row.status === "completed";
    const subtaskCounts = subtaskCountsMap.get(row.id) ?? {
      completed: 0,
      total: 0,
    };
    const semaforo = computeOrderSemaforo({
      dueDate: row.dueDate,
      isFinalColumn,
      orderClosureStatus: row.orderClosureStatus,
      now,
    });
    const avancePct = computeOrderAvancePct({
      subtaskCounts,
      orderClosureStatus: row.orderClosureStatus,
      isFinalColumn,
    });

    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.projectName,
      projectSlug: row.projectSlug,
      projectIcon: row.projectIcon ?? null,
      number: row.number ?? null,
      title: row.title,
      description: row.description ?? null,
      status: row.status,
      statusName: column?.name ?? null,
      columnId: row.columnId ?? null,
      isFinal: isFinalColumn,
      priority: row.priority,
      startDate: row.startDate ?? null,
      dueDate: row.dueDate ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      confidentialityLevel: row.confidentialityLevel,
      isOrder: row.isOrder,
      orderFolio: row.orderFolio ?? null,
      orderOrigin: row.orderOrigin ?? null,
      orderQuote: row.orderQuote ?? null,
      orderClosureStatus: row.orderClosureStatus,
      orderEvidenceText: row.orderEvidenceText ?? null,
      orderEvidenceAssetId: row.orderEvidenceAssetId ?? null,
      orderEvidenceSubmittedAt: row.orderEvidenceSubmittedAt ?? null,
      orderEvidenceSubmittedBy: row.orderEvidenceSubmittedBy ?? null,
      orderReviewedAt: row.orderReviewedAt ?? null,
      orderReviewedBy: row.orderReviewedBy ?? null,
      orderReviewComment: row.orderReviewComment ?? null,
      orderSealHash: row.orderSealHash ?? null,
      subtaskCounts,
      semaforo,
      avancePct,
      responsable: buildResponsableMeta(row),
    };
  });
}

const listOrdersRoute = createRoute({
  method: "get",
  operationId: "listarOrdenes",
  path: "/",
  tags: ["Ordenes"],
  summary: "Listar órdenes del espacio de trabajo",
  middleware: [
    requireUserSession,
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: {
    query: z.object({
      workspaceId: z.string().min(1),
      closureStatus: z
        .enum(["abierta", "en_revision", "aprobada", "devuelta"])
        .optional(),
      origin: z
        .enum(["discurso", "audiencia", "verbal", "escrita"])
        .optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: jsonResponse("Listado de órdenes y KPIs", listOrdersResponseSchema),
    403: errorResponse("Permisos insuficientes"),
  },
});

const despachoRoute = createRoute({
  method: "get",
  operationId: "obtenerDespacho",
  path: "/despacho",
  tags: ["Ordenes"],
  summary: "Vista ejecutiva de despacho (Hoy, Visto Bueno, Críticas/Vencidas)",
  middleware: [
    requireUserSession,
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: {
    query: z.object({
      workspaceId: z.string().min(1),
    }),
  },
  responses: {
    200: jsonResponse("Bandeja de despacho", despachoResponseSchema),
    403: errorResponse("Permisos insuficientes"),
  },
});

const marcarOrdenRoute = createRoute({
  method: "post",
  operationId: "marcarTareaComoOrden",
  path: "/{taskId}/marcar",
  tags: ["Ordenes"],
  summary: "Marcar tarea como orden oficial con folio secuencial",
  middleware: [
    requireUserSession,
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: z.object({ taskId: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            origin: z.enum(["discurso", "audiencia", "verbal", "escrita"]),
            quote: z.string().max(2000).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Tarea marcada como orden", orderMutationResponseSchema),
    400: errorResponse("Solicitud inválida"),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Tarea no encontrada"),
  },
});

const subirEvidenciaArchivoRoute = createRoute({
  method: "post",
  operationId: "subirArchivoEvidenciaOrden",
  path: "/{taskId}/evidencia-archivo",
  tags: ["Ordenes"],
  summary: "Subir archivo de evidencia de cumplimiento a S3",
  description:
    "Recibe multipart/form-data con el campo 'file' (hasta 15 MB) y lo sube a S3.",
  middleware: [
    requireUserSession,
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: z.object({ taskId: z.string().min(1) }),
  },
  responses: {
    200: jsonResponse("Archivo de evidencia subido", evidenceUploadResponseSchema),
    400: errorResponse("Archivo inválido o ausente"),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Tarea no encontrada"),
    503: errorResponse("Almacenamiento S3 no configurado"),
  },
});

const enviarEvidenciaRoute = createRoute({
  method: "post",
  operationId: "enviarEvidenciaOrden",
  path: "/{taskId}/evidencia",
  tags: ["Ordenes"],
  summary: "Enviar evidencia de cumplimiento de orden para visto bueno",
  middleware: [
    requireUserSession,
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: z.object({ taskId: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            evidenceText: z.string().max(10_000).nullable().optional(),
            evidenceAssetId: z.string().min(1).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Evidencia registrada y enviada a revisión", orderMutationResponseSchema),
    400: errorResponse("Datos de evidencia inválidos o la tarea no es una orden"),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Tarea no encontrada"),
  },
});

const vistoBuenoRoute = createRoute({
  method: "post",
  operationId: "otorgarVistoBuenoOrden",
  path: "/{taskId}/visto-bueno",
  tags: ["Ordenes"],
  summary: "Aprobar cierre de orden con sello SHA-256",
  middleware: [
    requireUserSession,
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: z.object({ taskId: z.string().min(1) }),
    body: {
      required: false,
      content: {
        "application/json": {
          schema: z.object({
            comment: z.string().max(4000).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Orden aprobada con visto bueno", orderMutationResponseSchema),
    400: errorResponse("La tarea no es una orden"),
    403: errorResponse("No autorizado para otorgar visto bueno"),
    404: errorResponse("Tarea no encontrada"),
  },
});

const devolverOrdenRoute = createRoute({
  method: "post",
  operationId: "devolverOrden",
  path: "/{taskId}/devolver",
  tags: ["Ordenes"],
  summary: "Devolver orden para corrección con motivo y sello SHA-256",
  middleware: [
    requireUserSession,
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: z.object({ taskId: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            comment: z.string().trim().min(3).max(4000),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Orden devuelta para corrección", orderMutationResponseSchema),
    400: errorResponse("Comentario inválido o la tarea no es una orden"),
    403: errorResponse("No autorizado para devolver órdenes"),
    404: errorResponse("Tarea no encontrada"),
  },
});

export const ordenes = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listOrdersRoute, async (c) => {
    const { workspaceId, closureStatus, origin, search } = c.req.valid("query");
    const userId = c.get("userId");
    const now = new Date();

    const [canApprove, restrictedResponsable] = await Promise.all([
      canApproveOrdersInWorkspace(userId, workspaceId),
      isRestrictedResponsable(userId, workspaceId),
    ]);

    const allOrders = await fetchEnrichedWorkspaceTasks({
      workspaceId,
      userId,
      onlyOrders: true,
      hasRoleAccess: canApprove,
      restrictedResponsable,
      now,
    });

    const kpis = {
      total: allOrders.length,
      abiertas: 0,
      enRevision: 0,
      aprobadas: 0,
      devueltas: 0,
      vencidas: 0,
    };

    for (const order of allOrders) {
      if (order.orderClosureStatus === "abierta") kpis.abiertas += 1;
      else if (order.orderClosureStatus === "en_revision")
        kpis.enRevision += 1;
      else if (order.orderClosureStatus === "aprobada") kpis.aprobadas += 1;
      else if (order.orderClosureStatus === "devuelta") kpis.devueltas += 1;

      if (order.semaforo === "rojo") {
        kpis.vencidas += 1;
      }
    }

    const searchTerm = search?.trim().toLowerCase() ?? "";
    const filtered = allOrders
      .filter((order) => {
        if (closureStatus && order.orderClosureStatus !== closureStatus) {
          return false;
        }
        if (origin && order.orderOrigin !== origin) {
          return false;
        }
        if (searchTerm) {
          const haystack = [
            order.title,
            order.orderFolio,
            order.orderQuote,
            order.description,
            order.projectName,
            order.responsable?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(searchTerm)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const aDone = a.isFinal || a.orderClosureStatus === "aprobada";
        const bDone = b.isFinal || b.orderClosureStatus === "aprobada";
        if (aDone !== bDone) return aDone ? 1 : -1;

        const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        if (aDue !== bDue) return aDue - bDue;

        const prioDiff = priorityScore(b.priority) - priorityScore(a.priority);
        if (prioDiff !== 0) return prioDiff;

        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    return c.json(
      {
        canApprove,
        kpis,
        ordenes: filtered,
      },
      200,
    );
  })
  .openapi(despachoRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    const userId = c.get("userId");
    const now = new Date();

    const [
      canApprove,
      restrictedResponsable,
      [currentUserRow],
      [workspaceRow],
    ] = await Promise.all([
      canApproveOrdersInWorkspace(userId, workspaceId),
      isRestrictedResponsable(userId, workspaceId),
      db
        .select({
          userId: userTable.id,
          name: userTable.name,
          image: userTable.image,
          cedula: militarPerfilTable.cedula,
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
        .select({ name: workspaceTable.name })
        .from(workspaceTable)
        .where(eq(workspaceTable.id, workspaceId))
        .limit(1),
    ]);

    const userMeta = resolveMilitarySummaryMeta({
      grado: currentUserRow?.grado,
      componente: currentUserRow?.componente,
      unidad: currentUserRow?.unidad,
      cedula: currentUserRow?.cedula,
      image: currentUserRow?.image,
    });

    const usuario = {
      userId,
      name: currentUserRow?.name ?? "Usuario",
      grado: userMeta.grado,
      gradoCorto: abreviarGrado(
        userMeta.grado,
        currentUserRow?.componente,
        currentUserRow?.unidad,
      ),
      componente: currentUserRow?.componente ?? null,
      unidad: currentUserRow?.unidad ?? null,
      cedula: currentUserRow?.cedula ?? null,
      insignia: userMeta.insignia,
      fotoUrl: userMeta.fotoUrl,
      restrictedResponsable,
    };

    const tasks = await fetchEnrichedWorkspaceTasks({
      workspaceId,
      userId,
      onlyOrders: false,
      hasRoleAccess: canApprove,
      restrictedResponsable,
      now,
    });

    const { startToday, endToday } = getCaracasDayBounds(now);
    const isTodayCaracas = (date: Date | null) =>
      date !== null && date >= startToday && date < endToday;

    const hoy = tasks
      .filter(
        (task) => isTodayCaracas(task.dueDate) || isTodayCaracas(task.startDate),
      )
      .sort((a, b) => {
        const aDone = a.isFinal || a.orderClosureStatus === "aprobada";
        const bDone = b.isFinal || b.orderClosureStatus === "aprobada";
        if (aDone !== bDone) return aDone ? 1 : -1;
        const prioDiff = priorityScore(b.priority) - priorityScore(a.priority);
        if (prioDiff !== 0) return prioDiff;
        const aTime = (a.dueDate ?? a.startDate)?.getTime() ?? 0;
        const bTime = (b.dueDate ?? b.startDate)?.getTime() ?? 0;
        return aTime - bTime;
      });

    const requiereVistoBueno = tasks
      .filter(
        (task) => task.isOrder && task.orderClosureStatus === "en_revision",
      )
      .sort((a, b) => {
        const aSub = a.orderEvidenceSubmittedAt?.getTime() ?? 0;
        const bSub = b.orderEvidenceSubmittedAt?.getTime() ?? 0;
        if (aSub !== bSub) return bSub - aSub;
        const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        return aDue - bDue;
      });

    const criticasVencidas = tasks
      .filter((task) => {
        const isClosed = task.isFinal || task.orderClosureStatus === "aprobada";
        if (isClosed) return false;
        const isOverdue =
          task.dueDate !== null && task.dueDate.getTime() < now.getTime();
        const isCriticalPriority =
          task.priority === "urgent" || task.priority === "high";
        return isOverdue || isCriticalPriority;
      })
      .sort((a, b) => {
        const aOverdue =
          a.dueDate !== null && a.dueDate.getTime() < now.getTime();
        const bOverdue =
          b.dueDate !== null && b.dueDate.getTime() < now.getTime();
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        const prioDiff = priorityScore(b.priority) - priorityScore(a.priority);
        if (prioDiff !== 0) return prioDiff;
        const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        return aDue - bDue;
      });

    return c.json(
      {
        usuario,
        workspaceName: workspaceRow?.name ?? "Despacho",
        canApprove,
        counts: {
          hoy: hoy.length,
          requiereVistoBueno: requiereVistoBueno.length,
          criticasVencidas: criticasVencidas.length,
        },
        hoy,
        requiereVistoBueno,
        criticasVencidas,
      },
      200,
    );
  })
  .openapi(marcarOrdenRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const workspaceId = c.get("workspaceId") as string;

    const existingTask = await loadTaskWithProjectAndVerifyAccess(
      taskId,
      userId,
      workspaceId,
    );

    const quoteClean = body.quote?.trim() || null;

    const updatedTask = await db.transaction(async (tx) => {
      const orderFolio =
        existingTask.orderFolio ??
        (await allocateOrderFolio(workspaceId, undefined, tx));

      const [updated] = await tx
        .update(taskTable)
        .set({
          isOrder: true,
          orderFolio,
          orderOrigin: body.origin,
          orderQuote: quoteClean ?? existingTask.orderQuote,
        })
        .where(eq(taskTable.id, taskId))
        .returning();

      return updated;
    });

    if (!updatedTask) {
      throw new HTTPException(404, { message: "Tarea no encontrada." });
    }

    const ordenLabel = await createLabel(
      ORDEN_LABEL_NAME,
      ORDEN_LABEL_COLOR,
      undefined,
      workspaceId,
      userId,
    );
    await assignLabelToTask(ordenLabel.id, taskId, userId);

    await createActivity(
      taskId,
      "orden_creada",
      userId,
      `Marcada como orden (${updatedTask.orderFolio ?? updatedTask.title})`,
      {
        folio: updatedTask.orderFolio,
        origin: body.origin,
        quote: updatedTask.orderQuote,
      },
    );

    await publishEvent("task.updated", {
      taskId,
      projectId: updatedTask.projectId,
      userId,
      type: "order_marked",
      folio: updatedTask.orderFolio,
    });

    return c.json(
      {
        id: updatedTask.id,
        isOrder: updatedTask.isOrder,
        orderFolio: updatedTask.orderFolio,
        orderOrigin: updatedTask.orderOrigin,
        orderQuote: updatedTask.orderQuote,
        orderClosureStatus: updatedTask.orderClosureStatus,
        orderEvidenceText: updatedTask.orderEvidenceText,
        orderEvidenceAssetId: updatedTask.orderEvidenceAssetId,
        orderEvidenceSubmittedAt: updatedTask.orderEvidenceSubmittedAt,
        orderEvidenceSubmittedBy: updatedTask.orderEvidenceSubmittedBy,
        orderReviewedAt: updatedTask.orderReviewedAt,
        orderReviewedBy: updatedTask.orderReviewedBy,
        orderReviewComment: updatedTask.orderReviewComment,
        orderSealHash: updatedTask.orderSealHash,
        status: updatedTask.status,
        columnId: updatedTask.columnId,
      },
      200,
    );
  })
  .openapi(subirEvidenciaArchivoRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const userId = c.get("userId");
    const workspaceId = c.get("workspaceId") as string;

    const existingTask = await loadTaskWithProjectAndVerifyAccess(
      taskId,
      userId,
      workspaceId,
    );

    const parsedBody = await c.req.parseBody();
    const rawFile = parsedBody.file;
    if (!(rawFile instanceof File)) {
      throw new HTTPException(400, {
        message: "Debes adjuntar un archivo válido en el campo 'file'.",
      });
    }

    const uploaded = await uploadEvidenceFile({
      file: rawFile,
      workspaceId,
      projectId: existingTask.projectId,
      taskId: existingTask.id,
      userId,
    });

    return c.json(uploaded, 200);
  })
  .openapi(enviarEvidenciaRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const workspaceId = c.get("workspaceId") as string;

    const existingTask = await loadTaskWithProjectAndVerifyAccess(
      taskId,
      userId,
      workspaceId,
    );

    if (!existingTask.isOrder) {
      throw new HTTPException(400, {
        message: "La tarea debe estar marcada como orden para enviar evidencia.",
      });
    }

    const cleanText = body.evidenceText?.trim() || null;
    const cleanAssetId = body.evidenceAssetId?.trim() || null;

    if (!cleanText && !cleanAssetId) {
      throw new HTTPException(400, {
        message:
          "Debes proporcionar una descripción de cumplimiento o adjuntar un archivo de evidencia.",
      });
    }

    if (cleanAssetId) {
      const [asset] = await db
        .select({
          id: assetTable.id,
          workspaceId: assetTable.workspaceId,
          projectId: assetTable.projectId,
          taskId: assetTable.taskId,
        })
        .from(assetTable)
        .where(eq(assetTable.id, cleanAssetId))
        .limit(1);

      if (
        !asset ||
        asset.workspaceId !== workspaceId ||
        asset.projectId !== existingTask.projectId ||
        (asset.taskId !== null && asset.taskId !== taskId)
      ) {
        throw new HTTPException(400, {
          message:
            "El archivo de evidencia no pertenece a esta orden o proyecto.",
        });
      }
    }

    const submittedAt = new Date();
    const sealHash = computeOrderSealHash({
      folio: existingTask.orderFolio,
      taskId,
      action: "evidencia",
      actorUserId: userId,
      timestampIso: submittedAt.toISOString(),
      evidenceText: cleanText,
      evidenceAssetId: cleanAssetId,
    });

    const [updatedTask] = await db
      .update(taskTable)
      .set({
        orderClosureStatus: "en_revision",
        orderEvidenceText: cleanText,
        orderEvidenceAssetId: cleanAssetId,
        orderEvidenceSubmittedAt: submittedAt,
        orderEvidenceSubmittedBy: userId,
        orderSealHash: sealHash,
      })
      .where(eq(taskTable.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new HTTPException(404, { message: "Tarea no encontrada." });
    }

    const actorName = await getActorName(userId);

    await createActivity(
      taskId,
      "orden_evidencia",
      userId,
      cleanText ?? "Evidencia de cumplimiento enviada a revisión",
      {
        folio: existingTask.orderFolio,
        sealHash,
        actorName,
        submittedAt: submittedAt.toISOString(),
        evidenceAssetId: cleanAssetId,
        evidenceText: cleanText,
      },
    );

    const workspaceMembers = await db
      .select({
        userId: workspaceUserTable.userId,
        role: workspaceUserTable.role,
      })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.workspaceId, workspaceId));

    const reviewerIds = new Set<string>();
    for (const member of workspaceMembers) {
      if (member.userId === userId) continue;
      const roles = splitRoles(member.role);
      if (roles.includes("ministro") || roles.includes("jefe_despacho")) {
        reviewerIds.add(member.userId);
      }
    }

    for (const reviewerId of reviewerIds) {
      await createNotification({
        userId: reviewerId,
        type: "order_review_requested",
        title: "Orden lista para visto bueno",
        content: `${actorName} envió evidencia de cumplimiento para ${existingTask.orderFolio ?? existingTask.title}.`,
        eventData: {
          taskTitle: existingTask.title,
          folio: existingTask.orderFolio,
          sealHash,
          actorName,
          projectId: existingTask.projectId,
          workspaceId,
        },
        resourceId: taskId,
        resourceType: "task",
      });
    }

    await publishEvent("task.updated", {
      taskId,
      projectId: existingTask.projectId,
      userId,
      type: "order_evidence_submitted",
    });

    return c.json(
      {
        id: updatedTask.id,
        isOrder: updatedTask.isOrder,
        orderFolio: updatedTask.orderFolio,
        orderOrigin: updatedTask.orderOrigin,
        orderQuote: updatedTask.orderQuote,
        orderClosureStatus: updatedTask.orderClosureStatus,
        orderEvidenceText: updatedTask.orderEvidenceText,
        orderEvidenceAssetId: updatedTask.orderEvidenceAssetId,
        orderEvidenceSubmittedAt: updatedTask.orderEvidenceSubmittedAt,
        orderEvidenceSubmittedBy: updatedTask.orderEvidenceSubmittedBy,
        orderReviewedAt: updatedTask.orderReviewedAt,
        orderReviewedBy: updatedTask.orderReviewedBy,
        orderReviewComment: updatedTask.orderReviewComment,
        orderSealHash: updatedTask.orderSealHash,
        status: updatedTask.status,
        columnId: updatedTask.columnId,
      },
      200,
    );
  })
  .openapi(vistoBuenoRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const userId = c.get("userId");
    const workspaceId = c.get("workspaceId") as string;

    const existingTask = await loadTaskWithProjectAndVerifyAccess(
      taskId,
      userId,
      workspaceId,
    );

    const allowed = await canApproveOrdersInWorkspace(userId, workspaceId);
    if (!allowed) {
      throw new HTTPException(403, {
        message:
          "Solo el Ministro, Jefe de Despacho o Administrador puede otorgar el visto bueno.",
      });
    }

    if (!existingTask.isOrder) {
      throw new HTTPException(400, {
        message: "La tarea no está marcada como orden.",
      });
    }

    const rawBody = (await c.req.json().catch(() => ({}))) as {
      comment?: string | null;
    };
    const cleanComment =
      typeof rawBody?.comment === "string" ? rawBody.comment.trim() || null : null;

    const reviewedAt = new Date();
    const sealHash = computeOrderSealHash({
      folio: existingTask.orderFolio,
      taskId,
      action: "visto_bueno",
      actorUserId: userId,
      timestampIso: reviewedAt.toISOString(),
      evidenceText: existingTask.orderEvidenceText,
      evidenceAssetId: existingTask.orderEvidenceAssetId,
      comment: cleanComment,
    });

    const projectColumns = await db
      .select()
      .from(columnTable)
      .where(eq(columnTable.projectId, existingTask.projectId))
      .orderBy(asc(columnTable.position), asc(columnTable.createdAt));

    const finalColumn =
      projectColumns.find((col) => col.isFinal) ??
      projectColumns.find((col) => col.slug === "done") ??
      null;
    const nextStatus = finalColumn?.slug ?? "done";
    const nextColumnId = finalColumn?.id ?? existingTask.columnId;

    const [updatedTask] = await db
      .update(taskTable)
      .set({
        orderClosureStatus: "aprobada",
        orderReviewedAt: reviewedAt,
        orderReviewedBy: userId,
        orderReviewComment: cleanComment,
        orderSealHash: sealHash,
        status: nextStatus,
        columnId: nextColumnId,
      })
      .where(eq(taskTable.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new HTTPException(404, { message: "Tarea no encontrada." });
    }

    const actorName = await getActorName(userId);

    await createActivity(
      taskId,
      "orden_visto_bueno",
      userId,
      cleanComment ??
        `Visto bueno otorgado (${existingTask.orderFolio ?? existingTask.title})`,
      {
        folio: existingTask.orderFolio,
        sealHash,
        actorName,
        reviewedAt: reviewedAt.toISOString(),
        comment: cleanComment,
      },
    );

    if (existingTask.userId && existingTask.userId !== userId) {
      await createNotification({
        userId: existingTask.userId,
        type: "order_approved",
        title: "Orden aprobada",
        content: `${actorName} otorgó visto bueno a ${existingTask.orderFolio ?? existingTask.title}.`,
        eventData: {
          taskTitle: existingTask.title,
          folio: existingTask.orderFolio,
          sealHash,
          actorName,
          comment: cleanComment,
          projectId: existingTask.projectId,
          workspaceId,
        },
        resourceId: taskId,
        resourceType: "task",
      });
    }

    if (existingTask.status !== nextStatus) {
      await publishEvent("task.status_changed", {
        taskId,
        projectId: existingTask.projectId,
        userId,
        title: existingTask.title,
        oldStatus: existingTask.status,
        newStatus: nextStatus,
        assigneeId: existingTask.userId,
        type: "status_changed",
      });
    }

    await publishEvent("task.updated", {
      taskId,
      projectId: existingTask.projectId,
      userId,
      type: "order_approved",
    });

    return c.json(
      {
        id: updatedTask.id,
        isOrder: updatedTask.isOrder,
        orderFolio: updatedTask.orderFolio,
        orderOrigin: updatedTask.orderOrigin,
        orderQuote: updatedTask.orderQuote,
        orderClosureStatus: updatedTask.orderClosureStatus,
        orderEvidenceText: updatedTask.orderEvidenceText,
        orderEvidenceAssetId: updatedTask.orderEvidenceAssetId,
        orderEvidenceSubmittedAt: updatedTask.orderEvidenceSubmittedAt,
        orderEvidenceSubmittedBy: updatedTask.orderEvidenceSubmittedBy,
        orderReviewedAt: updatedTask.orderReviewedAt,
        orderReviewedBy: updatedTask.orderReviewedBy,
        orderReviewComment: updatedTask.orderReviewComment,
        orderSealHash: updatedTask.orderSealHash,
        status: updatedTask.status,
        columnId: updatedTask.columnId,
      },
      200,
    );
  })
  .openapi(devolverOrdenRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const workspaceId = c.get("workspaceId") as string;

    const existingTask = await loadTaskWithProjectAndVerifyAccess(
      taskId,
      userId,
      workspaceId,
    );

    const allowed = await canApproveOrdersInWorkspace(userId, workspaceId);
    if (!allowed) {
      throw new HTTPException(403, {
        message:
          "Solo el Ministro, Jefe de Despacho o Administrador puede devolver una orden.",
      });
    }

    if (!existingTask.isOrder) {
      throw new HTTPException(400, {
        message: "La tarea no está marcada como orden.",
      });
    }

    const cleanComment = body.comment.trim();
    const reviewedAt = new Date();
    const sealHash = computeOrderSealHash({
      folio: existingTask.orderFolio,
      taskId,
      action: "devolver",
      actorUserId: userId,
      timestampIso: reviewedAt.toISOString(),
      evidenceText: existingTask.orderEvidenceText,
      evidenceAssetId: existingTask.orderEvidenceAssetId,
      comment: cleanComment,
    });

    const projectColumns = await db
      .select()
      .from(columnTable)
      .where(eq(columnTable.projectId, existingTask.projectId))
      .orderBy(asc(columnTable.position), asc(columnTable.createdAt));

    const currentColumn =
      projectColumns.find((col) => col.id === existingTask.columnId) ??
      projectColumns.find((col) => col.slug === existingTask.status);
    const isInFinalColumn = currentColumn
      ? currentColumn.isFinal
      : existingTask.status === "done" || existingTask.status === "completed";

    let nextStatus = existingTask.status;
    let nextColumnId = existingTask.columnId;
    if (isInFinalColumn) {
      const nonFinalColumns = projectColumns.filter((col) => !col.isFinal);
      const targetColumn =
        nonFinalColumns.find((col) => col.slug === "in-progress") ??
        nonFinalColumns.find((col) => col.slug === "to-do") ??
        nonFinalColumns[0] ??
        null;
      nextStatus = targetColumn?.slug ?? "in-progress";
      nextColumnId = targetColumn?.id ?? null;
    }

    const [updatedTask] = await db
      .update(taskTable)
      .set({
        orderClosureStatus: "devuelta",
        orderReviewedAt: reviewedAt,
        orderReviewedBy: userId,
        orderReviewComment: cleanComment,
        orderSealHash: sealHash,
        status: nextStatus,
        columnId: nextColumnId,
      })
      .where(eq(taskTable.id, taskId))
      .returning();

    if (!updatedTask) {
      throw new HTTPException(404, { message: "Tarea no encontrada." });
    }

    const actorName = await getActorName(userId);

    await createActivity(taskId, "orden_devuelta", userId, cleanComment, {
      folio: existingTask.orderFolio,
      sealHash,
      actorName,
      reviewedAt: reviewedAt.toISOString(),
      comment: cleanComment,
    });

    if (existingTask.userId && existingTask.userId !== userId) {
      await createNotification({
        userId: existingTask.userId,
        type: "order_returned",
        title: "Orden devuelta para corrección",
        content: `${actorName} devolvió ${existingTask.orderFolio ?? existingTask.title}: ${cleanComment}`,
        eventData: {
          taskTitle: existingTask.title,
          folio: existingTask.orderFolio,
          sealHash,
          actorName,
          comment: cleanComment,
          projectId: existingTask.projectId,
          workspaceId,
        },
        resourceId: taskId,
        resourceType: "task",
      });
    }

    if (existingTask.status !== nextStatus) {
      await publishEvent("task.status_changed", {
        taskId,
        projectId: existingTask.projectId,
        userId,
        title: existingTask.title,
        oldStatus: existingTask.status,
        newStatus: nextStatus,
        assigneeId: existingTask.userId,
        type: "status_changed",
      });
    }

    await publishEvent("task.updated", {
      taskId,
      projectId: existingTask.projectId,
      userId,
      type: "order_returned",
    });

    return c.json(
      {
        id: updatedTask.id,
        isOrder: updatedTask.isOrder,
        orderFolio: updatedTask.orderFolio,
        orderOrigin: updatedTask.orderOrigin,
        orderQuote: updatedTask.orderQuote,
        orderClosureStatus: updatedTask.orderClosureStatus,
        orderEvidenceText: updatedTask.orderEvidenceText,
        orderEvidenceAssetId: updatedTask.orderEvidenceAssetId,
        orderEvidenceSubmittedAt: updatedTask.orderEvidenceSubmittedAt,
        orderEvidenceSubmittedBy: updatedTask.orderEvidenceSubmittedBy,
        orderReviewedAt: updatedTask.orderReviewedAt,
        orderReviewedBy: updatedTask.orderReviewedBy,
        orderReviewComment: updatedTask.orderReviewComment,
        orderSealHash: updatedTask.orderSealHash,
        status: updatedTask.status,
        columnId: updatedTask.columnId,
      },
      200,
    );
  });

export default ordenes;

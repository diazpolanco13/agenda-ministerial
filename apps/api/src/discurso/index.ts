import { and, desc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  combineGradoNombre,
  generateActaPdf,
} from "../acta-pdf/generate-acta-pdf";
import createActivity from "../activity/controllers/create-activity";
import { adminAuditRequest } from "../admin/audit/admin-audit-request";
import db from "../database";
import {
  discursoBorradorTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
} from "../database/schema";
import { ApiError } from "../errors/api-error";
import assignLabelToTask from "../label/controllers/assign-label-to-task";
import createLabel from "../label/controllers/create-label";
import createNotification from "../notification/controllers/create-notification";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { allocateOrderFolio } from "../ordenes/folio";
import { assertProjectAccess } from "../project-access/assert-project-access";
import { SigefanbUnavailableError } from "../sigefanb/pools";
import { provisionarResponsable } from "../sigefanb/provisionar-responsable";
import createTask from "../task/controllers/create-task";
import { requireUserSession } from "../utils/require-user-session";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { obtenerDiscursoEjemplo } from "./ejemplo";
import { extraerOrdenesConLlm } from "./extractor-llm";
import { resolverResponsablesOrdenes } from "./resolver-responsables";
import { normalizarTranscripcion } from "./transcript-parser";
import type { DiscursoOrdenBorrador } from "./types";

const ORDEN_LABEL_COLOR = "#4B5D3A";
const ORDEN_LABEL_NAME = "ORDEN";

const candidatoSchema = z.object({
  cedula: z.string(),
  nacionalidad: z.enum(["V", "E"]),
  nombreCompleto: z.string(),
  grado: z.string(),
  componente: z.enum(["EJB", "ARB", "AMB", "GNB", "MIL"]).nullable(),
  unidad: z.string().nullable(),
  sexo: z.string().nullable(),
  insignia: z.string().nullable(),
  fotoUrl: z.string(),
  score: z.number(),
  motivo: z.string(),
});

const pistasSchema = z.object({
  grado: z.string().nullable(),
  componente: z.string().nullable(),
  apellido: z.string().nullable(),
  nombre: z.string().nullable(),
});

const ordenSchema = z.object({
  id: z.string(),
  seleccionada: z.boolean(),
  titulo: z.string().trim().min(1).max(300),
  descripcion: z.string().max(4000),
  proyectoId: z.string().nullable(),
  responsableMencionado: z.string(),
  pistas: pistasSchema,
  asignacionModo: z.enum(["auto", "sugerido", "manual", "sin_responsable"]),
  responsableCedula: z.string().nullable(),
  responsableUserId: z.string().nullable(),
  candidatos: z.array(candidatoSchema),
  plazo: z.string().nullable(),
  plazoTexto: z.string().nullable(),
  prioridad: z.enum(["no-priority", "low", "medium", "high", "urgent"]),
  citaTextual: z.string(),
  confianza: z.number(),
  folio: z.string().nullable().optional(),
  createdTaskId: z.string().nullable().optional(),
});

const borradorSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    createdBy: z.string(),
    titulo: z.string(),
    fuenteTipo: z.string(),
    fuenteReferencia: z.string().nullable(),
    fechaDiscurso: nullableResponseTimestamp,
    textoOriginal: z.string(),
    motorUsado: z.string(),
    estado: z.string(),
    ordenes: z.array(ordenSchema),
    asistentes: z.array(z.string()).optional(),
    tareasCreadas: z.number(),
    aprobadoEn: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("DiscursoBorrador");

const extraerResponseSchema = z
  .object({
    borrador: borradorSchema,
    motorUsado: z.enum(["ollama", "reglas"]),
    fallbackMotivo: z.string().optional(),
  })
  .openapi("DiscursoExtraerResponse");

const ejemploResponseSchema = z
  .object({
    titulo: z.string(),
    fechaDiscurso: z.string(),
    texto: z.string(),
  })
  .openapi("DiscursoEjemploResponse");

const aprobarResponseSchema = z
  .object({
    tareasCreadas: z.number(),
    tareas: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        projectId: z.string(),
        number: z.number().nullable(),
        userId: z.string().nullable(),
        priority: z.string().nullable(),
        dueDate: nullableResponseTimestamp,
      }),
    ),
    borrador: borradorSchema,
  })
  .openapi("DiscursoAprobarResponse");

function parseFechaDiscurso(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T12:00:00-04:00`
    : trimmed;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new HTTPException(400, { message: "Fecha del discurso inválida" });
  }
  return date;
}

function parseDueDate(plazo: string | null): Date | undefined {
  if (!plazo?.trim()) return undefined;
  const trimmed = plazo.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T17:00:00-04:00`
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new HTTPException(400, {
      message: `Fecha límite inválida: ${trimmed}`,
    });
  }
  return parsed;
}

function formatFechaDisplay(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

async function getBorradorWithAccess(
  c: Parameters<typeof hasWorkspacePermission>[0],
  id: string,
  permissions: { task: string[] },
) {
  const [borrador] = await db
    .select()
    .from(discursoBorradorTable)
    .where(eq(discursoBorradorTable.id, id))
    .limit(1);

  if (!borrador) {
    throw new HTTPException(404, { message: "Borrador no encontrado" });
  }

  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  await validateWorkspaceAccess(userId, borrador.workspaceId, apiKey?.id);

  const allowed = await hasWorkspacePermission(
    c,
    permissions,
    borrador.workspaceId,
  );
  if (!allowed) {
    throw new ApiError(403, {
      message: "Permisos insuficientes para operar sobre este borrador",
      code: "MISSING_PERMISSION",
      missingPermissions: permissions.task.map((action) => `task:${action}`),
    });
  }

  return borrador;
}

const ejemploRoute = createRoute({
  method: "get",
  operationId: "obtenerEjemploDiscurso",
  path: "/ejemplo",
  tags: ["Discurso"],
  summary: "Obtener discurso de ejemplo",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse(
      "Discurso institucional de ejemplo",
      ejemploResponseSchema,
    ),
    403: errorResponse("Se requiere sesión de usuario"),
  },
});

const extraerRoute = createRoute({
  method: "post",
  operationId: "extraerOrdenesDiscurso",
  path: "/extraer",
  tags: ["Discurso"],
  summary: "Extraer órdenes de un discurso o minuta",
  middleware: [
    requireUserSession,
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            workspaceId: z.string().min(1),
            titulo: z.string().trim().min(1).max(200).optional(),
            contenido: z.string().trim().min(10).max(200_000),
            formato: z.enum(["txt", "md", "vtt", "srt", "json"]).optional(),
            fuenteTipo: z
              .enum(["texto", "archivo", "plaud", "ejemplo"])
              .optional()
              .default("texto"),
            fuenteReferencia: z.string().trim().max(240).nullable().optional(),
            fechaDiscurso: z.string().trim().nullable().optional(),
            defaultProyectoId: z.string().nullable().optional(),
            guardarBorrador: z.boolean().optional().default(true),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Órdenes extraídas y borrador generado",
      extraerResponseSchema,
    ),
    400: errorResponse("Solicitud inválida"),
    403: errorResponse("Permisos insuficientes"),
  },
});

const listBorradoresRoute = createRoute({
  method: "get",
  operationId: "listarBorradoresDiscurso",
  path: "/borradores",
  tags: ["Discurso"],
  summary: "Listar borradores de actas y discursos",
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
    200: jsonResponse("Lista de borradores", z.array(borradorSchema)),
    403: errorResponse("Permisos insuficientes"),
  },
});

const getBorradorRoute = createRoute({
  method: "get",
  operationId: "obtenerBorradorDiscurso",
  path: "/borradores/{id}",
  tags: ["Discurso"],
  summary: "Obtener borrador por ID",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: jsonResponse("Borrador encontrado", borradorSchema),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Borrador no encontrado"),
  },
});

const patchBorradorRoute = createRoute({
  method: "patch",
  operationId: "actualizarBorradorDiscurso",
  path: "/borradores/{id}",
  tags: ["Discurso"],
  summary: "Actualizar borrador y sus órdenes",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            titulo: z.string().trim().min(1).max(200).optional(),
            fechaDiscurso: z.string().trim().nullable().optional(),
            ordenes: z.array(ordenSchema).optional(),
            asistentes: z
              .array(z.string().trim().min(1).max(160))
              .max(100)
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Borrador actualizado", borradorSchema),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Borrador no encontrado"),
  },
});

const deleteBorradorRoute = createRoute({
  method: "delete",
  operationId: "eliminarBorradorDiscurso",
  path: "/borradores/{id}",
  tags: ["Discurso"],
  summary: "Eliminar borrador",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: jsonResponse("Borrador eliminado", z.object({ id: z.string() })),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Borrador no encontrado"),
  },
});

const aprobarBorradorRoute = createRoute({
  method: "post",
  operationId: "aprobarBorradorDiscurso",
  path: "/borradores/{id}/aprobar",
  tags: ["Discurso"],
  summary: "Aprobar borrador y crear tareas en lote",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      required: false,
      content: {
        "application/json": {
          schema: z.object({
            titulo: z.string().trim().min(1).max(200).optional(),
            defaultProyectoId: z.string().nullable().optional(),
            ordenes: z.array(ordenSchema).optional(),
            asistentes: z
              .array(z.string().trim().min(1).max(160))
              .max(100)
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Tareas creadas en lote", aprobarResponseSchema),
    400: errorResponse("Faltan datos obligatorios en las órdenes"),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Borrador o proyecto no encontrado"),
    503: errorResponse("Servicio SIGEFANB no disponible"),
  },
});

const getActaPdfRoute = createRoute({
  method: "get",
  operationId: "descargarActaPdfDiscurso",
  path: "/borradores/{id}/acta-pdf",
  tags: ["Discurso"],
  summary: "Descargar Acta de Acuerdos y Órdenes en PDF",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: "Documento PDF del Acta de Acuerdos y Órdenes",
      content: {
        "application/pdf": { schema: { type: "string", format: "binary" } },
      },
    },
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Borrador no encontrado"),
  },
});

const postActaPdfRoute = createRoute({
  method: "post",
  operationId: "generarActaPdfDiscurso",
  path: "/borradores/{id}/acta-pdf",
  tags: ["Discurso"],
  summary: "Generar Acta de Acuerdos y Órdenes en PDF con overrides opcionales",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      required: false,
      content: {
        "application/json": {
          schema: z.object({
            titulo: z.string().trim().min(1).max(200).optional(),
            asistentes: z
              .array(z.string().trim().min(1).max(160))
              .max(100)
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Documento PDF del Acta de Acuerdos y Órdenes",
      content: {
        "application/pdf": { schema: { type: "string", format: "binary" } },
      },
    },
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Borrador no encontrado"),
  },
});

async function buildBorradorActaPdfResponse(
  c: Parameters<typeof hasWorkspacePermission>[0],
  id: string,
  overrides?: { titulo?: string; asistentes?: string[] },
): Promise<Response> {
  const borrador = await getBorradorWithAccess(c, id, { task: ["read"] });
  const actorUserId = c.get("userId");

  const selectedOrdenes = borrador.ordenes.filter((orden) => orden.seleccionada);
  const taskIds = [
    ...new Set(
      selectedOrdenes
        .map((orden) => orden.createdTaskId)
        .filter((tid): tid is string => Boolean(tid)),
    ),
  ];

  const taskRows =
    taskIds.length > 0
      ? await db
          .select({
            id: taskTable.id,
            orderFolio: taskTable.orderFolio,
            userId: taskTable.userId,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, taskIds))
      : [];

  const taskMap = new Map(taskRows.map((row) => [row.id, row]));

  const userIds = new Set<string>([actorUserId]);
  for (const orden of selectedOrdenes) {
    if (orden.responsableUserId) userIds.add(orden.responsableUserId);
  }
  for (const taskRow of taskRows) {
    if (taskRow.userId) userIds.add(taskRow.userId);
  }

  const userIdList = [...userIds];
  const userRows =
    userIdList.length > 0
      ? await db
          .select({
            id: userTable.id,
            name: userTable.name,
            grado: militarPerfilTable.grado,
          })
          .from(userTable)
          .leftJoin(
            militarPerfilTable,
            eq(userTable.id, militarPerfilTable.userId),
          )
          .where(inArray(userTable.id, userIdList))
      : [];

  const userMap = new Map(userRows.map((row) => [row.id, row]));
  const actorInfo = userMap.get(actorUserId);
  const generadoPor = actorInfo
    ? combineGradoNombre(actorInfo.grado, actorInfo.name)
    : null;

  const actaOrdenes = selectedOrdenes.map((orden) => {
    const dbTask = orden.createdTaskId
      ? taskMap.get(orden.createdTaskId)
      : undefined;
    const folio = dbTask?.orderFolio ?? orden.folio ?? "";
    const respUserId = dbTask?.userId ?? orden.responsableUserId ?? null;
    const respUser = respUserId ? userMap.get(respUserId) : undefined;
    const candidate = orden.responsableCedula
      ? orden.candidatos.find((cand) => cand.cedula === orden.responsableCedula)
      : undefined;

    const responsableNombre =
      respUser?.name ??
      candidate?.nombreCompleto ??
      orden.responsableMencionado ??
      "";
    const responsableGrado =
      respUser?.grado ?? candidate?.grado ?? orden.pistas?.grado ?? null;

    return {
      folio,
      titulo: orden.titulo,
      descripcion: orden.descripcion,
      responsableNombre,
      responsableGrado,
      plazo: orden.plazo,
      prioridad: orden.prioridad,
      citaTextual: orden.citaTextual,
    };
  });

  const titulo = overrides?.titulo?.trim() || borrador.titulo;
  const asistentes = overrides?.asistentes ?? borrador.asistentes ?? [];
  const fecha = (borrador.fechaDiscurso ?? borrador.createdAt)
    .toISOString()
    .slice(0, 10);

  const pdfBytes = await generateActaPdf({
    titulo,
    fecha,
    referencia: borrador.fuenteReferencia ?? null,
    asistentes,
    ordenes: actaOrdenes,
    generadoPor,
  });

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="acta-${borrador.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export const discurso = apiRouter()
  .openapi(ejemploRoute, async (c) => {
    return c.json(obtenerDiscursoEjemplo(), 200);
  })
  .openapi(extraerRoute, async (c) => {
    const body = c.req.valid("json");
    const userId = c.get("userId");

    const normalizada = normalizarTranscripcion(body.contenido, body.formato);
    if (normalizada.texto.length < 10) {
      throw new HTTPException(400, {
        message: "El contenido de la transcripción es demasiado corto.",
      });
    }

    const fechaBase = parseFechaDiscurso(body.fechaDiscurso) ?? new Date();
    const tituloFinal =
      body.titulo?.trim() ||
      normalizada.tituloSugerido ||
      `Acta de reunión (${formatFechaDisplay(fechaBase) ?? "sin fecha"})`;

    const extraccion = await extraerOrdenesConLlm(normalizada.texto, fechaBase);
    const ordenesResueltas = await resolverResponsablesOrdenes(
      extraccion.ordenes,
    );

    let defaultProjectId: string | null = body.defaultProyectoId ?? null;
    if (defaultProjectId) {
      const [proj] = await db
        .select({ id: projectTable.id, workspaceId: projectTable.workspaceId })
        .from(projectTable)
        .where(eq(projectTable.id, defaultProjectId))
        .limit(1);
      if (!proj || proj.workspaceId !== body.workspaceId) {
        defaultProjectId = null;
      }
    }

    const ordenesConProyecto: DiscursoOrdenBorrador[] = ordenesResueltas.map(
      (orden) => ({
        ...orden,
        proyectoId: orden.proyectoId ?? defaultProjectId,
      }),
    );

    if (!body.guardarBorrador) {
      const now = new Date();
      return c.json(
        {
          borrador: {
            id: "preview",
            workspaceId: body.workspaceId,
            createdBy: userId,
            titulo: tituloFinal,
            fuenteTipo: body.fuenteTipo,
            fuenteReferencia: body.fuenteReferencia ?? null,
            fechaDiscurso: fechaBase,
            textoOriginal: normalizada.texto,
            motorUsado: extraccion.motorUsado,
            estado: "borrador",
            ordenes: ordenesConProyecto,
            asistentes: [],
            tareasCreadas: 0,
            aprobadoEn: null,
            createdAt: now,
            updatedAt: now,
          },
          motorUsado: extraccion.motorUsado,
          fallbackMotivo: extraccion.fallbackMotivo,
        },
        200,
      );
    }

    const [created] = await db
      .insert(discursoBorradorTable)
      .values({
        workspaceId: body.workspaceId,
        createdBy: userId,
        titulo: tituloFinal,
        fuenteTipo: body.fuenteTipo,
        fuenteReferencia: body.fuenteReferencia ?? null,
        fechaDiscurso: fechaBase,
        textoOriginal: normalizada.texto,
        motorUsado: extraccion.motorUsado,
        estado: "borrador",
        ordenes: ordenesConProyecto,
      })
      .returning();

    if (!created) {
      throw new HTTPException(500, {
        message: "No se pudo guardar el borrador del discurso",
      });
    }

    return c.json(
      {
        borrador: created,
        motorUsado: extraccion.motorUsado,
        fallbackMotivo: extraccion.fallbackMotivo,
      },
      200,
    );
  })
  .openapi(listBorradoresRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    const rows = await db
      .select()
      .from(discursoBorradorTable)
      .where(eq(discursoBorradorTable.workspaceId, workspaceId))
      .orderBy(desc(discursoBorradorTable.updatedAt))
      .limit(50);

    return c.json(rows, 200);
  })
  .openapi(getBorradorRoute, async (c) => {
    const { id } = c.req.valid("param");
    const borrador = await getBorradorWithAccess(c, id, { task: ["read"] });
    return c.json(borrador, 200);
  })
  .openapi(patchBorradorRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const borrador = await getBorradorWithAccess(c, id, { task: ["create"] });

    const [updated] = await db
      .update(discursoBorradorTable)
      .set({
        ...(body.titulo !== undefined ? { titulo: body.titulo } : {}),
        ...(body.fechaDiscurso !== undefined
          ? { fechaDiscurso: parseFechaDiscurso(body.fechaDiscurso) }
          : {}),
        ...(body.ordenes !== undefined ? { ordenes: body.ordenes } : {}),
        ...(body.asistentes !== undefined
          ? { asistentes: body.asistentes }
          : {}),
      })
      .where(eq(discursoBorradorTable.id, borrador.id))
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Borrador no encontrado" });
    }

    return c.json(updated, 200);
  })
  .openapi(deleteBorradorRoute, async (c) => {
    const { id } = c.req.valid("param");
    const borrador = await getBorradorWithAccess(c, id, { task: ["create"] });

    await db
      .delete(discursoBorradorTable)
      .where(eq(discursoBorradorTable.id, borrador.id));

    return c.json({ id: borrador.id }, 200);
  })
  .openapi(aprobarBorradorRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.get("userId");
    const audit = adminAuditRequest(c);
    const borrador = await getBorradorWithAccess(c, id, { task: ["create"] });

    const body = (await c.req.json().catch(() => ({}))) as {
      titulo?: string;
      defaultProyectoId?: string | null;
      ordenes?: DiscursoOrdenBorrador[];
      asistentes?: string[];
    };

    const tituloActual = body.titulo?.trim() || borrador.titulo;
    const ordenesBase: DiscursoOrdenBorrador[] = Array.isArray(body.ordenes)
      ? body.ordenes
      : borrador.ordenes;

    const ordenesPendientes = ordenesBase.filter(
      (orden) => orden.seleccionada && !orden.createdTaskId,
    );

    if (ordenesPendientes.length === 0) {
      throw new HTTPException(400, {
        message: "No hay órdenes seleccionadas pendientes por crear.",
      });
    }

    // Valida proyectos destino dentro del workspace y acceso del usuario antes de crear tareas.
    const projectIds = new Set<string>();
    for (const orden of ordenesPendientes) {
      const targetProjectId =
        orden.proyectoId ?? body.defaultProyectoId ?? null;
      if (!targetProjectId) {
        throw new HTTPException(400, {
          message: `La orden «${orden.titulo}» no tiene proyecto destino asignado.`,
        });
      }
      projectIds.add(targetProjectId);
    }

    const projectIdList = Array.from(projectIds);
    const projects = await db
      .select({ id: projectTable.id, workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.workspaceId, borrador.workspaceId));

    const validProjectIds = new Set(projects.map((p) => p.id));
    for (const pid of projectIdList) {
      if (!validProjectIds.has(pid)) {
        throw new HTTPException(404, {
          message: "Proyecto destino no encontrado en este espacio de trabajo.",
        });
      }
    }

    await assertProjectAccess(userId, projectIdList);

    const ordenLabel = await createLabel(
      ORDEN_LABEL_NAME,
      ORDEN_LABEL_COLOR,
      undefined,
      borrador.workspaceId,
      userId,
    );

    const fechaStr = formatFechaDisplay(borrador.fechaDiscurso);
    const origenLinea = [tituloActual, fechaStr, borrador.fuenteReferencia]
      .filter(Boolean)
      .join(" · ");

    const tareasCreadasLista: {
      id: string;
      title: string;
      projectId: string;
      number: number | null;
      userId: string | null;
      priority: string | null;
      dueDate: Date | null;
    }[] = [];

    const ordenesActualizadas: DiscursoOrdenBorrador[] = [];

    for (const orden of ordenesBase) {
      if (!orden.seleccionada || orden.createdTaskId) {
        ordenesActualizadas.push(orden);
        continue;
      }

      const targetProjectId = (orden.proyectoId ??
        body.defaultProyectoId) as string;

      let resolvedUserId = orden.responsableUserId ?? undefined;
      if (orden.responsableCedula && !resolvedUserId) {
        try {
          const provisioned = await provisionarResponsable({
            cedula: orden.responsableCedula,
            workspaceId: borrador.workspaceId,
            actorUserId: userId,
            ipAddress: audit.ipAddress,
            userAgent: audit.userAgent,
          });
          resolvedUserId = provisioned.user.id;
        } catch (error) {
          if (error instanceof SigefanbUnavailableError) {
            throw new HTTPException(503, {
              message:
                "Servicio SIGEFANB temporalmente no disponible al aprovisionar responsables.",
            });
          }
          throw error;
        }
      }

      const dueDate = parseDueDate(orden.plazo);
      const folio =
        orden.folio?.trim() ||
        (await allocateOrderFolio(borrador.workspaceId));
      const descriptionParts = [
        orden.descripcion?.trim() || orden.titulo,
        "",
        "---",
        `**Cita textual:** «${orden.citaTextual}»`,
        `**Origen:** ${origenLinea}`,
      ];

      const createdTask = await createTask({
        projectId: targetProjectId,
        currentUserId: userId,
        userId: resolvedUserId,
        title: orden.titulo,
        status: "to-do",
        dueDate,
        description: descriptionParts.join("\n"),
        priority: orden.prioridad,
        suppressCreatedNotification: true,
        isOrder: true,
        orderFolio: folio,
        orderOrigin: "discurso",
        orderQuote: orden.citaTextual,
      });

      await assignLabelToTask(ordenLabel.id, createdTask.id, userId);

      if (resolvedUserId && resolvedUserId !== userId) {
        await createNotification({
          userId: resolvedUserId,
          type: "minister_order",
          title: "Orden del Ministro",
          content: `Se te asignó la orden [${folio}] «${createdTask.title}» (${tituloActual}).`,
          eventData: {
            folio,
            taskTitle: createdTask.title,
            origenTitulo: tituloActual,
            projectId: targetProjectId,
            workspaceId: borrador.workspaceId,
          },
          resourceId: createdTask.id,
          resourceType: "task",
        });
      }

      await createActivity(
        createdTask.id,
        "discurso_aprobado",
        userId,
        `Orden creada desde acta: ${tituloActual}`,
        {
          folio,
          borradorId: borrador.id,
          ordenId: orden.id,
          citaTextual: orden.citaTextual,
          fuenteTipo: borrador.fuenteTipo,
        },
      );

      tareasCreadasLista.push({
        id: createdTask.id,
        title: createdTask.title,
        projectId: createdTask.projectId,
        number: createdTask.number ?? null,
        userId: createdTask.userId ?? null,
        priority: createdTask.priority ?? null,
        dueDate: createdTask.dueDate ?? null,
      });

      ordenesActualizadas.push({
        ...orden,
        folio,
        proyectoId: targetProjectId,
        responsableUserId: resolvedUserId ?? null,
        createdTaskId: createdTask.id,
      });
    }

    const totalCreadas = ordenesActualizadas.filter((item) =>
      Boolean(item.createdTaskId),
    ).length;

    const [updatedBorrador] = await db
      .update(discursoBorradorTable)
      .set({
        titulo: tituloActual,
        ordenes: ordenesActualizadas,
        ...(Array.isArray(body.asistentes)
          ? { asistentes: body.asistentes }
          : {}),
        estado: "aprobado",
        tareasCreadas: totalCreadas,
        aprobadoEn: new Date(),
      })
      .where(
        and(
          eq(discursoBorradorTable.id, borrador.id),
          eq(discursoBorradorTable.workspaceId, borrador.workspaceId),
        ),
      )
      .returning();

    if (!updatedBorrador) {
      throw new HTTPException(500, {
        message: "No se pudo actualizar el estado del borrador",
      });
    }

    return c.json(
      {
        tareasCreadas: tareasCreadasLista.length,
        tareas: tareasCreadasLista,
        borrador: updatedBorrador,
      },
      200,
    );
  })
  .openapi(getActaPdfRoute, async (c) => {
    const { id } = c.req.valid("param");
    return buildBorradorActaPdfResponse(c, id);
  })
  .openapi(postActaPdfRoute, async (c) => {
    const { id } = c.req.valid("param");
    const rawBody = (await c.req.json().catch(() => ({}))) as {
      titulo?: string;
      asistentes?: string[];
    };
    return buildBorradorActaPdfResponse(c, id, {
      titulo: rawBody?.titulo,
      asistentes: Array.isArray(rawBody?.asistentes)
        ? rawBody.asistentes
        : undefined,
    });
  });

export default discurso;

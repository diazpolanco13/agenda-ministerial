import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { getExecutiveSummary } from "./controllers/get-executive-summary";

const executiveResponsableSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    grado: z.string().nullable(),
    componente: z.string().nullable(),
    unidad: z.string().nullable(),
    cedula: z.string().nullable(),
    fotoUrl: z.string().nullable(),
    insignia: z.string().nullable(),
  })
  .openapi("ExecutiveResponsable");

const executiveSummarySchema = z
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
    kpis: z.object({
      vencidas: z.number().int(),
      vencenHoy: z.number().int(),
      vencenSemana: z.number().int(),
      ordenesPendientes: z.number().int(),
      cumplimientoATiempoPct: z.number().int().nullable(),
      cumplimientoEnPlazo: z.number().int(),
      cumplimientoBase: z.number().int(),
      totalAbiertas: z.number().int(),
      totalCompletadas: z.number().int(),
    }),
    agendaHoy: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        projectName: z.string(),
        projectSlug: z.string(),
        projectIcon: z.string().nullable(),
        number: z.number().nullable(),
        title: z.string(),
        status: z.string(),
        statusName: z.string().nullable(),
        priority: z.string(),
        completada: z.boolean(),
        esOrden: z.boolean(),
        startDate: nullableResponseTimestamp,
        dueDate: nullableResponseTimestamp,
        responsable: executiveResponsableSchema.nullable(),
      }),
    ),
    ordenesRecientes: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        projectName: z.string(),
        projectSlug: z.string(),
        number: z.number().nullable(),
        title: z.string(),
        status: z.string(),
        statusName: z.string().nullable(),
        priority: z.string(),
        completada: z.boolean(),
        esOrden: z.boolean(),
        dueDate: nullableResponseTimestamp,
        createdAt: responseTimestamp,
        responsable: executiveResponsableSchema.nullable(),
      }),
    ),
    topResponsables: z.array(
      executiveResponsableSchema.extend({
        abiertas: z.number().int(),
        vencidas: z.number().int(),
        completadas: z.number().int(),
      }),
    ),
    actividadCompacta: z.array(
      z.object({
        id: z.string(),
        actorNombre: z.string(),
        actorGrado: z.string().nullable(),
        actorFotoUrl: z.string().nullable(),
        actorCedula: z.string().nullable(),
        dia: z.string(),
        resumen: z.string(),
        cantidad: z.number().int(),
        ultimaHora: responseTimestamp,
        ultimaTarea: z.object({
          id: z.string(),
          number: z.number().nullable(),
          title: z.string(),
          projectId: z.string(),
          projectSlug: z.string(),
        }),
      }),
    ),
  })
  .openapi("ExecutiveSummary");

const getExecutiveSummaryRoute = createRoute({
  method: "get",
  operationId: "getExecutiveSummary",
  path: "/summary",
  tags: ["Executive"],
  summary: "Resumen ejecutivo del Panel de Mando",
  description:
    "Obtiene KPIs en horario de Caracas (UTC-4), agenda del día, órdenes recientes, responsables con más pendientes y actividad compacta agrupada por usuario y día.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: {
    query: z.object({
      workspaceId: z.string().min(1).openapi({
        description: "ID del espacio de trabajo",
      }),
    }),
  },
  responses: {
    200: jsonResponse(
      "Resumen ejecutivo del workspace",
      executiveSummarySchema,
    ),
    400: errorResponse("Parámetros inválidos"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Sin permisos de lectura en el espacio de trabajo"),
    404: errorResponse("Espacio de trabajo no encontrado"),
  },
});

const executive = apiRouter().openapi(getExecutiveSummaryRoute, async (c) => {
  const { workspaceId } = c.req.valid("query");
  const userId = c.get("userId");
  const apiKeyId = c.get("apiKey")?.id;
  const summary = await getExecutiveSummary(workspaceId, userId, apiKeyId);
  return c.json(summary, 200);
});

export default executive;

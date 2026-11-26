import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { plaudAdapter } from "./adapter";

const estadoSchema = z
  .object({
    conectado: z.boolean(),
    tieneTokens: z.boolean(),
    cliInstalada: z.boolean(),
    rutaTokens: z.string(),
    mensaje: z.string(),
    instrucciones: z.array(z.string()),
  })
  .openapi("PlaudEstado");

const grabacionSchema = z
  .object({
    id: z.string(),
    titulo: z.string(),
    fecha: z.string().nullable(),
    duracionSegundos: z.number().nullable(),
    resumenDisponible: z.boolean(),
  })
  .openapi("PlaudGrabacion");

const transcripcionSchema = z
  .object({
    id: z.string(),
    texto: z.string(),
  })
  .openapi("PlaudTranscripcion");

const resumenSchema = z
  .object({
    id: z.string(),
    resumen: z.string(),
  })
  .openapi("PlaudResumen");

const estadoRoute = createRoute({
  method: "get",
  operationId: "obtenerEstadoPlaud",
  path: "/estado",
  tags: ["Plaud"],
  summary: "Consultar estado de conexión Plaud CLI",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Estado de integración con Plaud", estadoSchema),
    403: errorResponse("Se requiere sesión de usuario"),
  },
});

const grabacionesRoute = createRoute({
  method: "get",
  operationId: "listarGrabacionesPlaud",
  path: "/grabaciones",
  tags: ["Plaud"],
  summary: "Listar grabaciones recientes de Plaud",
  middleware: [requireUserSession] as const,
  request: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(90).optional().default(14),
    }),
  },
  responses: {
    200: jsonResponse("Grabaciones recientes", z.array(grabacionSchema)),
    400: errorResponse("Plaud no conectado"),
    403: errorResponse("Se requiere sesión de usuario"),
  },
});

const transcripcionRoute = createRoute({
  method: "get",
  operationId: "obtenerTranscripcionPlaud",
  path: "/grabaciones/{id}/transcripcion",
  tags: ["Plaud"],
  summary: "Obtener transcripción de una grabación Plaud",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/),
    }),
  },
  responses: {
    200: jsonResponse("Transcripción obtenida", transcripcionSchema),
    400: errorResponse("ID inválido o Plaud no conectado"),
    403: errorResponse("Se requiere sesión de usuario"),
  },
});

const resumenRoute = createRoute({
  method: "get",
  operationId: "obtenerResumenPlaud",
  path: "/grabaciones/{id}/resumen",
  tags: ["Plaud"],
  summary: "Obtener resumen de una grabación Plaud",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/),
    }),
  },
  responses: {
    200: jsonResponse("Resumen obtenido", resumenSchema),
    400: errorResponse("ID inválido o Plaud no conectado"),
    403: errorResponse("Se requiere sesión de usuario"),
  },
});

export const plaud = apiRouter()
  .openapi(estadoRoute, async (c) => {
    return c.json(await plaudAdapter.obtenerEstado(), 200);
  })
  .openapi(grabacionesRoute, async (c) => {
    const { days } = c.req.valid("query");
    return c.json(await plaudAdapter.listarGrabaciones(days), 200);
  })
  .openapi(transcripcionRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await plaudAdapter.obtenerTranscripcion(id), 200);
  })
  .openapi(resumenRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await plaudAdapter.obtenerResumen(id), 200);
  });

export default plaud;

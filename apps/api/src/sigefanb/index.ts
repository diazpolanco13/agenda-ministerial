import { HTTPException } from "hono/http-exception";
import { adminAuditRequest } from "../admin/audit/admin-audit-request";
import { recordAdminAction } from "../admin/audit/record-admin-action";
import { getUserAccess, holdsAll } from "../admin/roles/get-instance-access";
import { ApiError } from "../errors/api-error";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";
import { requireUserSession } from "../utils/require-user-session";
import { obtenerFotoSigefanb } from "./fotos";
import { normalizeCedulaInput } from "./military-assets";
import { buscarPersonal, obtenerPersonalPorCedula } from "./personal-query";
import { SigefanbUnavailableError } from "./pools";
import { provisionarResponsable } from "./provisionar-responsable";
import {
  enforceSigefanbPhotoRateLimit,
  enforceSigefanbRateLimit,
} from "./rate-limit";

const componenteSchema = z.enum(["EJB", "ARB", "AMB", "GNB", "MIL"]);

const sigefanbPersonalItemSchema = z
  .object({
    cedula: z.string(),
    nacionalidad: z.enum(["V", "E"]),
    nombreCompleto: z.string(),
    grado: z.string(),
    componente: componenteSchema.nullable(),
    unidad: z.string().nullable(),
    sexo: z.string().nullable(),
    insignia: z.string().nullable(),
    fotoUrl: z.string(),
  })
  .openapi("SigefanbPersonalItem");

const provisionedUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    cedula: z.string(),
    nacionalidad: z.string().nullable(),
    grado: z.string().nullable(),
    componente: z.string().nullable(),
    unidad: z.string().nullable(),
    pendiente: z.boolean(),
  })
  .openapi("SigefanbProvisionedUser");

const provisionarResponseSchema = z
  .object({
    user: provisionedUserSchema,
    created: z.boolean(),
  })
  .openapi("SigefanbProvisionarResponse");

function rethrowSigefanbError(error: unknown): never {
  if (error instanceof SigefanbUnavailableError) {
    throw new HTTPException(503, {
      message: "Servicio SIGEFANB temporalmente no disponible",
    });
  }
  throw error;
}

function recordAuditNonBlocking(
  input: Parameters<typeof recordAdminAction>[0],
): void {
  void recordAdminAction(input).catch((error) => {
    console.error(
      "No se pudo registrar auditoría SIGEFANB:",
      error instanceof Error ? error.message : "Error desconocido",
    );
  });
}

const buscarPersonalRoute = createRoute({
  method: "get",
  operationId: "buscarPersonalSigefanb",
  path: "/personal/buscar",
  tags: ["SIGEFANB"],
  summary: "Buscar personal militar en SIGEFANB",
  description:
    "Consulta personal activo en SIGEFANB por cédula o nombre/apellido (mínimo 3 caracteres, máximo 20 resultados).",
  middleware: [requireUserSession] as const,
  request: {
    query: z.object({
      q: z.string().trim().min(3).max(100),
    }),
  },
  responses: {
    200: jsonResponse(
      "Listado de personal activo encontrado",
      z.array(sigefanbPersonalItemSchema),
    ),
    400: errorResponse("Término de búsqueda inválido"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Se requiere sesión de usuario"),
    429: errorResponse("Límite de consultas excedido"),
    503: errorResponse("Servicio SIGEFANB temporalmente no disponible"),
  },
});

const obtenerPersonalRoute = createRoute({
  method: "get",
  operationId: "obtenerPersonalSigefanb",
  path: "/personal/{cedula}",
  tags: ["SIGEFANB"],
  summary: "Consultar personal militar por cédula",
  description:
    "Obtiene los datos de una persona activa en SIGEFANB a partir de su número de cédula.",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({
      cedula: z.string().min(5).max(20),
    }),
  },
  responses: {
    200: jsonResponse(
      "Datos del personal encontrado",
      sigefanbPersonalItemSchema,
    ),
    400: errorResponse("Cédula inválida"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Se requiere sesión de usuario"),
    404: errorResponse("No se encontró personal activo con esa cédula"),
    429: errorResponse("Límite de consultas excedido"),
    503: errorResponse("Servicio SIGEFANB temporalmente no disponible"),
  },
});

const obtenerFotoRoute = createRoute({
  method: "get",
  operationId: "obtenerFotoSigefanb",
  path: "/foto/{cedula}",
  tags: ["SIGEFANB"],
  summary: "Obtener fotografía oficial desde SIGEFANB",
  description:
    "Descarga la fotografía del militar/persona desde el almacenamiento de fotos SIGEFANB con soporte ETag.",
  middleware: [requireUserSession] as const,
  request: {
    params: z.object({
      cedula: z.string().min(5).max(20),
    }),
  },
  responses: {
    200: {
      description: "Fotografía oficial",
      content: {
        "image/*": { schema: { type: "string", format: "binary" } },
      },
    },
    304: { description: "No modificado" },
    400: errorResponse("Cédula inválida"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Se requiere sesión de usuario"),
    404: errorResponse("Fotografía no encontrada"),
    429: errorResponse("Límite de descargas excedido"),
    503: errorResponse("Servicio SIGEFANB temporalmente no disponible"),
  },
});

const provisionarRoute = createRoute({
  method: "post",
  operationId: "provisionarResponsableSigefanb",
  path: "/provisionar",
  tags: ["SIGEFANB"],
  summary: "Aprovisionar responsable desde SIGEFANB",
  description:
    "Crea o vincula un usuario responsable en AGENDA a partir de su cédula en SIGEFANB y lo incorpora al workspace indicado.",
  middleware: [requireUserSession] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            cedula: z.string().min(5).max(20),
            workspaceId: z.string().min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Usuario responsable aprovisionado",
      provisionarResponseSchema,
    ),
    400: errorResponse("Datos inválidos"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Permisos insuficientes"),
    404: errorResponse("Personal o espacio de trabajo no encontrado"),
    429: errorResponse("Límite de solicitudes excedido"),
    503: errorResponse("Servicio SIGEFANB temporalmente no disponible"),
  },
});

export const sigefanb = apiRouter()
  .openapi(buscarPersonalRoute, async (c) => {
    const userId = c.get("userId");
    enforceSigefanbRateLimit(userId);

    const { q } = c.req.valid("query");
    const audit = adminAuditRequest(c);
    recordAuditNonBlocking({
      actorUserId: audit.actorUserId,
      action: "sigefanb.search",
      targetType: "sigefanb",
      targetLabel: q,
      metadata: { query: q },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    try {
      const items = await buscarPersonal(q);
      return c.json(items, 200);
    } catch (error) {
      rethrowSigefanbError(error);
    }
  })
  .openapi(obtenerPersonalRoute, async (c) => {
    const userId = c.get("userId");
    enforceSigefanbRateLimit(userId);

    const { cedula } = c.req.valid("param");
    const audit = adminAuditRequest(c);
    recordAuditNonBlocking({
      actorUserId: audit.actorUserId,
      action: "sigefanb.lookup",
      targetType: "sigefanb",
      targetLabel: cedula,
      metadata: { cedula },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    try {
      const persona = await obtenerPersonalPorCedula(cedula);
      if (!persona) {
        throw new HTTPException(404, {
          message: "No se encontró personal activo con esa cédula en SIGEFANB",
        });
      }
      return c.json(persona, 200);
    } catch (error) {
      rethrowSigefanbError(error);
    }
  })
  .openapi(obtenerFotoRoute, async (c) => {
    const userId = c.get("userId");
    enforceSigefanbPhotoRateLimit(userId);

    const { cedula } = c.req.valid("param");
    const normalizedCedula = normalizeCedulaInput(cedula);
    if (!normalizedCedula) {
      throw new HTTPException(400, { message: "Cédula inválida" });
    }

    try {
      const foto = await obtenerFotoSigefanb(normalizedCedula);
      if (!foto) {
        throw new HTTPException(404, { message: "Fotografía no encontrada" });
      }

      const etag =
        foto.etag ?? `"sigefanb-${normalizedCedula}-${foto.contentLength}"`;
      c.header("Cache-Control", "private, max-age=86400");
      const ifNoneMatch = c.req.header("If-None-Match");
      if (
        ifNoneMatch &&
        ifNoneMatch.split(",").some((tag) => tag.trim() === etag)
      ) {
        return new Response(null, {
          status: 304,
          headers: {
            "Cache-Control": "private, max-age=86400",
            ETag: etag,
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      return new Response(foto.body as BodyInit, {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=86400",
          "Content-Type": foto.contentType,
          "Content-Length": String(foto.contentLength),
          ETag: etag,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      rethrowSigefanbError(error);
    }
  })
  .openapi(provisionarRoute, async (c) => {
    const userId = c.get("userId");
    enforceSigefanbRateLimit(userId);

    const { cedula, workspaceId } = c.req.valid("json");

    const canAssign = await hasWorkspacePermission(
      c,
      { task: ["assign"] },
      workspaceId,
    );
    if (!canAssign) {
      const access = await getUserAccess(userId);
      if (!holdsAll(access, ["users:create"])) {
        throw new ApiError(403, {
          message: "No tiene permisos para aprovisionar responsables",
          code: "MISSING_PERMISSION",
          missingPermissions: ["task:assign"],
        });
      }
    }

    const audit = adminAuditRequest(c);
    try {
      const result = await provisionarResponsable({
        cedula,
        workspaceId,
        actorUserId: userId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      });
      return c.json(result, 200);
    } catch (error) {
      rethrowSigefanbError(error);
    }
  });

export default sigefanb;

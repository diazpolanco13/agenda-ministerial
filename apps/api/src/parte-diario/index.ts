import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { agendaNtfySubscriptionTable } from "../database/schema";
import { decryptSecret } from "../notification-preferences/secrets";
import {
  getAgendaPublicUrl,
  isNtfyConfigured,
  publishNtfyMessage,
} from "../ntfy/client";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  z,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  formatDailyBriefHtml,
  formatDailyBriefText,
  sendDailyBriefEmailHook,
} from "./delivery";
import { generateDailyBriefForUser } from "./generator";

const dailyBriefItemSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
    number: z.number().nullable(),
    title: z.string(),
    priority: z.string(),
    dueDate: nullableResponseTimestamp,
    isOrder: z.boolean(),
    orderFolio: z.string().nullable(),
    orderClosureStatus: z.string(),
    confidentialityLevel: z.string(),
  })
  .openapi("DailyBriefItem");

const dailyBriefResponseSchema = z
  .object({
    dateKey: z.string(),
    fechaLarga: z.string(),
    saludo: z.string(),
    motorUsado: z.enum(["ollama", "determinista"]),
    parrafoEjecutivo: z.string(),
    contadores: z.object({
      venceHoy: z.number().int(),
      vencidas: z.number().int(),
      ordenesNuevas: z.number().int(),
      agendaDia: z.number().int(),
      pendientesVistoBueno: z.number().int(),
    }),
    items: z.object({
      venceHoy: z.array(dailyBriefItemSchema),
      vencidas: z.array(dailyBriefItemSchema),
      ordenesNuevas: z.array(dailyBriefItemSchema),
      agendaDia: z.array(dailyBriefItemSchema),
      pendientesVistoBueno: z.array(dailyBriefItemSchema),
    }),
  })
  .openapi("DailyBrief");

const sendTestBriefResponseSchema = z
  .object({
    sentNtfy: z.boolean(),
    emailHook: z.object({
      sent: z.boolean(),
      reason: z.string().optional(),
    }),
    motorUsado: z.enum(["ollama", "determinista"]),
  })
  .openapi("DailyBriefSendTestResponse");

const getDailyBriefRoute = createRoute({
  method: "get",
  operationId: "getDailyBriefHoy",
  path: "/hoy",
  tags: ["ParteDiario"],
  summary: "Obtener parte diario ejecutivo de hoy",
  description:
    "Genera el parte diario del despacho en horario de Caracas (UTC-4) con carga rápida determinista por defecto o síntesis con IA local cuando llm=1.",
  middleware: [
    requireUserSession,
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: {
    query: z.object({
      workspaceId: z.string().min(1).openapi({
        description: "ID del espacio de trabajo",
      }),
      llm: z.enum(["0", "1"]).optional().openapi({
        description: "Usar IA local (1) o generador determinista rápido (0)",
      }),
      refresh: z.enum(["0", "1"]).optional().openapi({
        description: "Omitir caché en memoria cuando es 1",
      }),
    }),
  },
  responses: {
    200: jsonResponse("Parte diario de hoy", dailyBriefResponseSchema),
    400: errorResponse("Parámetros inválidos"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Sin permisos de lectura"),
    404: errorResponse("Espacio de trabajo no encontrado"),
  },
});

const sendDailyBriefTestRoute = createRoute({
  method: "post",
  operationId: "sendDailyBriefTest",
  path: "/enviar-prueba",
  tags: ["ParteDiario"],
  summary: "Enviar parte diario de prueba al móvil del usuario",
  description:
    "Genera el parte diario con síntesis IA (con respaldo determinista) y lo envía por ntfy si la suscripción móvil del usuario está activa.",
  middleware: [
    requireUserSession,
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            workspaceId: z.string().min(1).openapi({
              description: "ID del espacio de trabajo",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Resultado del envío de prueba",
      sendTestBriefResponseSchema,
    ),
    400: errorResponse("Suscripción móvil ntfy no activada"),
    401: errorResponse("No autenticado"),
    403: errorResponse("Sin permisos de lectura"),
    404: errorResponse("Espacio de trabajo no encontrado"),
    503: errorResponse("Servidor ntfy no configurado"),
  },
});

const parteDiario = apiRouter()
  .openapi(getDailyBriefRoute, async (c) => {
    const { workspaceId, llm, refresh } = c.req.valid("query");
    const userId = c.get("userId");

    const brief = await generateDailyBriefForUser(workspaceId, userId, {
      useLlm: llm === "1",
      refresh: refresh === "1",
    });

    return c.json(brief, 200);
  })
  .openapi(sendDailyBriefTestRoute, async (c) => {
    const { workspaceId } = c.req.valid("json");
    const userId = c.get("userId");
    const userEmail = c.get("userEmail");

    const subscription = await db.query.agendaNtfySubscriptionTable.findFirst({
      where: eq(agendaNtfySubscriptionTable.userId, userId),
    });

    if (!subscription || !subscription.enabled) {
      throw new HTTPException(400, {
        message:
          "Debes activar las notificaciones móviles (ntfy) en tu perfil antes de enviar el parte.",
      });
    }

    if (!isNtfyConfigured()) {
      throw new HTTPException(503, {
        message: "El servidor ntfy no está configurado en esta instancia.",
      });
    }

    const topic = decryptSecret(subscription.topicEncrypted);
    if (!topic) {
      throw new HTTPException(400, {
        message:
          "No se encontró un canal ntfy válido para tu cuenta. Regenera tus credenciales móviles.",
      });
    }

    const brief = await generateDailyBriefForUser(workspaceId, userId, {
      useLlm: true,
    });

    const text = formatDailyBriefText(brief);
    const html = formatDailyBriefHtml(brief);

    await publishNtfyMessage({
      topic,
      title: "Parte diario — AGENDA",
      body: text,
      priority: brief.contadores.vencidas > 0 ? 4 : 3,
      tags: "clipboard,calendar",
      clickUrl: `${getAgendaPublicUrl()}/dashboard/workspace/${workspaceId}`,
    });

    const emailHook = userEmail
      ? await sendDailyBriefEmailHook({
          to: userEmail,
          subject: `Parte diario — ${brief.fechaLarga}`,
          text,
          html,
        })
      : { sent: false, reason: "missing_email" };

    return c.json(
      {
        sentNtfy: true,
        emailHook,
        motorUsado: brief.motorUsado,
      },
      200,
    );
  });

export default parteDiario;

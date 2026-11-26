import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  ntfyProvisionResponseSchema,
  ntfyStatusSchema,
  ntfyTestResponseSchema,
} from "./response";
import { ntfyPreferencesBody } from "./schema";
import {
  activateNtfySubscription,
  deactivateNtfySubscription,
  getNtfyStatus,
  regenerateNtfyCredentials,
  sendNtfyTestNotification,
  updateNtfyPreferences,
} from "./service";

const getNtfyStatusRoute = createRoute({
  method: "get",
  operationId: "getNtfyStatus",
  path: "/status",
  tags: ["Ntfy"],
  summary: "Obtener estado de notificaciones móviles ntfy",
  responses: {
    200: jsonResponse("Estado de suscripción ntfy", ntfyStatusSchema),
  },
});

const activateNtfyRoute = createRoute({
  method: "post",
  operationId: "activateNtfy",
  path: "/activate",
  tags: ["Ntfy"],
  summary: "Activar notificaciones móviles ntfy y generar credenciales",
  responses: {
    200: jsonResponse(
      "Credenciales creadas (mostradas una sola vez)",
      ntfyProvisionResponseSchema,
    ),
    409: errorResponse("Las notificaciones móviles ya están activas"),
    502: errorResponse("Error al aprovisionar en ntfy"),
    503: errorResponse("Servidor ntfy no configurado"),
  },
});

const regenerateNtfyRoute = createRoute({
  method: "post",
  operationId: "regenerateNtfy",
  path: "/regenerate",
  tags: ["Ntfy"],
  summary: "Regenerar tema y credenciales ntfy",
  responses: {
    200: jsonResponse(
      "Nuevas credenciales generadas",
      ntfyProvisionResponseSchema,
    ),
    400: errorResponse("Suscripción no activada"),
    502: errorResponse("Error al regenerar en ntfy"),
    503: errorResponse("Servidor ntfy no configurado"),
  },
});

const deactivateNtfyRoute = createRoute({
  method: "post",
  operationId: "deactivateNtfy",
  path: "/deactivate",
  tags: ["Ntfy"],
  summary: "Desactivar notificaciones móviles ntfy",
  responses: {
    200: jsonResponse("Suscripción desactivada", ntfyStatusSchema),
    502: errorResponse("Error al revocar usuario en ntfy"),
  },
});

const testNtfyRoute = createRoute({
  method: "post",
  operationId: "testNtfy",
  path: "/test",
  tags: ["Ntfy"],
  summary: "Enviar notificación de prueba vía ntfy",
  responses: {
    200: jsonResponse("Prueba enviada", ntfyTestResponseSchema),
    400: errorResponse("Suscripción no activada"),
    502: errorResponse("Error al enviar prueba"),
    503: errorResponse("Servidor ntfy no configurado"),
  },
});

const updateNtfyPreferencesRoute = createRoute({
  method: "put",
  operationId: "updateNtfyPreferences",
  path: "/preferences",
  tags: ["Ntfy"],
  summary: "Actualizar preferencias de eventos móviles ntfy",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ntfyPreferencesBody } },
    },
  },
  responses: {
    200: jsonResponse("Preferencias actualizadas", ntfyStatusSchema),
    400: errorResponse("Solicitud inválida"),
  },
});

const ntfy = apiRouter()
  .openapi(getNtfyStatusRoute, async (c) =>
    c.json(await getNtfyStatus(c.get("userId")), 200),
  )
  .openapi(activateNtfyRoute, async (c) =>
    c.json(await activateNtfySubscription(c.get("userId")), 200),
  )
  .openapi(regenerateNtfyRoute, async (c) =>
    c.json(await regenerateNtfyCredentials(c.get("userId")), 200),
  )
  .openapi(deactivateNtfyRoute, async (c) =>
    c.json(await deactivateNtfySubscription(c.get("userId")), 200),
  )
  .openapi(testNtfyRoute, async (c) =>
    c.json(await sendNtfyTestNotification(c.get("userId")), 200),
  )
  .openapi(updateNtfyPreferencesRoute, async (c) =>
    c.json(
      await updateNtfyPreferences(c.get("userId"), c.req.valid("json")),
      200,
    ),
  );

export default ntfy;

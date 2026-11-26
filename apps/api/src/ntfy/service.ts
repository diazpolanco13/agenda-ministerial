import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { agendaNtfySubscriptionTable } from "../database/schema";
import {
  decryptSecret,
  encryptSecret,
} from "../notification-preferences/secrets";
import {
  createOrReplaceNtfyUser,
  deleteNtfyUser,
  generateNtfyPassword,
  generateNtfyUsername,
  generatePrivateTopic,
  getAgendaPublicUrl,
  getNtfyPublicUrl,
  isNtfyConfigured,
  NtfyRequestError,
  publishNtfyMessage,
} from "./client";

export type NtfyEventPreferences = {
  taskAssigned: boolean;
  mentionComment: boolean;
  dueTomorrow: boolean;
  dueToday: boolean;
  overdue: boolean;
  ministerOrder: boolean;
};

export type NtfyStatusResponse = {
  configuredOnServer: boolean;
  enabled: boolean;
  publicUrl: string;
  topic: string | null;
  username: string | null;
  subscribeUrl: string | null;
  appUri: string | null;
  credentialsVersion: number;
  lastTestAt: Date | null;
  preferences: NtfyEventPreferences;
};

export type NtfyProvisionResponse = NtfyStatusResponse & {
  credentials: {
    serverUrl: string;
    topic: string;
    username: string;
    password: string;
    subscribeUrl: string;
    appUri: string;
  };
};

const DEFAULT_PREFERENCES: NtfyEventPreferences = {
  taskAssigned: true,
  mentionComment: true,
  dueTomorrow: true,
  dueToday: true,
  overdue: true,
  ministerOrder: true,
};

function buildSubscribeUrls(publicUrl: string, topic: string) {
  const cleanBase = publicUrl.replace(/\/+$/, "");
  const hostPath = cleanBase.replace(/^https?:\/\//, "");
  return {
    subscribeUrl: `${cleanBase}/${encodeURIComponent(topic)}`,
    appUri: `ntfy://${hostPath}/${encodeURIComponent(topic)}`,
  };
}

function mapRowToStatus(
  row: typeof agendaNtfySubscriptionTable.$inferSelect | undefined,
): NtfyStatusResponse {
  const publicUrl = getNtfyPublicUrl();
  const configuredOnServer = isNtfyConfigured();
  if (!row) {
    return {
      configuredOnServer,
      enabled: false,
      publicUrl,
      topic: null,
      username: null,
      subscribeUrl: null,
      appUri: null,
      credentialsVersion: 0,
      lastTestAt: null,
      preferences: { ...DEFAULT_PREFERENCES },
    };
  }

  const topic = row.enabled
    ? (decryptSecret(row.topicEncrypted) ?? null)
    : null;
  const username = row.enabled
    ? (decryptSecret(row.usernameEncrypted) ?? null)
    : null;
  const urls =
    row.enabled && topic ? buildSubscribeUrls(publicUrl, topic) : null;

  return {
    configuredOnServer,
    enabled: row.enabled,
    publicUrl,
    topic,
    username,
    subscribeUrl: urls?.subscribeUrl ?? null,
    appUri: urls?.appUri ?? null,
    credentialsVersion: row.credentialsVersion,
    lastTestAt: row.lastTestAt ?? null,
    preferences: {
      taskAssigned: row.eventTaskAssigned,
      mentionComment: row.eventMentionComment,
      dueTomorrow: row.eventDueTomorrow,
      dueToday: row.eventDueToday,
      overdue: row.eventOverdue,
      ministerOrder: row.eventMinisterOrder,
    },
  };
}

function rethrowNtfyError(error: unknown): never {
  if (error instanceof HTTPException) throw error;
  if (error instanceof NtfyRequestError) {
    throw new HTTPException(error.status === 503 ? 503 : 502, {
      message: error.message,
    });
  }
  throw new HTTPException(500, {
    message: "No se pudo completar la operación en ntfy",
  });
}

export async function getNtfyStatus(userId: string): Promise<NtfyStatusResponse> {
  const row = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: eq(agendaNtfySubscriptionTable.userId, userId),
  });
  return mapRowToStatus(row);
}

export async function activateNtfySubscription(
  userId: string,
): Promise<NtfyProvisionResponse> {
  if (!isNtfyConfigured()) {
    throw new HTTPException(503, {
      message: "El servidor ntfy no está configurado en esta instancia.",
    });
  }

  const existing = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: eq(agendaNtfySubscriptionTable.userId, userId),
  });

  if (existing?.enabled) {
    throw new HTTPException(409, {
      message:
        "Las notificaciones móviles ya están activas. Usa Regenerar credenciales si necesitas nuevas claves.",
    });
  }

  const topic = generatePrivateTopic();
  const username = generateNtfyUsername(userId);
  const password = generateNtfyPassword();

  try {
    await createOrReplaceNtfyUser(username, password, topic);
  } catch (error) {
    rethrowNtfyError(error);
  }

  const topicEncrypted = encryptSecret(topic) as string;
  const usernameEncrypted = encryptSecret(username) as string;
  const passwordEncrypted = encryptSecret(password) as string;

  const [saved] = existing
    ? await db
        .update(agendaNtfySubscriptionTable)
        .set({
          enabled: true,
          topicEncrypted,
          usernameEncrypted,
          passwordEncrypted,
          credentialsVersion: existing.credentialsVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(agendaNtfySubscriptionTable.userId, userId))
        .returning()
    : await db
        .insert(agendaNtfySubscriptionTable)
        .values({
          userId,
          enabled: true,
          topicEncrypted,
          usernameEncrypted,
          passwordEncrypted,
          credentialsVersion: 1,
        })
        .returning();

  const status = mapRowToStatus(saved);
  const publicUrl = getNtfyPublicUrl();
  const { subscribeUrl, appUri } = buildSubscribeUrls(publicUrl, topic);

  return {
    ...status,
    credentials: {
      serverUrl: publicUrl,
      topic,
      username,
      password,
      subscribeUrl,
      appUri,
    },
  };
}

export async function regenerateNtfyCredentials(
  userId: string,
): Promise<NtfyProvisionResponse> {
  if (!isNtfyConfigured()) {
    throw new HTTPException(503, {
      message: "El servidor ntfy no está configurado en esta instancia.",
    });
  }

  const existing = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: eq(agendaNtfySubscriptionTable.userId, userId),
  });

  if (!existing || !existing.enabled) {
    throw new HTTPException(400, {
      message: "Activa primero las notificaciones móviles antes de regenerar.",
    });
  }

  const oldUsername = decryptSecret(existing.usernameEncrypted);
  const topic = generatePrivateTopic();
  const username = generateNtfyUsername(userId);
  const password = generateNtfyPassword();

  try {
    if (oldUsername && oldUsername !== username) {
      await deleteNtfyUser(oldUsername);
    }
    await createOrReplaceNtfyUser(username, password, topic);
  } catch (error) {
    rethrowNtfyError(error);
  }

  const topicEncrypted = encryptSecret(topic) as string;
  const usernameEncrypted = encryptSecret(username) as string;
  const passwordEncrypted = encryptSecret(password) as string;

  const [saved] = await db
    .update(agendaNtfySubscriptionTable)
    .set({
      enabled: true,
      topicEncrypted,
      usernameEncrypted,
      passwordEncrypted,
      credentialsVersion: existing.credentialsVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(agendaNtfySubscriptionTable.userId, userId))
    .returning();

  const status = mapRowToStatus(saved);
  const publicUrl = getNtfyPublicUrl();
  const { subscribeUrl, appUri } = buildSubscribeUrls(publicUrl, topic);

  return {
    ...status,
    credentials: {
      serverUrl: publicUrl,
      topic,
      username,
      password,
      subscribeUrl,
      appUri,
    },
  };
}

export async function deactivateNtfySubscription(
  userId: string,
): Promise<NtfyStatusResponse> {
  const existing = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: eq(agendaNtfySubscriptionTable.userId, userId),
  });

  if (!existing) {
    return mapRowToStatus(undefined);
  }

  const username = decryptSecret(existing.usernameEncrypted);
  if (username && isNtfyConfigured()) {
    try {
      await deleteNtfyUser(username);
    } catch (error) {
      rethrowNtfyError(error);
    }
  }

  const emptyPasswordEncrypted = encryptSecret("") as string;
  const [saved] = await db
    .update(agendaNtfySubscriptionTable)
    .set({
      enabled: false,
      passwordEncrypted: emptyPasswordEncrypted,
      updatedAt: new Date(),
    })
    .where(eq(agendaNtfySubscriptionTable.userId, userId))
    .returning();

  return mapRowToStatus(saved);
}

export async function sendNtfyTestNotification(
  userId: string,
): Promise<{ ok: boolean; sentAt: string }> {
  if (!isNtfyConfigured()) {
    throw new HTTPException(503, {
      message: "El servidor ntfy no está configurado en esta instancia.",
    });
  }

  const existing = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: eq(agendaNtfySubscriptionTable.userId, userId),
  });

  if (!existing?.enabled) {
    throw new HTTPException(400, {
      message: "Las notificaciones móviles no están activadas.",
    });
  }

  const topic = decryptSecret(existing.topicEncrypted);
  if (!topic) {
    throw new HTTPException(500, {
      message: "No se pudo recuperar el tema privado ntfy.",
    });
  }

  try {
    await publishNtfyMessage({
      topic,
      title: "Prueba de AGENDA",
      body: "Suscripción móvil verificada. Recibirás alertas del Despacho Ministerial por este canal.",
      priority: 3,
      tags: "white_check_mark,shield",
      clickUrl: `${getAgendaPublicUrl()}/dashboard`,
    });
  } catch (error) {
    rethrowNtfyError(error);
  }

  const now = new Date();
  await db
    .update(agendaNtfySubscriptionTable)
    .set({ lastTestAt: now, updatedAt: now })
    .where(eq(agendaNtfySubscriptionTable.userId, userId));

  return { ok: true, sentAt: now.toISOString() };
}

export async function updateNtfyPreferences(
  userId: string,
  input: Partial<NtfyEventPreferences>,
): Promise<NtfyStatusResponse> {
  const existing = await db.query.agendaNtfySubscriptionTable.findFirst({
    where: eq(agendaNtfySubscriptionTable.userId, userId),
  });

  if (!existing) {
    const [inserted] = await db
      .insert(agendaNtfySubscriptionTable)
      .values({
        userId,
        enabled: false,
        topicEncrypted: encryptSecret("") as string,
        usernameEncrypted: encryptSecret("") as string,
        passwordEncrypted: encryptSecret("") as string,
        eventTaskAssigned: input.taskAssigned ?? true,
        eventMentionComment: input.mentionComment ?? true,
        eventDueTomorrow: input.dueTomorrow ?? true,
        eventDueToday: input.dueToday ?? true,
        eventOverdue: input.overdue ?? true,
        eventMinisterOrder: input.ministerOrder ?? true,
      })
      .returning();
    return mapRowToStatus(inserted);
  }

  const [updated] = await db
    .update(agendaNtfySubscriptionTable)
    .set({
      ...(input.taskAssigned !== undefined
        ? { eventTaskAssigned: input.taskAssigned }
        : {}),
      ...(input.mentionComment !== undefined
        ? { eventMentionComment: input.mentionComment }
        : {}),
      ...(input.dueTomorrow !== undefined
        ? { eventDueTomorrow: input.dueTomorrow }
        : {}),
      ...(input.dueToday !== undefined
        ? { eventDueToday: input.dueToday }
        : {}),
      ...(input.overdue !== undefined ? { eventOverdue: input.overdue } : {}),
      ...(input.ministerOrder !== undefined
        ? { eventMinisterOrder: input.ministerOrder }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(agendaNtfySubscriptionTable.userId, userId))
    .returning();

  return mapRowToStatus(updated);
}

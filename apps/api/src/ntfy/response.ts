import { nullableResponseTimestamp, z } from "../openapi";

export const ntfyPreferencesSchema = z
  .object({
    taskAssigned: z.boolean(),
    mentionComment: z.boolean(),
    dueTomorrow: z.boolean(),
    dueToday: z.boolean(),
    overdue: z.boolean(),
    ministerOrder: z.boolean(),
  })
  .openapi("NtfyEventPreferences");

export const ntfyStatusSchema = z
  .object({
    configuredOnServer: z.boolean(),
    enabled: z.boolean(),
    publicUrl: z.string(),
    topic: z.string().nullable(),
    username: z.string().nullable(),
    subscribeUrl: z.string().nullable(),
    appUri: z.string().nullable(),
    credentialsVersion: z.number(),
    lastTestAt: nullableResponseTimestamp,
    preferences: ntfyPreferencesSchema,
  })
  .openapi("NtfyStatus");

export const ntfyOneTimeCredentialsSchema = z
  .object({
    serverUrl: z.string(),
    topic: z.string(),
    username: z.string(),
    password: z.string(),
    subscribeUrl: z.string(),
    appUri: z.string(),
  })
  .openapi("NtfyOneTimeCredentials");

export const ntfyProvisionResponseSchema = ntfyStatusSchema
  .extend({
    credentials: ntfyOneTimeCredentialsSchema,
  })
  .openapi("NtfyProvisionResponse");

export const ntfyTestResponseSchema = z
  .object({
    ok: z.boolean(),
    sentAt: z.string(),
  })
  .openapi("NtfyTestResponse");

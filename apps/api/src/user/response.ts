import { nullableResponseTimestamp, z } from "../openapi";
import { MANAGED_PROFILE_FIELDS } from "../utils/custom-oauth-env";

export const avatarSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description:
        "Public URL for the stored avatar, served from /api/user/avatar/{id}.",
    }),
    size: z.number().openapi({ description: "Decoded size in bytes." }),
  })
  .openapi("UserAvatar");

export const avatarDeletedSchema = z
  .object({
    deleted: z.boolean().openapi({
      description: "False when the user had no uploaded avatar to remove.",
    }),
  })
  .openapi("UserAvatarDeleted");

export const militarProfileSchema = z
  .object({
    cedula: z.string(),
    nacionalidad: z.string().nullable(),
    grado: z.string().nullable(),
    componente: z.string().nullable(),
    unidad: z.string().nullable(),
    sexo: z.string().nullable(),
    insignia: z.string().nullable(),
    fotoUrl: z.string(),
    pendiente: z.boolean(),
    sincronizadoEn: nullableResponseTimestamp,
  })
  .openapi("MilitarProfile");

export const currentUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().nullable(),
    managedProfileFields: z.array(z.enum(MANAGED_PROFILE_FIELDS)).openapi({
      description:
        "Profile fields the custom OAuth/OIDC provider manages for this user. Kaneo updates them at sign-in and refuses changes to them.",
    }),
    militar: militarProfileSchema.nullable(),
  })
  .openapi("CurrentUser");

export const uiPreferencesSchema = z
  .object({
    fontScale: z.enum(["normal", "large", "xlarge", "xxlarge"]),
    highContrast: z.boolean(),
    reduceMotion: z.enum(["system", "always", "never"]),
  })
  .openapi("UiPreferences");

export const savedFilterSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    scope: z.string(),
    name: z.string(),
    filters: z.record(z.string(), z.unknown()),
    createdAt: nullableResponseTimestamp,
    updatedAt: nullableResponseTimestamp,
  })
  .openapi("SavedFilter");

export const savedFilterListSchema = z
  .array(savedFilterSchema)
  .openapi("SavedFilterList");

export const deletedSavedFilterSchema = z
  .object({
    deleted: z.boolean(),
    id: z.string(),
  })
  .openapi("DeletedSavedFilter");

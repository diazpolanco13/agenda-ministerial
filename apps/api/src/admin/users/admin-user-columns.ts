import { sql } from "drizzle-orm";
import { userTable } from "../../database/schema";
import { isBanActive } from "../../utils/user-ban";

/**
 * Columns of an admin directory row. Last activity and sign-in methods are
 * correlated subqueries on indexed user ids, evaluated only for the page.
 * Columns are qualified by hand: Drizzle leaves them bare in one-table selects.
 * Timestamps are stored as UTC without a zone; say so, or the driver reads
 * them in the server's local time.
 */
export const adminUserColumns = {
  id: userTable.id,
  name: userTable.name,
  email: userTable.email,
  emailVerified: userTable.emailVerified,
  isAnonymous: userTable.isAnonymous,
  image: userTable.image,
  createdAt: userTable.createdAt,
  updatedAt: userTable.updatedAt,
  role: userTable.role,
  banned: userTable.banned,
  banReason: userTable.banReason,
  banExpires: userTable.banExpires,
  lastActiveAt: sql<Date | string | null>`(
    SELECT max(s."updated_at") AT TIME ZONE 'UTC'
    FROM "session" s WHERE s."user_id" = "user"."id"
  )`,
  signInMethods: sql<string[]>`(
    SELECT coalesce(array_agg(DISTINCT a."provider_id"), '{}')
    FROM "account" a WHERE a."user_id" = "user"."id"
  )`,
  cedula: sql<string | null>`(
    SELECT mp."cedula"
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
  nacionalidad: sql<string | null>`(
    SELECT mp."nacionalidad"
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
  grado: sql<string | null>`(
    SELECT mp."grado"
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
  componente: sql<string | null>`(
    SELECT mp."componente"
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
  unidad: sql<string | null>`(
    SELECT mp."unidad"
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
  pendiente: sql<boolean | null>`(
    SELECT mp."pendiente"
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
  sincronizadoEn: sql<Date | string | null>`(
    SELECT mp."sincronizado_en" AT TIME ZONE 'UTC'
    FROM "militar_perfil" mp WHERE mp."user_id" = "user"."id"
  )`,
};

type AdminUserRow = {
  [Key in keyof typeof adminUserColumns]: Key extends
    | "lastActiveAt"
    | "sincronizadoEn"
    ? Date | string | null
    : Key extends "signInMethods"
      ? string[]
      : Key extends
            | "cedula"
            | "nacionalidad"
            | "grado"
            | "componente"
            | "unidad"
        ? string | null
        : Key extends "pendiente"
          ? boolean | null
          : (typeof userTable.$inferSelect)[Key &
              keyof typeof userTable.$inferSelect];
};

const iso = (value: Date | string) => new Date(value).toISOString();

export function toAdminUser(row: AdminUserRow) {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    banned: isBanActive(row),
    isAnonymous: row.isAnonymous ?? false,
    banExpires: row.banExpires ? iso(row.banExpires) : null,
    lastActiveAt: row.lastActiveAt ? iso(row.lastActiveAt) : null,
    signInMethods: [...row.signInMethods].sort(),
    pendiente: row.pendiente ?? null,
    sincronizadoEn: row.sincronizadoEn ? iso(row.sincronizadoEn) : null,
  };
}

import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
import { hasInstanceAdminRole } from "./instance-admin-role";
import { isInstanceAdmin } from "./is-instance-admin";
import { splitRoles } from "./split-roles";

const PRIVILEGED_ROLES = new Set([
  "owner",
  "admin",
  "ministro",
  "jefe_despacho",
  "secretaria",
]);

function isResponsableOnlyRoles(role: string | null | undefined): boolean {
  const roles = splitRoles(role);
  if (!roles.includes("responsable")) return false;
  return !roles.some((item) => PRIVILEGED_ROLES.has(item));
}

/**
 * Determina si el usuario tiene el rol restringido `responsable` en el workspace
 * (no es administrador de instancia, no es `owner` y su membresía solo incluye
 * `responsable` sin roles superiores como `ministro`, `jefe_despacho`, `secretaria` o `admin`).
 */
export async function isRestrictedResponsable(
  cOrUserId: Context | string,
  workspaceId: string,
): Promise<boolean> {
  if (!workspaceId) return false;

  let userId: string | undefined;
  if (typeof cOrUserId === "string") {
    userId = cOrUserId;
    if (!userId) return false;

    const [user] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (hasInstanceAdminRole(user?.role)) {
      return false;
    }
  } else {
    userId = cOrUserId.get("userId") as string | undefined;
    if (!userId) return false;
    if (await isInstanceAdmin(cOrUserId)) {
      return false;
    }
  }

  const [member] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  if (!member) return false;
  return isResponsableOnlyRoles(member.role);
}

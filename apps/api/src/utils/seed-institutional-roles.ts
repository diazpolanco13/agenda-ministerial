import {
  CUSTOM_INSTITUTIONAL_ROLES,
  INSTITUTIONAL_INSTANCE_ROLE_PERMISSIONS,
  INSTITUTIONAL_WORKSPACE_ROLE_PERMISSIONS,
} from "@kaneo/permissions";
import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";

/**
 * Siembra de manera idempotente los roles institucionales de AGENDA
 * (`ministro`, `jefe_despacho`, `secretaria`, `responsable`, `consulta`) tanto
 * en `instance_role` como en `workspace_role` para todos los workspaces.
 */
export async function seedInstitutionalRoles() {
  const now = new Date();

  // 1. Roles de instancia
  const existingInstanceRoles = await db
    .select({
      id: schema.instanceRoleTable.id,
      name: schema.instanceRoleTable.name,
    })
    .from(schema.instanceRoleTable)
    .where(
      inArray(
        schema.instanceRoleTable.name,
        CUSTOM_INSTITUTIONAL_ROLES as unknown as string[],
      ),
    );
  const existingInstanceNames = new Set(
    existingInstanceRoles.map((r) => r.name),
  );

  for (const roleName of CUSTOM_INSTITUTIONAL_ROLES) {
    const permissions = [...INSTITUTIONAL_INSTANCE_ROLE_PERMISSIONS[roleName]];
    if (existingInstanceNames.has(roleName)) {
      await db
        .update(schema.instanceRoleTable)
        .set({ permissions, updatedAt: now })
        .where(eq(schema.instanceRoleTable.name, roleName));
    } else {
      await db.insert(schema.instanceRoleTable).values({
        name: roleName,
        permissions,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 2. Roles de workspace en todos los workspaces existentes
  const workspaces = await db
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable);

  if (workspaces.length === 0) return;

  const workspaceIds = workspaces.map((w) => w.id);
  const existingWsRoles = await db
    .select({
      workspaceId: schema.workspaceRoleTable.workspaceId,
      role: schema.workspaceRoleTable.role,
    })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        inArray(schema.workspaceRoleTable.workspaceId, workspaceIds),
        inArray(
          schema.workspaceRoleTable.role,
          CUSTOM_INSTITUTIONAL_ROLES as unknown as string[],
        ),
      ),
    );

  const present = new Set(
    existingWsRoles.map((r) => `${r.workspaceId}:${r.role}`),
  );

  const rows: Array<typeof schema.workspaceRoleTable.$inferInsert> = [];
  for (const workspaceId of workspaceIds) {
    for (const roleName of CUSTOM_INSTITUTIONAL_ROLES) {
      if (present.has(`${workspaceId}:${roleName}`)) continue;
      rows.push({
        workspaceId,
        role: roleName,
        permission: JSON.stringify(
          INSTITUTIONAL_WORKSPACE_ROLE_PERMISSIONS[roleName],
        ),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (rows.length > 0) {
    const BATCH_SIZE = 1000;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await db
        .insert(schema.workspaceRoleTable)
        .values(rows.slice(i, i + BATCH_SIZE));
    }
  }
}

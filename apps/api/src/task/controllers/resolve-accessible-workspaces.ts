import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import {
  userTable,
  workspaceRoleTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import {
  rolesAllow,
  type StoredRolePermission,
} from "../../utils/role-permissions";
import { splitRoles } from "../../utils/split-roles";

export async function resolveReadableTaskWorkspaces(
  workspaceId: string,
  userId: string,
  allWorkspaces: boolean,
): Promise<string[]> {
  if (!allWorkspaces) {
    return [workspaceId];
  }

  const [userRow] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (hasInstanceAdminRole(userRow?.role)) {
    const active = await db
      .select({ id: workspaceTable.id })
      .from(workspaceTable)
      .where(isNull(workspaceTable.archivedAt));
    return active.length ? active.map((w) => w.id) : [workspaceId];
  }

  const memberships = await db
    .select({
      workspaceId: workspaceUserTable.workspaceId,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(
      workspaceTable,
      eq(workspaceUserTable.workspaceId, workspaceTable.id),
    )
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        isNull(workspaceTable.archivedAt),
      ),
    );

  if (memberships.length === 0) {
    return [workspaceId];
  }

  const wsIds = memberships.map((m) => m.workspaceId);
  const allRoles = [...new Set(memberships.flatMap((m) => splitRoles(m.role)))];
  const stored = allRoles.length
    ? await db
        .select({
          workspaceId: workspaceRoleTable.workspaceId,
          role: workspaceRoleTable.role,
          permission: workspaceRoleTable.permission,
        })
        .from(workspaceRoleTable)
        .where(
          and(
            inArray(workspaceRoleTable.workspaceId, wsIds),
            inArray(workspaceRoleTable.role, allRoles),
          ),
        )
    : [];

  const byWorkspace = new Map<string, StoredRolePermission[]>();
  for (const row of stored) {
    const list = byWorkspace.get(row.workspaceId) ?? [];
    list.push({ role: row.role, permission: row.permission });
    byWorkspace.set(row.workspaceId, list);
  }

  const allowed = memberships
    .filter((m) =>
      rolesAllow(splitRoles(m.role), byWorkspace.get(m.workspaceId) ?? [], {
        project: ["read"],
        task: ["read"],
      }),
    )
    .map((m) => m.workspaceId);

  return allowed.length ? allowed : [workspaceId];
}

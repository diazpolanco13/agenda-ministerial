import { and, eq, ne, or, type SQL } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { splitRoles } from "../utils/split-roles";

export const CONFIDENTIALITY_LEVELS = [
  "publica_interna",
  "reservada",
  "confidencial",
] as const;

export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number];

const PRIVILEGED_CONFIDENTIAL_ROLES = new Set([
  "owner",
  "admin",
  "ministro",
  "jefe_despacho",
]);

export function hasConfidentialRole(role: string | null | undefined): boolean {
  const roles = splitRoles(role);
  return roles.some((item) => PRIVILEGED_CONFIDENTIAL_ROLES.has(item));
}

export function normalizeConfidentialityLevel(
  value: string | null | undefined,
): ConfidentialityLevel {
  if (
    value === "publica_interna" ||
    value === "reservada" ||
    value === "confidencial"
  ) {
    return value;
  }
  return "publica_interna";
}

export async function canViewConfidentialInWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  if (!userId || !workspaceId) return false;

  const [userRow, memberRow] = await Promise.all([
    db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1),
    db
      .select({ role: workspaceUserTable.role })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      )
      .limit(1),
  ]);

  if (hasInstanceAdminRole(userRow[0]?.role)) return true;
  if (!memberRow[0]) return false;
  return hasConfidentialRole(memberRow[0].role);
}

export async function canApproveOrdersInWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return canViewConfidentialInWorkspace(userId, workspaceId);
}

export async function getConfidentialAuthorizedWorkspaceIds(
  userId: string,
): Promise<Set<string>> {
  if (!userId) return new Set();

  const [userRow, memberships] = await Promise.all([
    db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1),
    db
      .select({
        workspaceId: workspaceUserTable.workspaceId,
        role: workspaceUserTable.role,
      })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.userId, userId)),
  ]);

  const isInstAdmin = hasInstanceAdminRole(userRow[0]?.role);
  const authorized = new Set<string>();
  for (const membership of memberships) {
    if (isInstAdmin || hasConfidentialRole(membership.role)) {
      authorized.add(membership.workspaceId);
    }
  }
  return authorized;
}

export function canAccessConfidentialTask(params: {
  userId: string;
  taskConfidentiality: string | null | undefined;
  projectConfidentiality?: string | null | undefined;
  assigneeId: string | null | undefined;
  createdBy: string | null | undefined;
  hasRoleAccess: boolean;
}): boolean {
  const isConfidential =
    params.taskConfidentiality === "confidencial" ||
    params.projectConfidentiality === "confidencial";
  if (!isConfidential) return true;
  if (params.hasRoleAccess) return true;
  if (params.assigneeId && params.assigneeId === params.userId) return true;
  if (params.createdBy && params.createdBy === params.userId) return true;
  return false;
}

export function taskConfidentialitySqlFilter(
  userId: string,
  hasRoleAccess: boolean,
): SQL | undefined {
  if (hasRoleAccess) return undefined;
  return or(
    and(
      ne(taskTable.confidentialityLevel, "confidencial"),
      ne(projectTable.confidentialityLevel, "confidencial"),
    ),
    eq(taskTable.userId, userId),
    eq(taskTable.createdBy, userId),
  );
}

export function projectConfidentialitySqlFilter(
  hasRoleAccess: boolean,
): SQL | undefined {
  if (hasRoleAccess) return undefined;
  return ne(projectTable.confidentialityLevel, "confidencial");
}

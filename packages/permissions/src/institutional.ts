import { adminAc, memberAc } from "better-auth/plugins/organization/access";
import type { CustomRolePermission } from "./instance.js";

export const INSTITUTIONAL_ROLES = [
  "ministro",
  "jefe_despacho",
  "secretaria",
  "responsable",
  "consulta",
  "admin",
] as const;

export type InstitutionalRole = (typeof INSTITUTIONAL_ROLES)[number];

export type CustomInstitutionalRole = Exclude<InstitutionalRole, "admin">;

export const CUSTOM_INSTITUTIONAL_ROLES: readonly CustomInstitutionalRole[] = [
  "ministro",
  "jefe_despacho",
  "secretaria",
  "responsable",
  "consulta",
];

export const INSTITUTIONAL_ROLE_LABELS: Record<InstitutionalRole, string> = {
  ministro: "Ministro",
  jefe_despacho: "Jefe de Despacho",
  secretaria: "Secretaría",
  responsable: "Responsable",
  consulta: "Consulta",
  admin: "Administrador",
};

export const INSTITUTIONAL_INSTANCE_ROLE_PERMISSIONS: Record<
  CustomInstitutionalRole,
  readonly CustomRolePermission[]
> = {
  ministro: ["users:read", "workspaces:read", "audit:read", "system:read"],
  jefe_despacho: [
    "users:read",
    "users:create",
    "users:update",
    "users:disable",
    "workspaces:read",
    "workspaces:manage",
    "audit:read",
  ],
  secretaria: ["users:read", "users:create"],
  responsable: [],
  consulta: [],
};

function copyStatements(
  statements: Record<string, readonly string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(statements)) {
    out[k] = [...v];
  }
  return out;
}

export const INSTITUTIONAL_WORKSPACE_ROLE_PERMISSIONS: Record<
  CustomInstitutionalRole,
  Record<string, string[]>
> = {
  ministro: {
    ...copyStatements(memberAc.statements),
    project: ["create", "read", "update", "delete", "share"],
    task: ["create", "read", "update", "delete", "assign"],
    label: ["create", "read", "update", "delete"],
    workspace: ["read", "update"],
  },
  jefe_despacho: {
    ...copyStatements(adminAc.statements),
    project: ["create", "read", "update", "delete", "share"],
    task: ["create", "read", "update", "delete", "assign"],
    label: ["create", "read", "update", "delete"],
    workspace: ["read", "update", "manage_settings"],
  },
  secretaria: {
    ...copyStatements(memberAc.statements),
    project: ["create", "read", "update"],
    task: ["create", "read", "update", "assign"],
    label: ["create", "read", "update"],
    workspace: ["read"],
  },
  responsable: {
    ...copyStatements(memberAc.statements),
    project: ["read"],
    task: ["read", "update"],
    label: ["read"],
    workspace: ["read"],
  },
  consulta: {
    ...copyStatements(memberAc.statements),
    project: ["read"],
    task: ["read"],
    label: ["read"],
    workspace: ["read"],
  },
};

export function isInstitutionalRole(
  value: unknown,
): value is InstitutionalRole {
  return (INSTITUTIONAL_ROLES as readonly unknown[]).includes(value);
}

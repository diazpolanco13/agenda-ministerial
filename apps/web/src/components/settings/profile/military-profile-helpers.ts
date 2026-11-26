import {
  INSTITUTIONAL_ROLE_LABELS,
  isInstitutionalRole,
} from "@kaneo/permissions";

export const DEMO_MILITAR_PREVIEW = {
  cedula: "00000000",
  nacionalidad: "V" as const,
  grado: "CORONEL",
  componente: "EJB",
  unidad: "Despacho Ministerial — Unidad de Demostración",
} as const;

export function resolveInstitutionalRoleLabel(
  role: string | null | undefined,
): string {
  if (!role) return "Usuario";
  const primary = role.split(",")[0]?.trim() ?? role;
  if (isInstitutionalRole(primary)) {
    return INSTITUTIONAL_ROLE_LABELS[primary];
  }
  return primary === "user" ? "Usuario" : primary;
}

export function isDemoUserEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return (
    normalized.startsWith("qa") ||
    normalized.startsWith("demo") ||
    normalized.includes(".demo@") ||
    normalized.includes("qa@")
  );
}

export function hasAdminUserRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role
    .split(",")
    .map((part) => part.trim())
    .includes("admin");
}

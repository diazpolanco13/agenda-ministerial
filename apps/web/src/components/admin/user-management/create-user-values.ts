import type { CreateAdminUserRequest } from "@/fetchers/admin/types";
import { normalizeCedulaInput } from "@/lib/military-assets";

export type CreateUserValues = {
  name: string;
  email: string;
  role: string;
  cedula?: string;
  nacionalidad?: string;
  grado?: string;
  componente?: string;
  unidad?: string;
  generarContrasenaTemporal?: boolean;
};

export const EMPTY_CREATE_USER_VALUES: CreateUserValues = {
  name: "",
  email: "",
  role: "user",
  cedula: "",
  nacionalidad: "V",
  grado: "",
  componente: "",
  unidad: "",
  generarContrasenaTemporal: false,
};

export function buildCreateUserRequest(
  values: CreateUserValues,
): CreateAdminUserRequest | null {
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const rawCedula = values.cedula?.trim() ?? "";
  const normalizedCedula = rawCedula ? normalizeCedulaInput(rawCedula) : null;

  if (!name) return null;
  if (rawCedula && !normalizedCedula) return null;
  if (!email && !normalizedCedula) return null;

  return {
    name,
    ...(email ? { email } : {}),
    role: values.role,
    ...(normalizedCedula ? { cedula: normalizedCedula } : {}),
    ...(normalizedCedula && values.nacionalidad?.trim()
      ? { nacionalidad: values.nacionalidad.trim().toUpperCase() }
      : {}),
    ...(values.grado?.trim() ? { grado: values.grado.trim() } : {}),
    ...(values.componente?.trim()
      ? { componente: values.componente.trim() }
      : {}),
    ...(values.unidad?.trim() ? { unidad: values.unidad.trim() } : {}),
    ...(values.generarContrasenaTemporal
      ? { generarContrasenaTemporal: true }
      : {}),
  };
}

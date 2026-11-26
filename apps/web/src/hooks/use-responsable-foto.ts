import { useMemo } from "react";
import { getAssigneeColor } from "@/lib/agenda-palette";
import { getInitials } from "@/lib/get-initials";

const RANK_PREFIXES = new Set([
  "G/J",
  "M/G",
  "G/D",
  "G/B",
  "ALM.",
  "ALM",
  "V/A",
  "C/A",
  "C/N",
  "CNEL.",
  "CNEL",
  "TCNEL.",
  "TCNEL",
  "MAY.",
  "MAY",
  "CAP.",
  "CAP",
  "PTTE.",
  "PTTE",
  "TTE.",
  "TTE",
  "S/S",
  "S/A",
  "S/M1",
  "S/M2",
  "S/M3",
  "S/1",
  "S/2",
]);

/**
 * Extrae iniciales legibles omitiendo abreviaturas de grado militar venezolano
 * cuando existen nombres propios después del grado.
 */
export function getResponsableInitials(
  name: string | null | undefined,
  fallback = "??",
): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return getInitials(null, fallback);

  const withoutRank =
    parts.length > 1 && RANK_PREFIXES.has(parts[0].toUpperCase())
      ? parts.slice(1)
      : parts;

  return getInitials(withoutRank.join(" "), fallback);
}

export type UseResponsableFotoOptions = {
  userId?: string | null;
  image?: string | null;
  name?: string | null;
};

/**
 * Punto único de resolución de foto e iniciales de responsables.
 *
 * Fase 4 (integración SIGEFANB): aquí se conectará el lookup de foto oficial
 * por cédula/usuario en SIGEFANB (RustFS / API SIGEFANB) cuando `image` local
 * no esté definida.
 */
export function useResponsableFoto({
  userId,
  image,
  name,
}: UseResponsableFotoOptions) {
  return useMemo(() => {
    const src = image?.trim() ? image : null;
    const initials = getResponsableInitials(name, "?");
    const swatch = getAssigneeColor(userId || name || "unassigned");
    return {
      src,
      initials,
      swatch,
    };
  }, [userId, image, name]);
}

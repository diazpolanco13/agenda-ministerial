import { useCallback, useMemo, useState } from "react";
import { getAssigneeColor } from "@/lib/agenda-palette";
import { getInitials } from "@/lib/get-initials";

const failedFotoUrls = new Set<string>();

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

export type MilitaryProfileMeta = {
  cedula?: string | null;
  nacionalidad?: string | null;
  grado?: string | null;
  componente?: string | null;
  unidad?: string | null;
};

export function indexMilitaryProfiles(
  members: ReadonlyArray<{ id: string } & MilitaryProfileMeta> | undefined,
): Map<string, MilitaryProfileMeta> {
  const map = new Map<string, MilitaryProfileMeta>();
  for (const member of members ?? []) {
    if (member.cedula || member.grado || member.componente || member.unidad) {
      map.set(member.id, {
        cedula: member.cedula ?? null,
        nacionalidad: member.nacionalidad ?? null,
        grado: member.grado ?? null,
        componente: member.componente ?? null,
        unidad: member.unidad ?? null,
      });
    }
  }
  return map;
}

export function resolvePersonMilitary(
  userId: string | null | undefined,
  byUserId: ReadonlyMap<string, MilitaryProfileMeta>,
  tasks?: ReadonlyArray<{
    assigneeCedula?: string | null;
    assigneeGrado?: string | null;
    assigneeComponente?: string | null;
    assigneeUnidad?: string | null;
  }>,
): MilitaryProfileMeta {
  const fromMember = userId ? byUserId.get(userId) : undefined;
  const fromTask = tasks?.find(
    (task) =>
      task.assigneeCedula ||
      task.assigneeGrado ||
      task.assigneeComponente ||
      task.assigneeUnidad,
  );
  return {
    cedula: fromMember?.cedula ?? fromTask?.assigneeCedula ?? null,
    nacionalidad: fromMember?.nacionalidad ?? null,
    grado: fromMember?.grado ?? fromTask?.assigneeGrado ?? null,
    componente: fromMember?.componente ?? fromTask?.assigneeComponente ?? null,
    unidad: fromMember?.unidad ?? fromTask?.assigneeUnidad ?? null,
  };
}

export type UseResponsableFotoOptions = {
  userId?: string | null;
  cedula?: string | null;
  image?: string | null;
  name?: string | null;
};

/**
 * Punto único de resolución de foto e iniciales de responsables.
 * Prioriza la foto oficial SIGEFANB (`/api/sigefanb/foto/${cedula}`) cuando
 * hay cédula y no ha fallado en memoria; si falla, cae a `image` local o a
 * iniciales institucionales.
 */
export function useResponsableFoto({
  userId,
  cedula,
  image,
  name,
}: UseResponsableFotoOptions) {
  const [, setErrorVersion] = useState(0);

  const cleanCedula = cedula?.trim() || null;
  const sigefanbSrc = cleanCedula
    ? `/api/sigefanb/foto/${encodeURIComponent(cleanCedula)}`
    : null;
  const cleanImage = image?.trim() || null;

  const sigefanbFailed = Boolean(
    sigefanbSrc && failedFotoUrls.has(sigefanbSrc),
  );
  const localFailed = Boolean(cleanImage && failedFotoUrls.has(cleanImage));

  const markFailed = useCallback((url: string | null | undefined) => {
    if (!url || failedFotoUrls.has(url)) return;
    failedFotoUrls.add(url);
    setErrorVersion((version) => version + 1);
  }, []);

  return useMemo(() => {
    const canUseSigefanb = Boolean(sigefanbSrc && !sigefanbFailed);
    const canUseLocal = Boolean(cleanImage && !localFailed);

    const src = canUseSigefanb ? sigefanbSrc : canUseLocal ? cleanImage : null;
    const fallbackSrc = canUseSigefanb && canUseLocal ? cleanImage : null;

    const initials = getResponsableInitials(name, "?");
    const swatch = getAssigneeColor(userId || name || "unassigned");

    return {
      src,
      fallbackSrc,
      initials,
      swatch,
      markFailed,
    };
  }, [
    userId,
    sigefanbSrc,
    sigefanbFailed,
    cleanImage,
    localFailed,
    name,
    markFailed,
  ]);
}

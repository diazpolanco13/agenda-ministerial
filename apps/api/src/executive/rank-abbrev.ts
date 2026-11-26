import { formatGrado, rankInsignia } from "../sigefanb/military-assets";

const RANK_ABBREVIATIONS: Record<string, string> = {
  "general en jefe": "G/J",
  "mayor general": "M/G",
  "general de division": "G/D",
  "general de brigada": "G/B",
  "almirante en jefe": "A/J",
  almirante: "Alm.",
  vicealmirante: "V/A",
  contralmirante: "C/A",
  "capitan de navio": "C/N",
  "capitan de fragata": "C/F",
  "capitan de corbeta": "C/C",
  "teniente de navio": "T/N",
  "teniente de fragata": "T/F",
  "teniente de corbeta": "T/C",
  "teniente coronel": "Tcnel.",
  coronel: "Cnel.",
  "primer teniente": "Ptte.",
  teniente: "Tte.",
  capitan: "Cap.",
  mayor: "May.",
  "sargento supervisor": "S/S",
  "sargento ayudante": "S/A",
  "sargento mayor de primera": "S/M1",
  "sargento mayor de segunda": "S/M2",
  "sargento mayor de tercera": "S/M3",
  "sargento primero": "S/1",
  "sargento segundo": "S/2",
  "cabo primero": "C/1",
  "cabo segundo": "C/2",
};

const KNOWN_ABBREV_PREFIXES = new Set(
  Object.values(RANK_ABBREVIATIONS).map((value) =>
    value.replace(/\.$/, "").toUpperCase(),
  ),
);

function normalizeRankText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte un grado militar venezolano a su abreviatura institucional corta
 * (ej. "Coronel" -> "Cnel.", "Mayor General" -> "M/G").
 */
export function abreviarGrado(
  grado: string | null | undefined,
  componente?: string | null,
  unidad?: string | null,
): string | null {
  const raw = grado?.trim();
  if (!raw) return null;

  const formatted = formatGrado(raw, componente, unidad) || raw;
  const normalized = normalizeRankText(formatted);
  if (RANK_ABBREVIATIONS[normalized]) {
    return RANK_ABBREVIATIONS[normalized];
  }

  for (const [key, abbr] of Object.entries(RANK_ABBREVIATIONS)) {
    if (normalized.includes(key)) {
      return abbr;
    }
  }

  return formatted;
}

/**
 * Devuelve un nombre corto legible sin duplicar prefijos de grado.
 * Para nombres compuestos tipo "Carlos Eduardo Herrera", toma primer nombre y
 * primer apellido; para "Herrera" o "Carlos Herrera", respeta la forma breve.
 */
export function shortDisplayName(name: string | null | undefined): string {
  const tokens = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstToken = tokens[0];
  if (!firstToken) return "";

  const firstNormalized = firstToken.replace(/\.$/, "").toUpperCase();
  const cleanTokens =
    tokens.length > 1 && KNOWN_ABBREV_PREFIXES.has(firstNormalized)
      ? tokens.slice(1)
      : tokens;

  if (cleanTokens.length <= 2) {
    return cleanTokens.join(" ");
  }

  return `${cleanTokens[0]} ${cleanTokens[cleanTokens.length - 2]}`;
}

export function resolveMilitarySummaryMeta(input: {
  grado: string | null | undefined;
  componente: string | null | undefined;
  unidad: string | null | undefined;
  cedula: string | null | undefined;
  image: string | null | undefined;
}) {
  const formattedGrado = input.grado
    ? formatGrado(input.grado, input.componente, input.unidad) || input.grado
    : null;
  const insignia = formattedGrado
    ? (rankInsignia(formattedGrado, input.componente, input.unidad)?.src ??
      null)
    : null;
  const fotoUrl = input.cedula?.trim()
    ? `/api/sigefanb/foto/${encodeURIComponent(input.cedula.trim())}`
    : (input.image ?? null);

  return {
    grado: formattedGrado,
    insignia,
    fotoUrl,
  };
}

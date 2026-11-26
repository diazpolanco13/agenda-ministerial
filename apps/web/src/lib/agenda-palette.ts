/**
 * Paleta viva institucional armónica con SIGEFANB (oliva, azul marino, dorado,
 * carmesí, turquesa, magenta, cobalto, ámbar) con soporte claro/oscuro.
 */

export type AgendaColorSwatch = {
  /** Color sólido principal de barra / acento */
  fill: string;
  /** Color sólido para modo oscuro (o CSS light-dark / clase, aquí usamos variables y hex accesibles en ambos temas) */
  fillDark: string;
  /** Borde nítido */
  border: string;
  /** Fondo suave para chips / badges / leyendas */
  tint: string;
  /** Texto contrastante sobre fill */
  onFill: string;
  /** Texto sobre tint */
  text: string;
};

export const AGENDA_VIVID_PALETTE: readonly AgendaColorSwatch[] = [
  {
    // Verde oliva institucional
    fill: "#556b2f",
    fillDark: "#7fa646",
    border: "#3f5122",
    tint: "rgba(85, 107, 47, 0.14)",
    onFill: "#ffffff",
    text: "#3f5122",
  },
  {
    // Azul marino SIGEFANB
    fill: "#213368",
    fillDark: "#4f72c4",
    border: "#18264f",
    tint: "rgba(33, 51, 104, 0.14)",
    onFill: "#ffffff",
    text: "#213368",
  },
  {
    // Dorado ministerial
    fill: "#c59018",
    fillDark: "#e3b341",
    border: "#9c7010",
    tint: "rgba(197, 144, 24, 0.16)",
    onFill: "#1a1405",
    text: "#8a620b",
  },
  {
    // Turquesa vivo
    fill: "#178582",
    fillDark: "#2bb3ad",
    border: "#0f6360",
    tint: "rgba(23, 133, 130, 0.14)",
    onFill: "#ffffff",
    text: "#0f6360",
  },
  {
    // Magenta / púrpura institucional
    fill: "#a33378",
    fillDark: "#d45ca4",
    border: "#7f245c",
    tint: "rgba(163, 51, 120, 0.14)",
    onFill: "#ffffff",
    text: "#7f245c",
  },
  {
    // Rojo carmesí
    fill: "#c83737",
    fillDark: "#e55353",
    border: "#9e2525",
    tint: "rgba(200, 55, 55, 0.14)",
    onFill: "#ffffff",
    text: "#9e2525",
  },
  {
    // Azul cobalto
    fill: "#2563eb",
    fillDark: "#60a5fa",
    border: "#1d4ed8",
    tint: "rgba(37, 99, 235, 0.14)",
    onFill: "#ffffff",
    text: "#1d4ed8",
  },
  {
    // Ámbar terracota
    fill: "#d97706",
    fillDark: "#f59e0b",
    border: "#b45309",
    tint: "rgba(217, 119, 6, 0.15)",
    onFill: "#ffffff",
    text: "#b45309",
  },
] as const;

export const GANTT_SUMMARY_COLOR = {
  fill: "#4f8f29",
  fillDark: "#65a30d",
  text: "#356618",
  textDark: "#a3e635",
  trackBg: "rgba(79, 143, 41, 0.22)",
} as const;

export function hashColorIndex(seed: string, length: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

export function getGroupColor(index: number): AgendaColorSwatch {
  const safeIndex =
    ((index % AGENDA_VIVID_PALETTE.length) + AGENDA_VIVID_PALETTE.length) %
    AGENDA_VIVID_PALETTE.length;
  return AGENDA_VIVID_PALETTE[safeIndex];
}

export function getStatusColor(
  status: string,
  isFinal = false,
): AgendaColorSwatch {
  if (isFinal) return AGENDA_VIVID_PALETTE[0]; // Oliva / completado
  const normalized = status.trim().toLowerCase();
  if (
    normalized === "done" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "archived"
  ) {
    return AGENDA_VIVID_PALETTE[0];
  }
  if (normalized === "in-progress" || normalized === "in_progress") {
    return AGENDA_VIVID_PALETTE[6]; // Azul cobalto vivo
  }
  if (normalized === "in-review" || normalized === "review") {
    return AGENDA_VIVID_PALETTE[4]; // Magenta
  }
  if (normalized === "blocked" || normalized === "on-hold") {
    return AGENDA_VIVID_PALETTE[5]; // Rojo carmesí
  }
  if (normalized === "to-do" || normalized === "todo" || normalized === "planned") {
    return AGENDA_VIVID_PALETTE[2]; // Dorado
  }
  return AGENDA_VIVID_PALETTE[
    hashColorIndex(normalized || "status", AGENDA_VIVID_PALETTE.length)
  ];
}

export function getPriorityColor(priority: string | null | undefined): AgendaColorSwatch {
  const normalized = (priority ?? "no-priority").trim().toLowerCase();
  switch (normalized) {
    case "urgent":
      return AGENDA_VIVID_PALETTE[5]; // Rojo carmesí
    case "high":
      return AGENDA_VIVID_PALETTE[7]; // Ámbar
    case "medium":
      return AGENDA_VIVID_PALETTE[2]; // Dorado
    case "low":
      return AGENDA_VIVID_PALETTE[3]; // Turquesa
    default:
      return AGENDA_VIVID_PALETTE[1]; // Azul marino
  }
}

export function getAssigneeColor(seed: string | null | undefined): AgendaColorSwatch {
  const value = seed?.trim();
  if (!value) {
    return AGENDA_VIVID_PALETTE[1];
  }
  return AGENDA_VIVID_PALETTE[hashColorIndex(value, AGENDA_VIVID_PALETTE.length)];
}

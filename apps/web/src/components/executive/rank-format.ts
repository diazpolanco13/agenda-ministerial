const CARACAS_TIMEZONE = "America/Caracas";

const RANK_PREFIXES = new Set([
  "G/J",
  "M/G",
  "G/D",
  "G/B",
  "A/J",
  "ALM",
  "V/A",
  "C/A",
  "C/N",
  "C/F",
  "C/C",
  "T/N",
  "T/F",
  "T/C",
  "CNEL",
  "TCNEL",
  "MAY",
  "CAP",
  "PTTE",
  "TTE",
  "S/S",
  "S/A",
  "S/M1",
  "S/M2",
  "S/M3",
  "S/1",
  "S/2",
  "C/1",
  "C/2",
]);

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

export function abbreviateMilitaryRank(
  grado: string | null | undefined,
): string | null {
  const raw = grado?.trim();
  if (!raw) return null;
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return RANK_ABBREVIATIONS[normalized] ?? raw;
}

export function stripRankPrefix(name: string | null | undefined): string {
  const tokens = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstToken = tokens[0];
  if (!firstToken) return "";
  const first = firstToken.replace(/\.$/, "").toUpperCase();
  const clean =
    tokens.length > 1 && RANK_PREFIXES.has(first) ? tokens.slice(1) : tokens;
  return clean.join(" ");
}

export function getCaracasGreeting(now = new Date()): string {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: CARACAS_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = Number.parseInt(hourStr, 10);
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function formatCaracasLongDate(now = new Date()): string {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

export function getCaracasDayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CARACAS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatCaracasTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const hhmm = new Intl.DateTimeFormat("en-US", {
    timeZone: CARACAS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (hhmm === "00:00" || hhmm === "24:00") return null;
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatCaracasDueStatus(
  dueDate: string | null,
  completada = false,
): {
  label: string;
  tone: "overdue" | "today" | "upcoming" | "completed" | "none";
} {
  if (!dueDate) {
    return {
      label: completada ? "Cumplida" : "Sin plazo",
      tone: completada ? "completed" : "none",
    };
  }

  const todayKey = getCaracasDayKey(new Date());
  const dueKey = getCaracasDayKey(dueDate);
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  const dueMs = Date.parse(`${dueKey}T00:00:00Z`);
  const diffDays = Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000));

  const shortDate = new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(dueDate));

  if (completada) {
    return { label: shortDate, tone: "completed" };
  }
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return {
      label: abs === 1 ? "Venció ayer" : `Vencida (${abs}d)`,
      tone: "overdue",
    };
  }
  if (diffDays === 0) {
    return { label: "Vence hoy", tone: "today" };
  }
  if (diffDays === 1) {
    return { label: "Mañana", tone: "upcoming" };
  }
  return { label: shortDate, tone: "upcoming" };
}

export function formatCaracasActivityDay(
  dayKey: string,
  isoTime: string,
): string {
  const todayKey = getCaracasDayKey(new Date());
  const yesterdayKey = getCaracasDayKey(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const time = new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoTime));

  if (dayKey === todayKey) return `Hoy, ${time}`;
  if (dayKey === yesterdayKey) return `Ayer, ${time}`;

  const parsed = new Date(`${dayKey}T12:00:00-04:00`);
  const dateLabel = new Intl.DateTimeFormat("es-VE", {
    timeZone: CARACAS_TIMEZONE,
    day: "numeric",
    month: "short",
  }).format(parsed);
  return `${dateLabel}, ${time}`;
}

import type { DiscursoPrioridad } from "./types";

export type PlazoParseResult = {
  fechaIso: string | null;
  textoDetectado: string | null;
  prioridadSugerida?: DiscursoPrioridad;
};

// Venezuela utiliza UTC-4 fijo sin horario de verano.
const CARACAS_OFFSET_MS = -4 * 60 * 60 * 1000;

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

const NUMEROS_TEXTO: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  sesenta: 60,
  noventa: 90,
};

type FechaParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dayOfWeek: number; // 0-6 (domingo=0)
};

function toCaracasParts(date: Date): FechaParts {
  const shifted = new Date(date.getTime() + CARACAS_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function formatFechaIso(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function addDays(base: FechaParts, days: number): FechaParts {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dayOfWeek: d.getUTCDay(),
  };
}

function addBusinessDays(base: FechaParts, businessDays: number): FechaParts {
  let current = base;
  let remaining = Math.max(0, businessDays);
  while (remaining > 0) {
    current = addDays(current, 1);
    if (current.dayOfWeek !== 0 && current.dayOfWeek !== 6) {
      remaining -= 1;
    }
  }
  return current;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseCantidad(token: string): number | null {
  const cleaned = token.trim().toLowerCase();
  if (/^\d+$/.test(cleaned)) {
    const parsed = Number.parseInt(cleaned, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return NUMEROS_TEXTO[cleaned] ?? null;
}

function prioridadPorDias(days: number): DiscursoPrioridad {
  if (days <= 1) return "urgent";
  if (days <= 3) return "high";
  if (days <= 14) return "medium";
  return "low";
}

function diffDays(from: FechaParts, to: FechaParts): number {
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / (24 * 60 * 60 * 1000));
}

/**
 * Interpreta expresiones de plazo en español venezolano usando `America/Caracas` (UTC-4).
 */
export function parsePlazoEspanol(
  texto: string,
  fechaBase: Date = new Date(),
): PlazoParseResult {
  const source = texto.trim();
  if (!source) {
    return { fechaIso: null, textoDetectado: null };
  }

  const base = toCaracasParts(fechaBase);

  // 1. ISO explícito: YYYY-MM-DD
  const isoMatch = source.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1] ?? "", 10);
    const month = Number.parseInt(isoMatch[2] ?? "", 10);
    const day = Number.parseInt(isoMatch[3] ?? "", 10);
    if (isValidCalendarDate(year, month, day)) {
      const target = { year, month, day, dayOfWeek: 0 };
      return {
        fechaIso: formatFechaIso(year, month, day),
        textoDetectado: isoMatch[0],
        prioridadSugerida: prioridadPorDias(diffDays(base, target)),
      };
    }
  }

  // 2. DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = source.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1] ?? "", 10);
    const month = Number.parseInt(dmyMatch[2] ?? "", 10);
    const year = Number.parseInt(dmyMatch[3] ?? "", 10);
    if (isValidCalendarDate(year, month, day)) {
      const target = { year, month, day, dayOfWeek: 0 };
      return {
        fechaIso: formatFechaIso(year, month, day),
        textoDetectado: dmyMatch[0],
        prioridadSugerida: prioridadPorDias(diffDays(base, target)),
      };
    }
  }

  // 3. "para el DD de MES [de YYYY]" / "el DD de MES"
  const mesPattern = Object.keys(MESES).join("|");
  const fechaTextoRegex = new RegExp(
    `(?:(?:para|hasta|antes\\s+del?)\\s+)?(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${mesPattern})(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`,
    "i",
  );
  const fechaTextoMatch = source.match(fechaTextoRegex);
  if (fechaTextoMatch) {
    const day = Number.parseInt(fechaTextoMatch[1] ?? "", 10);
    const monthName = (fechaTextoMatch[2] ?? "").toLowerCase();
    const month = MESES[monthName];
    const explicitYear = fechaTextoMatch[3]
      ? Number.parseInt(fechaTextoMatch[3], 10)
      : null;

    if (month) {
      let year = explicitYear ?? base.year;
      if (!explicitYear) {
        const currentYearTarget = { year, month, day, dayOfWeek: 0 };
        if (diffDays(base, currentYearTarget) < 0) {
          year += 1;
        }
      }
      if (isValidCalendarDate(year, month, day)) {
        const target = { year, month, day, dayOfWeek: 0 };
        return {
          fechaIso: formatFechaIso(year, month, day),
          textoDetectado: fechaTextoMatch[0].trim(),
          prioridadSugerida: prioridadPorDias(diffDays(base, target)),
        };
      }
    }
  }

  // 4. Expresiones inmediatas / urgentes
  const inmediatoMatch = source.match(
    /\b(?:de\s+inmediato|inmediatamente|de\s+manera\s+inmediata)\b/i,
  );
  if (inmediatoMatch) {
    return {
      fechaIso: formatFechaIso(base.year, base.month, base.day),
      textoDetectado: inmediatoMatch[0],
      prioridadSugerida: "urgent",
    };
  }

  const urgenteMatch = source.match(
    /\b(?:con\s+car[áa]cter\s+urgente|con\s+urgencia|urgente)\b/i,
  );
  if (urgenteMatch) {
    return {
      fechaIso: formatFechaIso(base.year, base.month, base.day),
      textoDetectado: urgenteMatch[0],
      prioridadSugerida: "urgent",
    };
  }

  // 5. "en N horas" (ej. 24/48/72 horas)
  const horasMatch = source.match(
    /\b(?:en|dentro\s+de)\s+(\d+|un|una|dos|tres|cuatro|seis|doce)\s+horas?\b/i,
  );
  if (horasMatch) {
    const hours = parseCantidad(horasMatch[1] ?? "");
    if (hours) {
      const days = Math.max(1, Math.ceil(hours / 24));
      const target = addDays(base, days);
      return {
        fechaIso: formatFechaIso(target.year, target.month, target.day),
        textoDetectado: horasMatch[0],
        prioridadSugerida:
          hours <= 24 ? "urgent" : hours <= 72 ? "high" : "medium",
      };
    }
  }

  // 6. "en N días hábiles"
  const diasHabilesMatch = source.match(
    /\b(?:en|dentro\s+de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta)\s+d[íi]as?\s+h[áa]biles\b/i,
  );
  if (diasHabilesMatch) {
    const count = parseCantidad(diasHabilesMatch[1] ?? "");
    if (count) {
      const target = addBusinessDays(base, count);
      return {
        fechaIso: formatFechaIso(target.year, target.month, target.day),
        textoDetectado: diasHabilesMatch[0],
        prioridadSugerida: prioridadPorDias(diffDays(base, target)),
      };
    }
  }

  // 7. "en N días"
  const diasMatch = source.match(
    /\b(?:en|dentro\s+de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|cuarenta|sesenta|noventa)\s+d[íi]as?\b/i,
  );
  if (diasMatch) {
    const count = parseCantidad(diasMatch[1] ?? "");
    if (count) {
      const target = addDays(base, count);
      return {
        fechaIso: formatFechaIso(target.year, target.month, target.day),
        textoDetectado: diasMatch[0],
        prioridadSugerida: prioridadPorDias(count),
      };
    }
  }

  // 8. "en N semanas"
  const semanasMatch = source.match(
    /\b(?:en|dentro\s+de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis)\s+semanas?\b/i,
  );
  if (semanasMatch) {
    const weeks = parseCantidad(semanasMatch[1] ?? "");
    if (weeks) {
      const days = weeks * 7;
      const target = addDays(base, days);
      return {
        fechaIso: formatFechaIso(target.year, target.month, target.day),
        textoDetectado: semanasMatch[0],
        prioridadSugerida: prioridadPorDias(days),
      };
    }
  }

  // 9. "pasado mañana" / "mañana" / "hoy"
  const pasadoMananaMatch = source.match(/\b(?:para\s+)?pasado\s+ma[ñn]ana\b/i);
  if (pasadoMananaMatch) {
    const target = addDays(base, 2);
    return {
      fechaIso: formatFechaIso(target.year, target.month, target.day),
      textoDetectado: pasadoMananaMatch[0],
      prioridadSugerida: "high",
    };
  }

  const mananaMatch = source.match(
    /\b(?:para\s+)?ma[ñn]ana(?:\s+(?:mismo|en\s+la\s+(?:ma[ñn]ana|tarde|noche)))?\b/i,
  );
  if (mananaMatch) {
    const target = addDays(base, 1);
    return {
      fechaIso: formatFechaIso(target.year, target.month, target.day),
      textoDetectado: mananaMatch[0],
      prioridadSugerida: "urgent",
    };
  }

  const hoyMatch = source.match(/\b(?:para\s+)?hoy(?:\s+mismo)?\b/i);
  if (hoyMatch) {
    return {
      fechaIso: formatFechaIso(base.year, base.month, base.day),
      textoDetectado: hoyMatch[0],
      prioridadSugerida: "urgent",
    };
  }

  // 10. "antes de fin de mes" / "fin de mes"
  const finMesMatch = source.match(
    /\b(?:antes\s+de\s+(?:finalizar\s+el|fin\s+de)\s+mes|(?:para\s+)?(?:el\s+)?fin\s+de\s+mes)\b/i,
  );
  if (finMesMatch) {
    const lastDay = lastDayOfMonth(base.year, base.month);
    const target = {
      year: base.year,
      month: base.month,
      day: lastDay,
      dayOfWeek: 0,
    };
    return {
      fechaIso: formatFechaIso(target.year, target.month, target.day),
      textoDetectado: finMesMatch[0],
      prioridadSugerida: prioridadPorDias(diffDays(base, target)),
    };
  }

  // 11. "a mediados de mes"
  const mediadosMesMatch = source.match(/\b(?:a\s+)?mediados\s+de\s+mes\b/i);
  if (mediadosMesMatch) {
    let year = base.year;
    let month = base.month;
    if (base.day > 15) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    const target = { year, month, day: 15, dayOfWeek: 0 };
    return {
      fechaIso: formatFechaIso(target.year, target.month, target.day),
      textoDetectado: mediadosMesMatch[0],
      prioridadSugerida: prioridadPorDias(diffDays(base, target)),
    };
  }

  // 12. "para el lunes..domingo" / "el próximo martes"
  const diaRegex =
    /\b(?:(?:para|hasta)\s+)?(?:(?:el|este|pr[óo]ximo)\s+)?(?:pr[óo]ximo\s+)?(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i;
  const diaMatch = source.match(diaRegex);
  if (diaMatch) {
    const rawDay = (diaMatch[1] ?? "").toLowerCase();
    const targetDow = DIAS_SEMANA[rawDay];
    if (targetDow !== undefined) {
      let delta = (targetDow - base.dayOfWeek + 7) % 7;
      if (delta === 0) {
        delta = 7;
      }
      const target = addDays(base, delta);
      return {
        fechaIso: formatFechaIso(target.year, target.month, target.day),
        textoDetectado: diaMatch[0].trim(),
        prioridadSugerida: prioridadPorDias(delta),
      };
    }
  }

  return { fechaIso: null, textoDetectado: null };
}

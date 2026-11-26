import { parsePlazoEspanol } from "./plazo-parser";
import type {
  DiscursoOrdenBorrador,
  DiscursoPistasResponsable,
  DiscursoPrioridad,
} from "./types";

const GRADO_REGLAS: { regex: RegExp; grado: string }[] = [
  { regex: /\b(?:general\s+en\s+jefe|g\/j)\b/i, grado: "General en Jefe" },
  { regex: /\b(?:almirante\s+en\s+jefe|a\/j)\b/i, grado: "Almirante en Jefe" },
  { regex: /\b(?:mayor\s+general|m\/g|mg)\b/i, grado: "Mayor General" },
  {
    regex: /\b(?:general\s+de\s+divisi[óo]n|g\/d|gd)\b/i,
    grado: "General de División",
  },
  {
    regex: /\b(?:general\s+de\s+brigada|g\/b|gb)\b/i,
    grado: "General de Brigada",
  },
  { regex: /\b(?:vicealmirante|valm\.?|v\/a)\b/i, grado: "Vicealmirante" },
  { regex: /\b(?:contralmirante|calm\.?|c\/a)\b/i, grado: "Contralmirante" },
  { regex: /\b(?:almirante|alm\.?)\b/i, grado: "Almirante" },
  { regex: /\b(?:general|gral\.?)\b/i, grado: "General" },
  {
    regex: /\b(?:capit[áa]n\s+de\s+nav[íi]o|c\/n)\b/i,
    grado: "Capitán de Navío",
  },
  {
    regex: /\b(?:capit[áa]n\s+de\s+fragata|c\/f)\b/i,
    grado: "Capitán de Fragata",
  },
  {
    regex: /\b(?:capit[áa]n\s+de\s+corbeta|c\/c)\b/i,
    grado: "Capitán de Corbeta",
  },
  {
    regex: /\b(?:teniente\s+coronel|tcnel\.?|tte\.?\s*cnel\.?)\b/i,
    grado: "Teniente Coronel",
  },
  { regex: /\b(?:coronel|cnel\.?)\b/i, grado: "Coronel" },
  { regex: /\b(?:mayor|may\.?)\b/i, grado: "Mayor" },
  {
    regex: /\b(?:teniente\s+de\s+nav[íi]o|t\/n)\b/i,
    grado: "Teniente de Navío",
  },
  {
    regex: /\b(?:teniente\s+de\s+fragata|t\/f)\b/i,
    grado: "Teniente de Fragata",
  },
  {
    regex: /\b(?:teniente\s+de\s+corbeta|t\/c)\b/i,
    grado: "Teniente de Corbeta",
  },
  { regex: /\b(?:capit[áa]n|cap\.?)\b/i, grado: "Capitán" },
  {
    regex: /\b(?:primer\s+teniente|1er\.?\s+teniente|1er\.?\s+tte\.?)\b/i,
    grado: "Primer Teniente",
  },
  { regex: /\b(?:teniente|tte\.?)\b/i, grado: "Teniente" },
  {
    regex: /\b(?:sargento\s+supervisor|s\/s)\b/i,
    grado: "Sargento Supervisor",
  },
  { regex: /\b(?:sargento\s+ayudante|s\/a)\b/i, grado: "Sargento Ayudante" },
  { regex: /\bsargento\s+mayor\b/i, grado: "Sargento Mayor" },
  { regex: /\bsargento\s+primero\b/i, grado: "Sargento Primero" },
  { regex: /\bsargento\s+segundo\b/i, grado: "Sargento Segundo" },
  { regex: /\b(?:sargento|sgt\.?|sgto\.?)\b/i, grado: "Sargento" },
];

const COMPONENTE_REGLAS: {
  regex: RegExp;
  componente: "EJB" | "ARB" | "AMB" | "GNB" | "MIL";
}[] = [
  {
    regex: /\b(?:ej[ée]rcito(?:\s+bolivariano)?|ejb)\b/i,
    componente: "EJB",
  },
  {
    regex: /\b(?:armada(?:\s+bolivariana)?|arb)\b/i,
    componente: "ARB",
  },
  {
    regex: /\b(?:aviaci[óo]n(?:\s+militar(?:\s+bolivariana)?)?|amb)\b/i,
    componente: "AMB",
  },
  {
    regex: /\b(?:guardia\s+nacional(?:\s+bolivariana)?|gnb)\b/i,
    componente: "GNB",
  },
  {
    regex: /\b(?:milicia(?:\s+bolivariana)?|mil)\b/i,
    componente: "MIL",
  },
];

const VERBO_INSTRUCCION_REGEX =
  /(?<![\p{L}\p{N}])(?:enc[áa]rguese|encargarse|quiero\s+que|instruyo(?:\s+a|\s+que)?|ordeno(?:\s+a|\s+que)?|dispongo(?:\s+a|\s+que)?|debe(?:r[áa]n?)?|coordine(?:n)?|presente(?:n)?|entregue(?:n)?|revise(?:n)?|prepare(?:n)?|verifique(?:n)?|supervise(?:n)?|garantice(?:n)?|informe(?:n)?|asegure(?:n)?|aseg[úu]rese|elabore(?:n)?|remita(?:n)?)(?![\p{L}\p{N}])/iu;

const STOPWORDS_NOMBRE = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "para",
  "por",
  "con",
  "que",
  "quien",
  "quienes",
  "se",
  "su",
  "sus",
  "y",
  "o",
  "a",
  "al",
  "ejercito",
  "ejército",
  "armada",
  "aviacion",
  "aviación",
  "guardia",
  "nacional",
  "milicia",
  "bolivariana",
  "bolivariano",
  "militar",
  "ejb",
  "arb",
  "amb",
  "gnb",
  "mil",
]);

const ABREVIATURAS_PROTEGIDAS: [RegExp, string][] = [
  [
    /\b(Gral|Cnel|Tcnel|May|Cap|Tte|Sgt|Sgto|Alm|Valm|Calm|Dr|Dra|Ing|Lic|Nro|Art|Sr|Sra)\./gi,
    "$1__DISCURSO_DOT__",
  ],
];

function splitOraciones(texto: string): string[] {
  let masked = texto;
  for (const [pattern, replacement] of ABREVIATURAS_PROTEGIDAS) {
    masked = masked.replace(pattern, replacement);
  }

  return masked
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((part) => part.replace(/__DISCURSO_DOT__/g, ".").trim())
    .filter((part) => part.length >= 12);
}

function extraerGrado(oracion: string): {
  grado: string | null;
  matchIndex: number;
  matchEnd: number;
} {
  for (const rule of GRADO_REGLAS) {
    const match = rule.regex.exec(oracion);
    if (match && match.index !== undefined) {
      return {
        grado: rule.grado,
        matchIndex: match.index,
        matchEnd: match.index + match[0].length,
      };
    }
  }
  return { grado: null, matchIndex: -1, matchEnd: -1 };
}

function extraerComponente(oracion: string): string | null {
  for (const rule of COMPONENTE_REGLAS) {
    if (rule.regex.test(oracion)) {
      return rule.componente;
    }
  }
  return null;
}

function extraerNombreYApellido(
  oracion: string,
  afterIndex: number,
): { nombre: string | null; apellido: string | null; fragmento: string } {
  const slice = afterIndex >= 0 ? oracion.slice(afterIndex) : oracion;
  const tokensMatch = slice.match(
    /^\s*(?:de\s+la\s+[^\s,]+\s+|del\s+[^\s,]+\s+)?([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}){0,2})/,
  );

  let rawWords: string[] = [];
  if (tokensMatch?.[1]) {
    rawWords = tokensMatch[1]
      .split(/\s+/)
      .filter((w) => !STOPWORDS_NOMBRE.has(w.toLowerCase()));
  }

  if (rawWords.length === 0 && afterIndex < 0) {
    // Intenta detectar patrón "al/a [Nombre] [Apellido]" o "que [Nombre] [Apellido]"
    const fallbackMatch = oracion.match(
      /\b(?:al|a\s+la|a|que)\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,}){0,2})/,
    );
    if (fallbackMatch?.[1]) {
      rawWords = fallbackMatch[1]
        .split(/\s+/)
        .filter((w) => !STOPWORDS_NOMBRE.has(w.toLowerCase()));
    }
  }

  if (rawWords.length === 0) {
    return { nombre: null, apellido: null, fragmento: "" };
  }

  if (rawWords.length === 1) {
    return {
      nombre: null,
      apellido: rawWords[0] ?? null,
      fragmento: rawWords[0] ?? "",
    };
  }

  return {
    nombre: rawWords[0] ?? null,
    apellido: rawWords.slice(1).join(" "),
    fragmento: rawWords.join(" "),
  };
}

function construirPistasYResponsable(oracion: string): {
  pistas: DiscursoPistasResponsable;
  responsableMencionado: string;
} {
  const { grado, matchIndex, matchEnd } = extraerGrado(oracion);
  const componente = extraerComponente(oracion);
  const { nombre, apellido, fragmento } = extraerNombreYApellido(
    oracion,
    matchEnd,
  );

  const partes: string[] = [];
  if (grado && matchIndex >= 0) {
    partes.push(grado);
  }
  if (fragmento) {
    partes.push(fragmento);
  }
  if (componente) {
    partes.push(`(${componente})`);
  }

  return {
    pistas: {
      grado,
      componente,
      apellido,
      nombre,
    },
    responsableMencionado: partes.join(" ").trim(),
  };
}

function construirTituloLimpio(oracion: string): string {
  let clean = oracion.trim();

  // Quitar encabezados de hablante como "Ministro:"
  clean = clean.replace(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]{2,25}:\s*/, "");

  // Extraer desde el verbo de instrucción principal cuando hay preámbulo largo
  const introMatch = clean.match(
    /(?:quiero\s+que|instruyo(?:\s+a[^,]+?)?\s+(?:que|a)|ordeno(?:\s+a[^,]+?)?\s+(?:que|a)|dispongo\s+que)\s+(.+)$/i,
  );
  if (introMatch?.[1]) {
    clean = introMatch[1].trim();
  }

  // Quitar mención inicial de grado/persona si empieza con sujeto + verbo
  clean = clean.replace(
    /^(?:al|el|la)\s+(?:general(?:\s+en\s+jefe|\s+de\s+(?:divisi[óo]n|brigada))?|mayor\s+general|almirante(?:\s+en\s+jefe)?|vicealmirante|contralmirante|coronel|teniente\s+coronel|mayor|capit[áa]n(?:\s+de\s+(?:nav[íi]o|fragata|corbeta))?|primer\s+teniente|teniente(?:\s+de\s+(?:nav[íi]o|fragata|corbeta))?|sargento(?:\s+\w+)?|g\/[jdb]|m\/g|cnel\.?|tcnel\.?|may\.?|cap\.?|tte\.?|calm\.?|valm\.?)\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+)?(?:\s+de\s+l[ao]\s+[^\s,]+|\s+del\s+[^\s,]+)?\s*,?\s*(?:que\s+)?(?:se\s+)?(?:enc[áa]rguese\s+de\s+|debe(?:r[áa])?\s+)?/i,
    "",
  );

  clean = clean
    .replace(/^(?:de\s+que\s+|que\s+|se\s+)/i, "")
    .replace(/[.]+$/, "")
    .trim();

  if (clean.length < 8) {
    clean = oracion.replace(/[.]+$/, "").trim();
  }

  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  if (capitalized.length <= 110) return capitalized;
  return `${capitalized.slice(0, 107).trimEnd()}...`;
}

function inferirPrioridad(
  oracion: string,
  prioridadPorPlazo?: DiscursoPrioridad,
): DiscursoPrioridad {
  if (
    /\b(?:de\s+inmediato|inmediatamente|urgente|urgencia|prioritario|cr[íi]tico|sin\s+demora)\b/i.test(
      oracion,
    )
  ) {
    return "urgent";
  }
  if (prioridadPorPlazo) return prioridadPorPlazo;
  if (/\b(?:importante|cuanto\s+antes|indispensable)\b/i.test(oracion)) {
    return "high";
  }
  return "medium";
}

/**
 * Extractor determinista de órdenes e instrucciones sin dependencias externas ni red.
 */
export function extraerOrdenesPorReglas(
  texto: string,
  fechaBase: Date = new Date(),
): DiscursoOrdenBorrador[] {
  const oraciones = splitOraciones(texto);
  const ordenes: DiscursoOrdenBorrador[] = [];
  const vistas = new Set<string>();

  for (const oracion of oraciones) {
    if (!VERBO_INSTRUCCION_REGEX.test(oracion)) {
      continue;
    }

    const clave = oracion.toLowerCase().replace(/\s+/g, " ").trim();
    if (vistas.has(clave)) continue;
    vistas.add(clave);

    const { pistas, responsableMencionado } =
      construirPistasYResponsable(oracion);
    const plazoRes = parsePlazoEspanol(oracion, fechaBase);
    const titulo = construirTituloLimpio(oracion);
    const prioridad = inferirPrioridad(oracion, plazoRes.prioridadSugerida);

    const confianzaBase =
      0.62 +
      (pistas.apellido || pistas.nombre ? 0.14 : 0) +
      (pistas.grado ? 0.08 : 0) +
      (plazoRes.fechaIso ? 0.08 : 0);

    ordenes.push({
      id: `orden-${ordenes.length + 1}`,
      seleccionada: true,
      titulo,
      descripcion: oracion.trim(),
      proyectoId: null,
      responsableMencionado,
      pistas,
      asignacionModo: "sin_responsable",
      responsableCedula: null,
      responsableUserId: null,
      candidatos: [],
      plazo: plazoRes.fechaIso,
      plazoTexto: plazoRes.textoDetectado,
      prioridad,
      citaTextual: oracion.trim(),
      confianza: Number(Math.min(0.95, confianzaBase).toFixed(2)),
    });
  }

  return ordenes;
}

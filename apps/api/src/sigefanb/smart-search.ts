import { HTTPException } from "hono/http-exception";
import {
  deriveComponent,
  type FanbComponentCode,
  formatGrado,
  formatNombreCompleto,
  normalizeCedulaInput,
  rankInsignia,
} from "./military-assets";
import type { SigefanbPersonalItem } from "./personal-query";
import {
  getSigefanbPools,
  type SigefanbPoolEntry,
  SigefanbUnavailableError,
} from "./pools";

export type SmartSearchInput = {
  q: string;
  grado?: string | null;
  componente?: string | null;
  limit?: number;
};

export type SigefanbSmartCandidate = SigefanbPersonalItem & {
  score: number;
  motivo: string;
};

export type ParsedRankHint = {
  canonical: string | null;
  family: string;
  matchedText: string;
};

export type ParsedSmartQuery = {
  raw: string;
  normalized: string;
  cedula: string | null;
  grado: ParsedRankHint | null;
  componente: FanbComponentCode | null;
  nameTokens: string[];
  expandedTokens: string[][];
};

export type ScoreCandidateOptions = {
  surnameStartIndex?: number;
};

type PersonalQueryRow = {
  cedula: number | string;
  nacionalidad: string | null;
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  sexo: string | null;
  descripcion_cargo: string | null;
  tipo_personal: string | null;
  unidad: string | null;
};

const BASE_PERSONAL_SELECT = `
SELECT DISTINCT ON (p.cedula)
  p.cedula, p.nacionalidad, p.primer_nombre, p.segundo_nombre,
  p.primer_apellido, p.segundo_apellido, p.sexo,
  c.descripcion_cargo, tp.nombre AS tipo_personal, d.nombre AS unidad
FROM public.trabajador t
INNER JOIN public.personal p ON p.id_personal = t.id_personal
LEFT JOIN public.cargo c ON c.id_cargo = t.id_cargo
LEFT JOIN public.tipopersonal tp ON tp.id_tipo_personal = t.id_tipo_personal
LEFT JOIN public.dependencia d ON d.id_dependencia = COALESCE(t.id_dependencia_real, t.id_dependencia)
WHERE t.estatus = 'A'
`;

const FULL_NAME_SQL_EXPR =
  "translate(upper(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')";

const CARGO_SQL_EXPR =
  "translate(upper(coalesce(c.descripcion_cargo, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')";

const TIPO_PERSONAL_SQL_EXPR =
  "translate(upper(coalesce(tp.nombre, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')";

const PASS1_LIMIT_PER_POOL = 80;
const PASS2_LIMIT_PER_POOL = 120;
const MIN_CANDIDATES_BEFORE_PASS2 = 5;
const MIN_SCORE_THRESHOLD = 0.35;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_QUERY_NAME_TOKENS = 4;

const STOPWORDS = new Set([
  "EL",
  "LA",
  "LOS",
  "LAS",
  "DE",
  "DEL",
  "EN",
  "Y",
  "E",
  "A",
  "AL",
  "CON",
  "POR",
  "PARA",
]);

const NICKNAME_GROUPS: readonly (readonly string[])[] = [
  ["JOSE", "PEPE", "CHEO"],
  ["FRANCISCO", "PANCHO", "PACO"],
  ["JESUS", "CHUCHO", "CHUO"],
  ["RAFAEL", "RAFA"],
  ["ALEJANDRO", "ALEX", "ALE"],
  ["GUILLERMO", "MEMO", "GUILLE"],
  ["EDUARDO", "LALO", "EDU"],
  ["LUIS", "LUCHO"],
  ["MANUEL", "MANU", "MANOLO"],
  ["ANTONIO", "TONO", "TONY"],
  ["ALBERTO", "BETO"],
  ["ROBERTO", "BETO", "ROBERT"],
  ["FERNANDO", "FER", "NANDO"],
  ["IGNACIO", "NACHO"],
  ["ENRIQUE", "QUIQUE", "KIKE"],
  ["RAMON", "MONCHO"],
  ["GUSTAVO", "TAVO"],
  ["GABRIEL", "GABO"],
  ["JUAN", "JUANCHO"],
  ["MIGUEL", "MIGUE"],
  ["RICARDO", "RICKY"],
  ["DANIEL", "DANI"],
  ["CARLOS", "CHARLY"],
  ["MARIA", "MARY"],
  ["PATRICIA", "PATY"],
  ["CAROLINA", "CARO"],
  ["GABRIELA", "GABI"],
  ["VERONICA", "VERO"],
  ["ISABEL", "ISA"],
  ["BEATRIZ", "BEA"],
  ["TERESA", "TERE"],
];

const NICKNAME_INDEX: Map<string, string[]> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of NICKNAME_GROUPS) {
    for (const member of group) {
      let set = map.get(member);
      if (!set) {
        set = new Set<string>();
        map.set(member, set);
      }
      for (const peer of group) {
        if (peer !== member) {
          set.add(peer);
        }
      }
    }
  }
  const result = new Map<string, string[]>();
  for (const [key, peers] of map) {
    result.set(key, Array.from(peers));
  }
  return result;
})();

type RankRule = {
  pattern: RegExp;
  canonical: string | null;
  family: string;
  sqlKeywords: string[];
};

// Ordenados de más específico (multi-palabra) a más corto para evitar capturas parciales.
const RANK_RULES: RankRule[] = [
  {
    pattern: /\b(?:GENERAL\s+EN\s+JEFE|G\s+J|GJ)\b/g,
    canonical: "GENERAL EN JEFE",
    family: "general",
    sqlKeywords: ["GENERAL EN JEFE"],
  },
  {
    pattern: /\b(?:MAYOR\s+GENERAL|M\s+G|MG)\b/g,
    canonical: "MAYOR GENERAL",
    family: "general",
    sqlKeywords: ["MAYOR GENERAL"],
  },
  {
    pattern: /\b(?:GENERAL\s+(?:DE\s+)?DIVISION|G\s+D|GD)\b/g,
    canonical: "GENERAL DE DIVISION",
    family: "general",
    sqlKeywords: ["GENERAL", "DIVISION"],
  },
  {
    pattern: /\b(?:GENERAL\s+(?:DE\s+)?BRIGADA|G\s+B|GB)\b/g,
    canonical: "GENERAL DE BRIGADA",
    family: "general",
    sqlKeywords: ["GENERAL", "BRIGADA"],
  },
  {
    pattern: /\b(?:ALMIRANTE\s+EN\s+JEFE|A\s+J|AJ)\b/g,
    canonical: "ALMIRANTE EN JEFE",
    family: "almirante",
    sqlKeywords: ["ALMIRANTE EN JEFE"],
  },
  {
    pattern: /\b(?:VICEALMIRANTE|V\s+A|VA)\b/g,
    canonical: "VICEALMIRANTE",
    family: "almirante",
    sqlKeywords: ["VICEALMIRANTE"],
  },
  {
    pattern: /\b(?:CONTRALMIRANTE|C\s+A|CA)\b/g,
    canonical: "CONTRALMIRANTE",
    family: "almirante",
    sqlKeywords: ["CONTRALMIRANTE"],
  },
  {
    pattern: /\b(?:ALMIRANTE|ALM)\b/g,
    canonical: "ALMIRANTE",
    family: "almirante",
    sqlKeywords: ["ALMIRANTE"],
  },
  {
    pattern: /\b(?:GENERAL|GRAL)\b/g,
    canonical: null,
    family: "general",
    sqlKeywords: ["GENERAL"],
  },
  {
    pattern: /\b(?:CAPITAN\s+(?:DE\s+)?NAVIO|C\s+N|CN)\b/g,
    canonical: "CAPITAN DE NAVIO",
    family: "capitan_naval",
    sqlKeywords: ["CAPITAN", "NAVIO"],
  },
  {
    pattern: /\b(?:CAPITAN\s+(?:DE\s+)?FRAGATA|C\s+F|CF)\b/g,
    canonical: "CAPITAN DE FRAGATA",
    family: "capitan_naval",
    sqlKeywords: ["CAPITAN", "FRAGATA"],
  },
  {
    pattern: /\b(?:CAPITAN\s+(?:DE\s+)?CORBETA|C\s+C|CC)\b/g,
    canonical: "CAPITAN DE CORBETA",
    family: "capitan_naval",
    sqlKeywords: ["CAPITAN", "CORBETA"],
  },
  {
    pattern: /\b(?:TENIENTE\s+(?:DE\s+)?NAVIO|T\s+N|TN)\b/g,
    canonical: "TENIENTE DE NAVIO",
    family: "teniente_naval",
    sqlKeywords: ["TENIENTE", "NAVIO"],
  },
  {
    pattern: /\b(?:TENIENTE\s+(?:DE\s+)?FRAGATA|T\s+F|TF)\b/g,
    canonical: "TENIENTE DE FRAGATA",
    family: "teniente_naval",
    sqlKeywords: ["TENIENTE", "FRAGATA"],
  },
  {
    pattern: /\b(?:TENIENTE\s+(?:DE\s+)?CORBETA|T\s+C|TC)\b/g,
    canonical: "TENIENTE DE CORBETA",
    family: "teniente_naval",
    sqlKeywords: ["TENIENTE", "CORBETA"],
  },
  {
    pattern: /\b(?:TENIENTE\s+CORONEL|TTE\s+CNEL|T\s+CNEL|TCNEL)\b/g,
    canonical: "TENIENTE CORONEL",
    family: "coronel",
    sqlKeywords: ["TENIENTE CORONEL"],
  },
  {
    pattern: /\b(?:CORONEL|CNEL)\b/g,
    canonical: "CORONEL",
    family: "coronel",
    sqlKeywords: ["CORONEL"],
  },
  {
    pattern: /\b(?:SARGENTO\s+SUPERVISOR|SGTO\s+SUP|S\s+S|SS)\b/g,
    canonical: "SARGENTO SUPERVISOR",
    family: "sargento",
    sqlKeywords: ["SARGENTO SUPERVISOR"],
  },
  {
    pattern: /\b(?:SARGENTO\s+AYUDANTE|SGTO\s+AYUD|S\s+A|SA)\b/g,
    canonical: "SARGENTO AYUDANTE",
    family: "sargento",
    sqlKeywords: ["SARGENTO AYUDANTE"],
  },
  {
    pattern: /\b(?:SARGENTO\s+MAYOR\s+(?:DE\s+)?(?:PRIMERA|1RA|1ERA)|SM1)\b/g,
    canonical: "SARGENTO MAYOR DE PRIMERA",
    family: "sargento",
    sqlKeywords: ["SARGENTO MAYOR", "1RA"],
  },
  {
    pattern: /\b(?:SARGENTO\s+MAYOR\s+(?:DE\s+)?(?:SEGUNDA|2DA)|SM2)\b/g,
    canonical: "SARGENTO MAYOR DE SEGUNDA",
    family: "sargento",
    sqlKeywords: ["SARGENTO MAYOR", "2DA"],
  },
  {
    pattern: /\b(?:SARGENTO\s+MAYOR\s+(?:DE\s+)?(?:TERCERA|3RA)|SM3)\b/g,
    canonical: "SARGENTO MAYOR DE TERCERA",
    family: "sargento",
    sqlKeywords: ["SARGENTO MAYOR", "3RA"],
  },
  {
    pattern: /\b(?:SARGENTO\s+MAYOR|SM)\b/g,
    canonical: null,
    family: "sargento",
    sqlKeywords: ["SARGENTO MAYOR"],
  },
  {
    pattern:
      /\b(?:SARGENTO\s+(?:PRIMERO|1RO|DE\s+PRIMERA)|SGTO\s+1RO|SGTO\s+1|S1)\b/g,
    canonical: "SARGENTO PRIMERO",
    family: "sargento",
    sqlKeywords: ["SARGENTO"],
  },
  {
    pattern:
      /\b(?:SARGENTO\s+(?:SEGUNDO|2DO|DE\s+SEGUNDA)|SGTO\s+2DO|SGTO\s+2|S2)\b/g,
    canonical: "SARGENTO SEGUNDO",
    family: "sargento",
    sqlKeywords: ["SARGENTO"],
  },
  {
    pattern: /\b(?:SARGENTO|SGTO)\b/g,
    canonical: null,
    family: "sargento",
    sqlKeywords: ["SARGENTO"],
  },
  {
    pattern: /\b(?:PRIMER\s+TENIENTE|1ER\s+TENIENTE|1ER\s+TTE|1TTE|1T|PTTE)\b/g,
    canonical: "PRIMER TENIENTE",
    family: "teniente",
    sqlKeywords: ["PRIMER TENIENTE"],
  },
  {
    pattern: /\b(?:TENIENTE|TTE)\b/g,
    canonical: "TENIENTE",
    family: "teniente",
    sqlKeywords: ["TENIENTE"],
  },
  {
    pattern: /\b(?:CAPITAN|CAP)\b/g,
    canonical: "CAPITAN",
    family: "capitan",
    sqlKeywords: ["CAPITAN"],
  },
  {
    pattern: /\b(?:MAYOR|MAY)\b/g,
    canonical: "MAYOR",
    family: "mayor",
    sqlKeywords: ["MAYOR"],
  },
  {
    pattern: /\b(?:CABO\s+(?:PRIMERO|1RO)|C1)\b/g,
    canonical: "CABO PRIMERO",
    family: "cabo",
    sqlKeywords: ["CABO"],
  },
  {
    pattern: /\b(?:CABO\s+(?:SEGUNDO|2DO)|C2)\b/g,
    canonical: "CABO SEGUNDO",
    family: "cabo",
    sqlKeywords: ["CABO"],
  },
  {
    pattern: /\bCABO\b/g,
    canonical: null,
    family: "cabo",
    sqlKeywords: ["CABO"],
  },
  {
    pattern: /\bALFEREZ\s+MAYOR\b/g,
    canonical: "ALFEREZ MAYOR",
    family: "alferez",
    sqlKeywords: ["ALFEREZ"],
  },
  {
    pattern: /\bALFEREZ\s+AUXILIAR\b/g,
    canonical: "ALFEREZ AUXILIAR",
    family: "alferez",
    sqlKeywords: ["ALFEREZ"],
  },
  {
    pattern: /\b(?:ALFEREZ|ALF)\b/g,
    canonical: "ALFEREZ",
    family: "alferez",
    sqlKeywords: ["ALFEREZ"],
  },
  {
    pattern: /\bGUARDIAMARINA(?:\s+MAYOR|\s+AUXILIAR)?\b/g,
    canonical: "GUARDIAMARINA",
    family: "guardiamarina",
    sqlKeywords: ["GUARDIAMARINA"],
  },
  {
    pattern: /\b(?:BRIGADIER|SUB\s+BRIGADIER|CADETE)\b/g,
    canonical: null,
    family: "cadete",
    sqlKeywords: ["CADETE"],
  },
  {
    pattern:
      /\b(?:DISTINGUIDO|INFANTE\s+DISTINGUIDO|MARINERO\s+DISTINGUIDO|MARINERO)\b/g,
    canonical: null,
    family: "tropa",
    sqlKeywords: ["DISTINGUIDO"],
  },
];

type ComponentRule = {
  pattern: RegExp;
  code: FanbComponentCode;
};

const COMPONENT_RULES: ComponentRule[] = [
  {
    pattern:
      /\b(?:DE\s+LA\s+)?AVIACION(?:\s+MILITAR(?:\s+BOLIVARIANA)?)?\b|\bAMB\b/g,
    code: "AMB",
  },
  {
    pattern:
      /\b(?:DE\s+LA\s+)?GUARDIA(?:\s+NACIONAL(?:\s+BOLIVARIANA)?)?\b|\bGNB\b/g,
    code: "GNB",
  },
  {
    pattern: /\b(?:DE\s+LA\s+)?ARMADA(?:\s+BOLIVARIANA)?\b|\bNAVAL\b|\bARB\b/g,
    code: "ARB",
  },
  {
    pattern: /\b(?:DEL\s+)?EJERCITO(?:\s+BOLIVARIANO)?\b|\bEJB\b/g,
    code: "EJB",
  },
  {
    pattern: /\b(?:DE\s+LA\s+)?MILICIA(?:\s+BOLIVARIANA)?\b|\bMIL\b/g,
    code: "MIL",
  },
];

const COMPONENT_SQL_PATTERNS: Record<FanbComponentCode, string[]> = {
  EJB: ["%EJERCITO%", "%EJB%"],
  ARB: ["%ARMADA%", "%ARB%"],
  AMB: ["%AVIACI%", "%AMB%"],
  GNB: ["%GUARDIA%", "%GNB%"],
  MIL: ["%MILICIA%", "%MIL%"],
};

/**
 * Normaliza un texto eliminando diacríticos, convirtiendo a mayúsculas y
 * colapsando signos de puntuación en espacios simples.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Expande un token de nombre con variantes bidireccionales de apodos y
 * diminutivos venezolanos, preservando el token normalizado en primera posición.
 */
export function expandNicknameVariants(token: string): string[] {
  const normalized = normalizeText(token);
  if (!normalized) return [];
  const peers = NICKNAME_INDEX.get(normalized) ?? [];
  return [normalized, ...peers];
}

function buildTrigrams(normalized: string): Set<string> {
  const padded = `  ${normalized} `;
  const trigrams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Calcula similitud de Dice sobre trigramas con relleno (0..1) tras normalizar
 * acentos y mayúsculas.
 */
export function trigramSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const setA = buildTrigrams(normA);
  const setB = buildTrigrams(normB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const trigram of setA) {
    if (setB.has(trigram)) {
      intersection += 1;
    }
  }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Calcula la distancia de edición de Levenshtein entre dos cadenas.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const charA = a[i - 1];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = charA === b[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  return prev[b.length] ?? 0;
}

function extractRankFromNormalized(normalized: string): {
  hint: ParsedRankHint | null;
  remaining: string;
} {
  let remaining = normalized;
  let hint: ParsedRankHint | null = null;

  for (const rule of RANK_RULES) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(remaining);
    if (match) {
      if (!hint) {
        hint = {
          canonical: rule.canonical,
          family: rule.family,
          matchedText: match[0],
        };
      }
      rule.pattern.lastIndex = 0;
      remaining = remaining.replace(rule.pattern, " ");
      break;
    }
  }

  return {
    hint,
    remaining: remaining.trim().replace(/\s+/g, " "),
  };
}

function extractComponentFromNormalized(normalized: string): {
  componente: FanbComponentCode | null;
  remaining: string;
} {
  let remaining = normalized;
  let componente: FanbComponentCode | null = null;

  for (const rule of COMPONENT_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(remaining)) {
      if (!componente) {
        componente = rule.code;
      }
      rule.pattern.lastIndex = 0;
      remaining = remaining.replace(rule.pattern, " ");
      break;
    }
  }

  return {
    componente,
    remaining: remaining.trim().replace(/\s+/g, " "),
  };
}

/**
 * Analiza una consulta en lenguaje natural separando cédula, pistas de grado
 * militar, componente FANB y tokens de nombres/apellidos con apodos expandidos.
 */
export function parseSmartQuery(
  q: string,
  explicitGrado?: string | null,
  explicitComponente?: string | null,
): ParsedSmartQuery {
  const raw = q.trim();
  const normalized = normalizeText(raw);
  const cedula = normalizeCedulaInput(raw);

  const explicitCompCode = explicitComponente
    ? deriveComponent(explicitComponente)
    : null;
  const explicitRankHint = explicitGrado
    ? extractRankFromNormalized(normalizeText(explicitGrado)).hint
    : null;

  if (cedula !== null) {
    return {
      raw,
      normalized,
      cedula,
      grado: explicitRankHint,
      componente: explicitCompCode,
      nameTokens: [],
      expandedTokens: [],
    };
  }

  const afterRank = extractRankFromNormalized(normalized);
  const afterComponent = extractComponentFromNormalized(afterRank.remaining);

  const nameTokens = afterComponent.remaining
    .split(" ")
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));

  const expandedTokens = nameTokens.map((token) =>
    expandNicknameVariants(token),
  );

  return {
    raw,
    normalized,
    cedula: null,
    grado: explicitRankHint ?? afterRank.hint,
    componente: explicitCompCode ?? afterComponent.componente,
    nameTokens,
    expandedTokens,
  };
}

type TokenMatchKind = "exact" | "nickname" | "prefix" | "fuzzy";

type CandidateToken = {
  value: string;
  isSurname: boolean;
};

type TokenMatchResult = {
  queryIndex: number;
  candidateIndex: number;
  quality: number;
  kind: TokenMatchKind;
  isSurname: boolean;
};

function evaluateTokenPair(
  queryToken: string,
  variants: string[],
  candidateToken: string,
): { quality: number; kind: TokenMatchKind } | null {
  if (candidateToken === queryToken) {
    return { quality: 1.0, kind: "exact" };
  }

  if (variants.includes(candidateToken)) {
    return { quality: 0.92, kind: "nickname" };
  }

  if (
    queryToken.length >= 3 &&
    (candidateToken.startsWith(queryToken) ||
      (candidateToken.length >= 3 && queryToken.startsWith(candidateToken)))
  ) {
    return { quality: 0.85, kind: "prefix" };
  }

  if (queryToken.length >= 4 && candidateToken.length >= 4) {
    const tri = trigramSimilarity(queryToken, candidateToken);
    const maxLen = Math.max(queryToken.length, candidateToken.length);
    const lev = 1 - levenshteinDistance(queryToken, candidateToken) / maxLen;
    const sim = Math.max(tri, lev);
    if (sim >= 0.72) {
      return { quality: sim * 0.85, kind: "fuzzy" };
    }
    if (candidateToken.includes(queryToken)) {
      return { quality: 0.75, kind: "prefix" };
    }
  }

  return null;
}

function splitCandidateTokens(
  nombreCompleto: string,
  surnameStartIndex?: number,
): CandidateToken[] {
  const rawTokens = normalizeText(nombreCompleto).split(" ").filter(Boolean);
  const inferredStart = surnameStartIndex ?? Math.floor(rawTokens.length / 2);

  const tokens: CandidateToken[] = [];
  for (let i = 0; i < rawTokens.length; i += 1) {
    const token = rawTokens[i];
    if (!token || STOPWORDS.has(token)) continue;
    tokens.push({
      value: token,
      isSurname: i >= inferredStart,
    });
  }
  return tokens;
}

function buildMotivo(params: {
  hasNickname: boolean;
  surnameKind: TokenMatchKind | null;
  firstNameKind: TokenMatchKind | null;
  rankMatch: "exact" | "family" | null;
  componentMatch: boolean;
}): string {
  const parts: string[] = [];

  if (params.hasNickname) {
    parts.push("nombre por apodo");
  } else if (params.firstNameKind === "exact" && !params.surnameKind) {
    parts.push("nombre exacto");
  } else if (params.firstNameKind === "prefix" && !params.surnameKind) {
    parts.push("nombre parcial");
  } else if (params.firstNameKind === "fuzzy" && !params.surnameKind) {
    parts.push("similitud ortográfica");
  }

  if (params.surnameKind === "exact") {
    parts.push(
      params.firstNameKind === "exact" && !params.hasNickname
        ? "nombre y apellido exactos"
        : "apellido exacto",
    );
  } else if (params.surnameKind === "prefix") {
    parts.push("apellido parcial");
  } else if (params.surnameKind === "fuzzy") {
    parts.push("similitud ortográfica");
  } else if (params.surnameKind === "nickname") {
    parts.push("coincidencia en apellido");
  }

  if (params.rankMatch === "exact") {
    parts.push("grado");
  } else if (params.rankMatch === "family") {
    parts.push("grado");
  }

  if (params.componentMatch) {
    parts.push("componente");
  }

  return parts.length > 0 ? parts.join(" + ") : "coincidencia parcial";
}

/**
 * Evalúa y puntúa (0..1) un candidato militar frente a la consulta analizada,
 * generando además el motivo legible en español.
 */
export function scoreCandidate(
  candidate: SigefanbPersonalItem,
  parsed: ParsedSmartQuery,
  options?: ScoreCandidateOptions,
): { score: number; motivo: string } {
  if (parsed.cedula !== null) {
    if (candidate.cedula === parsed.cedula) {
      return { score: 1, motivo: "cédula exacta" };
    }
    return { score: 0, motivo: "sin coincidencia" };
  }

  const queryTokens = parsed.nameTokens;
  const candidateTokens = splitCandidateTokens(
    candidate.nombreCompleto,
    options?.surnameStartIndex,
  );

  let baseScore = 0;
  let hasNickname = false;
  let surnameKind: TokenMatchKind | null = null;
  let firstNameKind: TokenMatchKind | null = null;

  if (queryTokens.length === 0) {
    baseScore = 0.42;
  } else {
    const pairs: TokenMatchResult[] = [];
    for (let qi = 0; qi < queryTokens.length; qi += 1) {
      const qt = queryTokens[qi];
      if (!qt) continue;
      const variants = parsed.expandedTokens[qi] ?? [qt];
      for (let ci = 0; ci < candidateTokens.length; ci += 1) {
        const ct = candidateTokens[ci];
        if (!ct) continue;
        const match = evaluateTokenPair(qt, variants, ct.value);
        if (match) {
          pairs.push({
            queryIndex: qi,
            candidateIndex: ci,
            quality: match.quality,
            kind: match.kind,
            isSurname: ct.isSurname,
          });
        }
      }
    }

    pairs.sort((a, b) => {
      if (b.quality !== a.quality) return b.quality - a.quality;
      if (a.isSurname !== b.isSurname) return a.isSurname ? -1 : 1;
      return a.queryIndex - b.queryIndex;
    });

    const usedQuery = new Set<number>();
    const usedCandidate = new Set<number>();
    const chosen: TokenMatchResult[] = [];

    for (const pair of pairs) {
      if (
        !usedQuery.has(pair.queryIndex) &&
        !usedCandidate.has(pair.candidateIndex)
      ) {
        usedQuery.add(pair.queryIndex);
        usedCandidate.add(pair.candidateIndex);
        chosen.push(pair);
      }
    }

    const totalQuality = chosen.reduce((acc, item) => acc + item.quality, 0);
    const avgQuality = totalQuality / queryTokens.length;
    const coverage = chosen.length / queryTokens.length;
    const hasSurnameMatch = chosen.some((item) => item.isSurname);

    baseScore =
      0.74 * avgQuality * (0.55 + 0.45 * coverage) +
      (hasSurnameMatch ? 0.04 : 0);

    for (const item of chosen) {
      if (item.kind === "nickname") {
        hasNickname = true;
      }
      if (item.isSurname) {
        if (!surnameKind) surnameKind = item.kind;
      } else if (!firstNameKind) {
        firstNameKind = item.kind;
      }
    }
  }

  let rankBonus = 0;
  let rankMatch: "exact" | "family" | null = null;
  if (parsed.grado) {
    const candidateRank = extractRankFromNormalized(
      normalizeText(candidate.grado),
    ).hint;
    if (
      candidateRank &&
      parsed.grado.canonical !== null &&
      candidateRank.canonical === parsed.grado.canonical
    ) {
      rankBonus = 0.14;
      rankMatch = "exact";
    } else if (candidateRank && candidateRank.family === parsed.grado.family) {
      rankBonus = 0.09;
      rankMatch = "family";
    } else {
      rankBonus = -0.08;
    }
  }

  let componentBonus = 0;
  let componentMatch = false;
  if (parsed.componente) {
    if (candidate.componente === parsed.componente) {
      componentBonus = 0.1;
      componentMatch = true;
    } else {
      componentBonus = -0.06;
    }
  }

  const rawScore = baseScore + rankBonus + componentBonus;
  const clamped = Math.max(0, Math.min(1, rawScore));
  const rounded = Math.round(clamped * 10_000) / 10_000;

  return {
    score: rounded,
    motivo: buildMotivo({
      hasNickname,
      surnameKind,
      firstNameKind,
      rankMatch,
      componentMatch,
    }),
  };
}

function escapeSqlLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function databasePriority(databaseName: string): number {
  const lower = databaseName.toLowerCase();
  if (lower.includes("profesionales")) return 0;
  if (lower.includes("cadetes")) return 1;
  if (lower.includes("alistados")) return 2;
  return 3;
}

function sortPoolsByPriority(pools: SigefanbPoolEntry[]): SigefanbPoolEntry[] {
  return [...pools].sort(
    (a, b) => databasePriority(a.database) - databasePriority(b.database),
  );
}

function countNonEmptyParts(parts: (string | null | undefined)[]): number {
  let count = 0;
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    count += normalizeText(trimmed).split(" ").filter(Boolean).length;
  }
  return count;
}

function mapRowToPersonalItem(row: PersonalQueryRow): {
  item: SigefanbPersonalItem;
  surnameStartIndex: number;
} {
  const cedula = String(row.cedula).trim();
  const rawNac = row.nacionalidad?.trim().toUpperCase();
  const nacionalidad: "V" | "E" = rawNac === "E" ? "E" : "V";
  const unidad = row.unidad?.trim() || null;
  const componente = deriveComponent(row.tipo_personal);
  const grado = formatGrado(row.descripcion_cargo, componente, unidad);
  const nombreCompleto = formatNombreCompleto([
    row.primer_nombre,
    row.segundo_nombre,
    row.primer_apellido,
    row.segundo_apellido,
  ]);
  const sexo = row.sexo?.trim() || null;
  const insignia =
    rankInsignia(row.descripcion_cargo, componente, unidad)?.src ?? null;

  const surnameStartIndex = countNonEmptyParts([
    row.primer_nombre,
    row.segundo_nombre,
  ]);

  return {
    item: {
      cedula,
      nacionalidad,
      nombreCompleto,
      grado,
      componente,
      unidad,
      sexo,
      insignia,
      fotoUrl: `/api/sigefanb/foto/${cedula}`,
    },
    surnameStartIndex,
  };
}

async function queryPoolsInParallel(
  sql: string,
  params: unknown[],
): Promise<{ entry: SigefanbPoolEntry; rows: PersonalQueryRow[] }[]> {
  const orderedPools = sortPoolsByPriority(getSigefanbPools());
  const settled = await Promise.allSettled(
    orderedPools.map(async (entry) => {
      const result = await entry.pool.query<PersonalQueryRow>(sql, params);
      return { entry, rows: result.rows };
    }),
  );

  const fulfilled: { entry: SigefanbPoolEntry; rows: PersonalQueryRow[] }[] =
    [];
  let rejectedCount = 0;

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const poolEntry = orderedPools[i];
    if (outcome?.status === "fulfilled") {
      fulfilled.push(outcome.value);
    } else if (outcome?.status === "rejected") {
      rejectedCount += 1;
      console.error(
        `Error consultando base SIGEFANB (${poolEntry?.database ?? "desconocida"}):`,
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Error desconocido",
      );
    }
  }

  if (rejectedCount === orderedPools.length) {
    throw new SigefanbUnavailableError(
      "No fue posible consultar ninguna base de datos de SIGEFANB",
    );
  }

  return fulfilled;
}

function buildComponentSqlClause(
  componente: FanbComponentCode,
  params: unknown[],
): string {
  const patterns = COMPONENT_SQL_PATTERNS[componente];
  const conditions = patterns.map((pattern) => {
    params.push(pattern);
    return `${TIPO_PERSONAL_SQL_EXPR} LIKE $${params.length} ESCAPE '\\'`;
  });
  return `  AND (${conditions.join(" OR ")})`;
}

function buildRankSqlClause(
  grado: ParsedRankHint,
  params: unknown[],
): string | null {
  const matchingRule = RANK_RULES.find(
    (rule) =>
      (grado.canonical !== null && rule.canonical === grado.canonical) ||
      (grado.canonical === null && rule.family === grado.family),
  );
  if (!matchingRule || matchingRule.sqlKeywords.length === 0) {
    return null;
  }
  const clauses = matchingRule.sqlKeywords.map((kw) => {
    params.push(`%${escapeSqlLike(kw)}%`);
    return `  AND ${CARGO_SQL_EXPR} LIKE $${params.length} ESCAPE '\\'`;
  });
  return clauses.join("\n");
}

function buildPass1Sql(
  parsed: ParsedSmartQuery,
  explicitComponente: FanbComponentCode | null,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];

  for (const variants of parsed.expandedTokens.slice(
    0,
    MAX_QUERY_NAME_TOKENS,
  )) {
    const orParts = variants.map((variant) => {
      params.push(`%${escapeSqlLike(variant)}%`);
      return `${FULL_NAME_SQL_EXPR} LIKE $${params.length} ESCAPE '\\'`;
    });
    clauses.push(`  AND (${orParts.join(" OR ")})`);
  }

  if (explicitComponente) {
    clauses.push(buildComponentSqlClause(explicitComponente, params));
  } else if (parsed.nameTokens.length === 0 && parsed.componente) {
    clauses.push(buildComponentSqlClause(parsed.componente, params));
  }

  if (parsed.nameTokens.length === 0 && parsed.grado) {
    const rankClause = buildRankSqlClause(parsed.grado, params);
    if (rankClause) {
      clauses.push(rankClause);
    }
  }

  const sql = `${BASE_PERSONAL_SELECT}
${clauses.join("\n")}
ORDER BY p.cedula ASC
LIMIT ${PASS1_LIMIT_PER_POOL}`;

  return { sql, params };
}

function buildPass2Sql(
  parsed: ParsedSmartQuery,
  explicitComponente: FanbComponentCode | null,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];

  for (const variants of parsed.expandedTokens.slice(
    0,
    MAX_QUERY_NAME_TOKENS,
  )) {
    const subPatterns = new Set<string>();
    for (const variant of variants) {
      if (variant.length >= 3) {
        subPatterns.add(variant.slice(0, 3));
        if (variant.length >= 5) {
          subPatterns.add(variant.slice(-3));
        }
      } else if (variant.length >= 2) {
        subPatterns.add(variant);
      }
    }

    const orParts = Array.from(subPatterns).map((sub) => {
      params.push(`%${escapeSqlLike(sub)}%`);
      return `${FULL_NAME_SQL_EXPR} LIKE $${params.length} ESCAPE '\\'`;
    });

    if (orParts.length > 0) {
      clauses.push(`  AND (${orParts.join(" OR ")})`);
    }
  }

  const compToFilter =
    explicitComponente ??
    (parsed.nameTokens.length <= 1 ? parsed.componente : null);
  if (compToFilter) {
    clauses.push(buildComponentSqlClause(compToFilter, params));
  }

  if (parsed.nameTokens.length <= 1 && parsed.grado) {
    const rankClause = buildRankSqlClause(parsed.grado, params);
    if (rankClause) {
      clauses.push(rankClause);
    }
  }

  const sql = `${BASE_PERSONAL_SELECT}
${clauses.join("\n")}
ORDER BY p.cedula ASC
LIMIT ${PASS2_LIMIT_PER_POOL}`;

  return { sql, params };
}

/**
 * Búsqueda inteligente de personal activo en SIGEFANB:
 * soporta cédula exacta, acentos/mayúsculas, apodos venezolanos, grados,
 * componentes FANB y errores ortográficos mediante prefiltros SQL y scoring en memoria.
 */
export async function buscarPersonalInteligente(
  input: SmartSearchInput,
): Promise<SigefanbSmartCandidate[]> {
  const trimmed = input.q.trim();
  const limit = Math.max(1, Math.min(MAX_LIMIT, input.limit ?? DEFAULT_LIMIT));
  const explicitComponente = input.componente
    ? deriveComponent(input.componente)
    : null;

  if (input.componente && !explicitComponente) {
    return [];
  }

  const parsed = parseSmartQuery(trimmed, input.grado, input.componente);

  if (parsed.cedula !== null) {
    const cedulaSql = `${BASE_PERSONAL_SELECT}
  AND p.cedula = $1::int
ORDER BY p.cedula ASC
LIMIT 1`;
    const results = await queryPoolsInParallel(cedulaSql, [
      Number.parseInt(parsed.cedula, 10),
    ]);
    for (const { rows } of results) {
      const first = rows[0];
      if (first) {
        const { item } = mapRowToPersonalItem(first);
        if (explicitComponente && item.componente !== explicitComponente) {
          return [];
        }
        return [{ ...item, score: 1, motivo: "cédula exacta" }];
      }
    }
    return [];
  }

  if (
    trimmed.length < 2 ||
    (trimmed.length < 3 && !parsed.grado && !parsed.componente) ||
    (parsed.nameTokens.length === 0 && !parsed.grado && !parsed.componente)
  ) {
    throw new HTTPException(400, {
      message:
        "El término de búsqueda debe tener al menos 3 caracteres o indicar grado/componente",
    });
  }

  const candidatesByCedula = new Map<
    string,
    {
      item: SigefanbPersonalItem;
      surnameStartIndex: number;
      poolOrder: number;
    }
  >();

  let sequence = 0;
  const collectRows = (
    results: { entry: SigefanbPoolEntry; rows: PersonalQueryRow[] }[],
  ) => {
    for (const { rows } of results) {
      for (const row of rows) {
        const mapped = mapRowToPersonalItem(row);
        if (
          explicitComponente &&
          mapped.item.componente !== explicitComponente
        ) {
          continue;
        }
        if (!candidatesByCedula.has(mapped.item.cedula)) {
          candidatesByCedula.set(mapped.item.cedula, {
            item: mapped.item,
            surnameStartIndex: mapped.surnameStartIndex,
            poolOrder: sequence,
          });
          sequence += 1;
        }
      }
    }
  };

  const pass1 = buildPass1Sql(parsed, explicitComponente);
  const pass1Results = await queryPoolsInParallel(pass1.sql, pass1.params);
  collectRows(pass1Results);

  if (
    candidatesByCedula.size < MIN_CANDIDATES_BEFORE_PASS2 &&
    parsed.nameTokens.length > 0
  ) {
    const pass2 = buildPass2Sql(parsed, explicitComponente);
    const pass2Results = await queryPoolsInParallel(pass2.sql, pass2.params);
    collectRows(pass2Results);
  }

  const scored: {
    candidate: SigefanbSmartCandidate;
    poolOrder: number;
  }[] = [];

  for (const entry of candidatesByCedula.values()) {
    const { score, motivo } = scoreCandidate(entry.item, parsed, {
      surnameStartIndex: entry.surnameStartIndex,
    });
    if (score >= MIN_SCORE_THRESHOLD) {
      scored.push({
        candidate: {
          ...entry.item,
          score,
          motivo,
        },
        poolOrder: entry.poolOrder,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.candidate.score !== a.candidate.score) {
      return b.candidate.score - a.candidate.score;
    }
    return a.poolOrder - b.poolOrder;
  });

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

import { z } from "zod";
import { extraerOrdenesPorReglas } from "./extractor-reglas";
import { parsePlazoEspanol } from "./plazo-parser";
import type {
  DiscursoMotorUsado,
  DiscursoOrdenBorrador,
  DiscursoPrioridad,
} from "./types";

const MAX_CHUNK_CHARS = 3500;
const CHUNK_OVERLAP_CHARS = 300;
const OLLAMA_TIMEOUT_MS = 45_000;

const llmOrderSchema = z.object({
  titulo: z.string().trim().min(3),
  descripcion: z.string().trim().optional().default(""),
  responsable_mencionado: z.string().trim().optional().default(""),
  grado: z.string().trim().nullable().optional().default(null),
  componente: z
    .enum(["EJB", "ARB", "AMB", "GNB", "MIL"])
    .nullable()
    .optional()
    .default(null),
  nombre: z.string().trim().nullable().optional().default(null),
  apellido: z.string().trim().nullable().optional().default(null),
  plazo_texto: z.string().trim().nullable().optional().default(null),
  prioridad: z
    .enum(["no-priority", "low", "medium", "high", "urgent"])
    .optional()
    .default("medium"),
  cita_textual: z.string().trim().min(3),
  confianza: z.number().min(0).max(1).optional().default(0.8),
});

const llmResponseSchema = z.object({
  ordenes: z.array(llmOrderSchema),
});

const OLLAMA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ordenes"],
  properties: {
    ordenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "titulo",
          "descripcion",
          "responsable_mencionado",
          "grado",
          "componente",
          "nombre",
          "apellido",
          "plazo_texto",
          "prioridad",
          "cita_textual",
          "confianza",
        ],
        properties: {
          titulo: { type: "string" },
          descripcion: { type: "string" },
          responsable_mencionado: { type: "string" },
          grado: { type: ["string", "null"] },
          componente: {
            type: ["string", "null"],
            enum: ["EJB", "ARB", "AMB", "GNB", "MIL", null],
          },
          nombre: { type: ["string", "null"] },
          apellido: { type: ["string", "null"] },
          plazo_texto: { type: ["string", "null"] },
          prioridad: {
            type: "string",
            enum: ["no-priority", "low", "medium", "high", "urgent"],
          },
          cita_textual: { type: "string" },
          confianza: { type: "number" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `Eres un asistente institucional del Despacho Ministerial de la Fuerza Armada Nacional Bolivariana (FANB, Venezuela).
Tu tarea es extraer TODAS las órdenes, instrucciones, asignaciones o compromisos concretos de un discurso o minuta de reunión.

Reglas estrictas:
1. Devuelve únicamente JSON válido que cumpla el esquema solicitado.
2. No inventes cédulas ni personas que no figuren en el texto.
3. Normaliza el componente cuando aparezca: EJB (Ejército), ARB (Armada), AMB (Aviación), GNB (Guardia Nacional), MIL (Milicia), o null si no se menciona.
4. En "titulo", redacta una acción breve y clara (máx. 100 caracteres).
5. En "plazo_texto", copia literalmente la expresión de fecha/plazo del discurso (ej. "de inmediato", "para el viernes", "en 15 días", "antes de fin de mes") o null si no hay plazo.
6. En "cita_textual", copia el fragmento exacto del texto original que respalda la orden.

Ejemplo 1:
Texto: "Instruyo al General de Brigada Rodríguez del Ejército Bolivariano que verifique de inmediato el parque automotor en la frontera."
Salida: {"ordenes":[{"titulo":"Verificar estado del parque automotor en frontera","descripcion":"Verificar e informar el estado del parque automotor en unidades de frontera.","responsable_mencionado":"General de Brigada Rodríguez (EJB)","grado":"General de Brigada","componente":"EJB","nombre":null,"apellido":"Rodríguez","plazo_texto":"de inmediato","prioridad":"urgent","cita_textual":"Instruyo al General de Brigada Rodríguez del Ejército Bolivariano que verifique de inmediato el parque automotor en la frontera.","confianza":0.95}]}

Ejemplo 2:
Texto: "Quiero que el Contralmirante González de la Armada presente el plan de mantenimiento para el viernes."
Salida: {"ordenes":[{"titulo":"Presentar plan de mantenimiento de la Armada","descripcion":"Presentar el plan de mantenimiento preventivo correspondiente a la Armada Bolivariana.","responsable_mencionado":"Contralmirante González (ARB)","grado":"Contralmirante","componente":"ARB","nombre":null,"apellido":"González","plazo_texto":"para el viernes","prioridad":"high","cita_textual":"Quiero que el Contralmirante González de la Armada presente el plan de mantenimiento para el viernes.","confianza":0.92}]}`;

export type ExtraccionOrdenesResultado = {
  ordenes: DiscursoOrdenBorrador[];
  motorUsado: DiscursoMotorUsado;
  fallbackMotivo?: string;
};

function chunkText(texto: string): string[] {
  const clean = texto.trim();
  if (clean.length <= MAX_CHUNK_CHARS) {
    return [clean];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(clean.length, start + MAX_CHUNK_CHARS);
    if (end < clean.length) {
      const boundary = clean.lastIndexOf("\n", end);
      const sentenceBoundary = clean.lastIndexOf(". ", end);
      const bestBoundary = Math.max(boundary, sentenceBoundary);
      if (bestBoundary > start + MAX_CHUNK_CHARS * 0.5) {
        end = bestBoundary + 1;
      }
    }

    const slice = clean.slice(start, end).trim();
    if (slice) {
      chunks.push(slice);
    }

    if (end >= clean.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS);
  }

  return chunks;
}

function normalizeForDedupe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areSimilar(a: string, b: string): boolean {
  const na = normalizeForDedupe(a);
  const nb = normalizeForDedupe(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const setA = new Set(na.split(" ").filter((w) => w.length > 2));
  const setB = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return false;

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection += 1;
  }
  const overlap = intersection / Math.min(setA.size, setB.size);
  return overlap >= 0.8;
}

function deduplicateOrders(
  items: DiscursoOrdenBorrador[],
): DiscursoOrdenBorrador[] {
  const unique: DiscursoOrdenBorrador[] = [];

  for (const item of items) {
    const isDup = unique.some(
      (existing) =>
        areSimilar(existing.citaTextual, item.citaTextual) ||
        (areSimilar(existing.titulo, item.titulo) &&
          (existing.pistas.apellido ?? "") === (item.pistas.apellido ?? "")),
    );
    if (!isDup) {
      unique.push({
        ...item,
        id: `orden-${unique.length + 1}`,
      });
    }
  }

  return unique;
}

function mapLlmOrder(
  raw: z.infer<typeof llmOrderSchema>,
  index: number,
  fechaBase: Date,
): DiscursoOrdenBorrador {
  const plazoSource = raw.plazo_texto || raw.cita_textual;
  const parsedPlazo = parsePlazoEspanol(plazoSource, fechaBase);
  const prioridad: DiscursoPrioridad =
    raw.prioridad !== "medium"
      ? raw.prioridad
      : (parsedPlazo.prioridadSugerida ?? raw.prioridad);

  return {
    id: `orden-${index + 1}`,
    seleccionada: true,
    titulo:
      raw.titulo.length <= 120
        ? raw.titulo
        : `${raw.titulo.slice(0, 117).trimEnd()}...`,
    descripcion: raw.descripcion || raw.cita_textual,
    proyectoId: null,
    responsableMencionado: raw.responsable_mencionado,
    pistas: {
      grado: raw.grado,
      componente: raw.componente,
      apellido: raw.apellido,
      nombre: raw.nombre,
    },
    asignacionModo: "sin_responsable",
    responsableCedula: null,
    responsableUserId: null,
    candidatos: [],
    plazo: parsedPlazo.fechaIso,
    plazoTexto: raw.plazo_texto ?? parsedPlazo.textoDetectado,
    prioridad,
    citaTextual: raw.cita_textual,
    confianza: Number(raw.confianza.toFixed(2)),
  };
}

async function callOllamaChunk(
  chunk: string,
  baseUrl: string,
  model: string,
): Promise<z.infer<typeof llmOrderSchema>[]> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/chat`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: OLLAMA_JSON_SCHEMA,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extrae las órdenes e instrucciones del siguiente texto:\n\n"""\n${chunk}\n"""`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama respondió HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    message?: { content?: string };
    response?: string;
  };
  const content = payload.message?.content ?? payload.response ?? "";
  if (!content.trim()) {
    throw new Error("Ollama devolvió una respuesta vacía");
  }

  const parsedJson: unknown = JSON.parse(content);
  const validated = llmResponseSchema.parse(parsedJson);
  return validated.ordenes;
}

/**
 * Extrae órdenes usando Ollama local con fallback automático a `extractor-reglas.ts`.
 */
export async function extraerOrdenesConLlm(
  texto: string,
  fechaBase: Date = new Date(),
): Promise<ExtraccionOrdenesResultado> {
  const baseUrl = process.env.AGENDA_LLM_URL || "http://127.0.0.1:11434";
  const model = process.env.AGENDA_LLM_MODEL || "qwen3:8b";
  const chunks = chunkText(texto);

  try {
    const collected: DiscursoOrdenBorrador[] = [];
    for (const chunk of chunks) {
      const items = await callOllamaChunk(chunk, baseUrl, model);
      for (const item of items) {
        collected.push(mapLlmOrder(item, collected.length, fechaBase));
      }
    }

    const deduplicated = deduplicateOrders(collected);
    if (deduplicated.length === 0) {
      const fallbackOrdenes = extraerOrdenesPorReglas(texto, fechaBase);
      return {
        ordenes: fallbackOrdenes,
        motorUsado: "reglas",
        fallbackMotivo:
          "El modelo local no devolvió órdenes; se aplicó el extractor determinista.",
      };
    }

    return {
      ordenes: deduplicated,
      motorUsado: "ollama",
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Error desconocido en Ollama";
    const fallbackOrdenes = extraerOrdenesPorReglas(texto, fechaBase);
    return {
      ordenes: fallbackOrdenes,
      motorUsado: "reglas",
      fallbackMotivo: `Ollama no disponible (${reason}); se aplicó el extractor determinista.`,
    };
  }
}

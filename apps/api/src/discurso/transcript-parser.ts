export type TranscripcionFormato = "txt" | "md" | "vtt" | "srt" | "json";

export type TranscripcionNormalizada = {
  texto: string;
  tituloSugerido?: string;
  formatoDetectado: TranscripcionFormato;
};

function cleanLines(lines: string[]): string {
  const result: string[] = [];
  let prev = "";

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }
    if (line === prev) continue;
    result.push(line);
    prev = line;
  }

  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseVtt(content: string): string {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let skipMetadataBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (
      /^WEBVTT/i.test(trimmed) ||
      /^NOTE\b/i.test(trimmed) ||
      /^STYLE\b/i.test(trimmed) ||
      /^REGION\b/i.test(trimmed)
    ) {
      skipMetadataBlock = true;
      continue;
    }

    if (skipMetadataBlock) {
      if (trimmed === "") {
        skipMetadataBlock = false;
      }
      continue;
    }

    // Timestamps tipo 00:01:02.500 --> 00:01:05.000
    if (/^\d{1,2}:\d{2}(?::\d{2})?\.\d{3}\s*-->\s*/.test(trimmed)) {
      continue;
    }

    // Identificador numérico de cue
    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    const cleaned = trimmed
      .replace(/<v\s+([^>]+)>/gi, "$1: ")
      .replace(/<\/?[^>]+>/g, "")
      .trim();

    if (cleaned) {
      out.push(cleaned);
    }
  }

  return cleanLines(out);
}

function parseSrt(content: string): string {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (
      /^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(
        trimmed,
      )
    ) {
      continue;
    }

    const cleaned = trimmed.replace(/<\/?[^>]+>/g, "").trim();
    if (cleaned) {
      out.push(cleaned);
    }
  }

  return cleanLines(out);
}

function formatSpeakerLine(speaker: unknown, text: unknown): string | null {
  if (typeof text !== "string") return null;
  const cleanText = text.trim();
  if (!cleanText) return null;
  if (typeof speaker === "string" && speaker.trim()) {
    return `${speaker.trim()}: ${cleanText}`;
  }
  return cleanText;
}

function extractLinesFromArray(items: unknown[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const line = formatSpeakerLine(
        rec.speaker ?? rec.speaker_name ?? rec.author,
        rec.text ?? rec.content ?? rec.utterance ?? rec.transcript,
      );
      if (line) out.push(line);
    }
  }
  return out;
}

function parsePlaudJson(content: string): {
  texto: string;
  tituloSugerido?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { texto: cleanLines(content.replace(/\r\n?/g, "\n").split("\n")) };
  }

  if (Array.isArray(parsed)) {
    const lines = extractLinesFromArray(parsed);
    return { texto: cleanLines(lines) };
  }

  if (!parsed || typeof parsed !== "object") {
    return { texto: String(parsed ?? "").trim() };
  }

  const obj = parsed as Record<string, unknown>;
  const tituloSugerido =
    typeof obj.title === "string" && obj.title.trim()
      ? obj.title.trim()
      : typeof obj.name === "string" && obj.name.trim()
        ? obj.name.trim()
        : undefined;

  const listCandidate =
    (Array.isArray(obj.utterances) && obj.utterances) ||
    (Array.isArray(obj.segments) && obj.segments) ||
    (Array.isArray(obj.transcript) && obj.transcript) ||
    (Array.isArray(obj.trans_result) && obj.trans_result);

  if (listCandidate) {
    const lines = extractLinesFromArray(listCandidate);
    if (lines.length > 0) {
      return { texto: cleanLines(lines), tituloSugerido };
    }
  }

  for (const key of ["transcript", "text", "content", "summary", "resumen"]) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) {
      return {
        texto: cleanLines(val.replace(/\r\n?/g, "\n").split("\n")),
        tituloSugerido,
      };
    }
  }

  return {
    texto: cleanLines(content.replace(/\r\n?/g, "\n").split("\n")),
    tituloSugerido,
  };
}

function parseMarkdown(content: string): {
  texto: string;
  tituloSugerido?: string;
} {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let tituloSugerido: string | undefined;
  const out: string[] = [];

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^#\s+(.+)$/);
    if (headingMatch && !tituloSugerido) {
      tituloSugerido = headingMatch[1]?.trim();
    }

    const cleaned = rawLine
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1");

    out.push(cleaned);
  }

  return { texto: cleanLines(out), tituloSugerido };
}

function detectFormat(content: string): TranscripcionFormato {
  const trimmed = content.trim();
  if (/^WEBVTT\b/i.test(trimmed)) return "vtt";
  if (
    /^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(
      trimmed,
    )
  ) {
    return "srt";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // No es JSON válido; tratar como texto plano.
    }
  }
  if (/^#{1,6}\s+/m.test(trimmed) || /\*\*[^*]+\*\*/.test(trimmed)) {
    return "md";
  }
  return "txt";
}

/**
 * Normaliza transcripciones de texto plano, Markdown, subtítulos VTT/SRT y JSON de Plaud.
 */
export function normalizarTranscripcion(
  contenido: string,
  formato?: TranscripcionFormato,
): TranscripcionNormalizada {
  const formatoDetectado = formato ?? detectFormat(contenido);

  switch (formatoDetectado) {
    case "vtt":
      return { texto: parseVtt(contenido), formatoDetectado };
    case "srt":
      return { texto: parseSrt(contenido), formatoDetectado };
    case "json": {
      const parsed = parsePlaudJson(contenido);
      return { ...parsed, formatoDetectado };
    }
    case "md": {
      const parsed = parseMarkdown(contenido);
      return { ...parsed, formatoDetectado };
    }
    default:
      return {
        texto: cleanLines(contenido.replace(/\r\n?/g, "\n").split("\n")),
        formatoDetectado: "txt",
      };
  }
}

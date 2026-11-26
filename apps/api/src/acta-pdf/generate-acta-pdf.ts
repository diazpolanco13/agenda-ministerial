import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

export type ActaPdfOrdenItem = {
  folio: string;
  titulo: string;
  descripcion?: string | null;
  responsableNombre: string;
  responsableGrado?: string | null;
  plazo?: string | null;
  prioridad?: string | null;
  citaTextual?: string | null;
};

export type GenerateActaPdfInput = {
  titulo: string;
  fecha: string; // YYYY-MM-DD o ISO
  referencia?: string | null;
  asistentes?: string[];
  ordenes: ActaPdfOrdenItem[];
  generadoPor?: string | null;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 524 pt
const MIN_CONTENT_Y = 85;

const COLOR_NAVY = rgb(0x1e / 255, 0x3a / 255, 0x5f / 255); // #1E3A5F
const COLOR_TEXT = rgb(0x1e / 255, 0x29 / 255, 0x3b / 255);
const COLOR_MUTED = rgb(0x47 / 255, 0x55 / 255, 0x69 / 255);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_ROW_ALT = rgb(0xf8 / 255, 0xf9 / 255, 0xfa / 255); // #F8F9FA
const COLOR_BORDER = rgb(0xcb / 255, 0xd5 / 255, 0xe1 / 255);

const COLOR_FLAG_YELLOW = rgb(0xf5 / 255, 0xc4 / 255, 0x00 / 255); // #F5C400
const COLOR_FLAG_BLUE = rgb(0x00 / 255, 0x38 / 255, 0x93 / 255); // #003893
const COLOR_FLAG_RED = rgb(0xce / 255, 0x11 / 255, 0x26 / 255); // #CE1126

const COL_WIDTHS = {
  folio: 78,
  orden: 200,
  responsable: 130,
  plazo: 64,
  prioridad: 52,
} as const;

type TableColumn = {
  key: keyof typeof COL_WIDTHS;
  label: string;
  width: number;
};

const TABLE_COLUMNS: readonly TableColumn[] = [
  { key: "folio", label: "Folio", width: COL_WIDTHS.folio },
  { key: "orden", label: "Acuerdo / Orden", width: COL_WIDTHS.orden },
  {
    key: "responsable",
    label: "Responsable (Grado y Nombre)",
    width: COL_WIDTHS.responsable,
  },
  { key: "plazo", label: "Plazo", width: COL_WIDTHS.plazo },
  { key: "prioridad", label: "Prioridad", width: COL_WIDTHS.prioridad },
];

const CHAR_REPLACEMENTS: Record<string, string> = {
  "\u2014": "-", // em dash
  "\u2013": "-", // en dash
  "\u2012": "-", // figure dash
  "\u2015": "-", // horizontal bar
  "\u2212": "-", // minus sign
  "\u201C": '"', // left double quote
  "\u201D": '"', // right double quote
  "\u201E": '"', // double low-9 quote
  "\u2033": '"', // double prime
  "\u2018": "'", // left single quote
  "\u2019": "'", // right single quote
  "\u201A": "'", // single low-9 quote
  "\u2032": "'", // prime
  "\u02BC": "'", // modifier letter apostrophe
  "\u2039": "<", // single left-pointing angle quote
  "\u203A": ">", // single right-pointing angle quote
  "\u2026": "...", // ellipsis
  "\u2022": "·", // bullet
  "\u25CF": "·", // black circle
  "\u25E6": "·", // white bullet
  "\u25AA": "·", // small square
  "\u2043": "-", // hyphen bullet
  "\u20AC": "EUR",
  "\u2192": "->",
  "\u2794": "->",
  "\u21D2": "=>",
  "\u2190": "<-",
  "\u2194": "<->",
  "\u2713": "[OK]",
  "\u2714": "[OK]",
  "\u2717": "[X]",
  "\u2718": "[X]",
  "\u00A0": " ",
  "\u202F": " ",
  "\u2007": " ",
  "\u2009": " ",
  "\u200A": " ",
  "\u2002": " ",
  "\u2003": " ",
  "\u2004": " ",
  "\u2005": " ",
  "\u2006": " ",
  "\u2008": " ",
  "\u205F": " ",
  "\u3000": " ",
  "\u200B": "",
  "\u200C": "",
  "\u200D": "",
  "\uFEFF": "",
  "\u00AD": "",
};

/**
 * Normaliza un texto a caracteres compatibles con WinAnsi (Windows-1252 / Latin-1)
 * preservando tildes, eñes y signos españoles comunes (`áéíóúÁÉÍÓÚñÑüÜ«»°·¿¡`).
 */
export function toWinAnsiSafe(text: string): string {
  if (!text) return "";

  const normalized = text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ");

  let mapped = "";
  for (const ch of normalized) {
    if (ch in CHAR_REPLACEMENTS) {
      mapped += CHAR_REPLACEMENTS[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (
      code === 0x0a ||
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff)
    ) {
      mapped += ch;
    }
  }

  return mapped;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const safe = toWinAnsiSafe(text);
  if (!safe.trim()) return [];

  const paragraphs = safe.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      if (lines.length > 0 && lines[lines.length - 1] !== "") {
        lines.push("");
      }
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        currentLine = word;
        continue;
      }

      // Palabra más ancha que la columna: dividir por carácter sin desbordar.
      let chunk = "";
      for (const char of word) {
        const nextChunk = chunk + char;
        if (font.widthOfTextAtSize(nextChunk, fontSize) <= maxWidth) {
          chunk = nextChunk;
        } else {
          if (chunk) lines.push(chunk);
          chunk = char;
        }
      }
      currentLine = chunk;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function parseDateValue(
  raw: string,
): { date: Date; dateOnly: boolean } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return Number.isNaN(date.getTime()) ? null : { date, dateOnly: true };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: parsed, dateOnly: false };
}

function formatFechaEsVe(
  raw: string | null | undefined,
  variant: "long" | "short" | "numeric" = "long",
): string {
  if (!raw?.trim()) return "-";
  const parsed = parseDateValue(raw);
  if (!parsed) return toWinAnsiSafe(raw.trim());

  const timeZone = parsed.dateOnly ? "UTC" : "America/Caracas";
  const options: Intl.DateTimeFormatOptions =
    variant === "long"
      ? { day: "2-digit", month: "long", year: "numeric", timeZone }
      : variant === "short"
        ? { day: "2-digit", month: "short", year: "numeric", timeZone }
        : { day: "2-digit", month: "2-digit", year: "numeric", timeZone };

  return toWinAnsiSafe(new Intl.DateTimeFormat("es-VE", options).format(parsed.date));
}

function formatPrioridadEs(raw: string | null | undefined): string {
  const normalized = toWinAnsiSafe(raw ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "urgent":
    case "urgente":
    case "critical":
    case "critica":
    case "crítica":
      return "Urgente";
    case "high":
    case "alta":
      return "Alta";
    case "medium":
    case "media":
      return "Media";
    case "low":
    case "baja":
      return "Baja";
    case "normal":
    case "":
      return "Normal";
    default:
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}

const KNOWN_RANK_ABBREV_PREFIXES = [
  "g/j",
  "m/g",
  "g/d",
  "g/b",
  "a/j",
  "alm.",
  "alm",
  "v/a",
  "c/a",
  "c/n",
  "c/f",
  "c/c",
  "t/n",
  "t/f",
  "t/c",
  "tcnel.",
  "tcnel",
  "cnel.",
  "cnel",
  "ptte.",
  "ptte",
  "tte.",
  "tte",
  "cap.",
  "cap",
  "may.",
  "may",
  "s/s",
  "s/a",
  "s/m1",
  "s/m2",
  "s/m3",
  "s/1",
  "s/2",
  "c/1",
  "c/2",
];

function normalizeRankCheck(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function combineGradoNombre(
  grado: string | null | undefined,
  nombre: string | null | undefined,
): string {
  const cleanName = toWinAnsiSafe(nombre ?? "").trim();
  const cleanGrado = toWinAnsiSafe(grado ?? "").trim();
  if (!cleanName) return cleanGrado || "Por asignar";
  if (!cleanGrado) return cleanName;

  const normName = normalizeRankCheck(cleanName);
  const normGrado = normalizeRankCheck(cleanGrado);
  if (normName.startsWith(normGrado)) {
    return cleanName;
  }

  const firstToken = normName.split(" ")[0] ?? "";
  if (KNOWN_RANK_ABBREV_PREFIXES.includes(firstToken)) {
    return cleanName;
  }

  return `${cleanGrado} ${cleanName}`;
}

function formatResponsable(item: ActaPdfOrdenItem): string {
  const nombre = toWinAnsiSafe(item.responsableNombre ?? "").trim();
  if (!nombre) return "Por asignar";
  return combineGradoNombre(item.responsableGrado, nombre);
}

async function loadMppdLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "apps/web/public/marca/mppd.png"),
    path.resolve(process.cwd(), "../web/public/marca/mppd.png"),
    path.resolve(process.cwd(), "../../apps/web/public/marca/mppd.png"),
    path.resolve(moduleDir, "../../../web/public/marca/mppd.png"),
    path.resolve(moduleDir, "../../../../apps/web/public/marca/mppd.png"),
  ];

  for (const filePath of candidates) {
    try {
      const bytes = await readFile(filePath);
      return await pdfDoc.embedPng(bytes);
    } catch {
      // Continuar con el siguiente candidato si no existe o no es válido.
    }
  }

  return null;
}

function drawTricolorLine(page: PDFPage, yTop: number): number {
  const stripeHeight = 1.5;
  page.drawRectangle({
    x: MARGIN,
    y: yTop - stripeHeight,
    width: CONTENT_WIDTH,
    height: stripeHeight,
    color: COLOR_FLAG_YELLOW,
  });
  page.drawRectangle({
    x: MARGIN,
    y: yTop - stripeHeight * 2,
    width: CONTENT_WIDTH,
    height: stripeHeight,
    color: COLOR_FLAG_BLUE,
  });
  page.drawRectangle({
    x: MARGIN,
    y: yTop - stripeHeight * 3,
    width: CONTENT_WIDTH,
    height: stripeHeight,
    color: COLOR_FLAG_RED,
  });
  return yTop - stripeHeight * 3;
}

function drawFirstPageHeader(
  page: PDFPage,
  logo: PDFImage | null,
  fechaStr: string,
  fontRegular: PDFFont,
  fontBold: PDFFont,
): number {
  const headerTop = PAGE_HEIGHT - MARGIN;
  const logoSlot = 46;

  if (logo) {
    const scale = Math.min(logoSlot / logo.width, logoSlot / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    page.drawImage(logo, {
      x: MARGIN + (logoSlot - drawW) / 2,
      y: headerTop - logoSlot + (logoSlot - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  const dateText = toWinAnsiSafe(fechaStr);
  const dateSize = 8.5;
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, dateSize);
  const dateBlockWidth = Math.max(dateWidth + 10, 82);

  const textAreaX = MARGIN + logoSlot + 10;
  const textAreaWidth = CONTENT_WIDTH - logoSlot - 10 - dateBlockWidth;

  const line1 = "REPÚBLICA BOLIVARIANA DE VENEZUELA";
  const line2 = "MINISTERIO DEL PODER POPULAR PARA LA DEFENSA";
  const line3 = "DESPACHO DEL MINISTRO · ACTA DE ACUERDOS Y ÓRDENES";

  const drawCenteredInHeader = (
    text: string,
    y: number,
    font: PDFFont,
    size: number,
    color = COLOR_NAVY,
  ) => {
    const safe = toWinAnsiSafe(text);
    const w = font.widthOfTextAtSize(safe, size);
    const x = textAreaX + Math.max(0, (textAreaWidth - w) / 2);
    page.drawText(safe, { x, y, size, font, color });
  };

  drawCenteredInHeader(line1, headerTop - 12, fontBold, 8.5, COLOR_MUTED);
  drawCenteredInHeader(line2, headerTop - 25, fontBold, 9.5, COLOR_NAVY);
  drawCenteredInHeader(line3, headerTop - 38, fontBold, 8, COLOR_MUTED);

  page.drawText(dateText, {
    x: PAGE_WIDTH - MARGIN - dateWidth,
    y: headerTop - 14,
    size: dateSize,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  const tricolorBottom = drawTricolorLine(page, headerTop - logoSlot - 8);
  return tricolorBottom - 16;
}

function drawContinuationHeader(
  page: PDFPage,
  logo: PDFImage | null,
  fechaStr: string,
  fontRegular: PDFFont,
  fontBold: PDFFont,
): number {
  const headerTop = PAGE_HEIGHT - MARGIN;
  const miniSlot = 20;

  if (logo) {
    const scale = Math.min(miniSlot / logo.width, miniSlot / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    page.drawImage(logo, {
      x: MARGIN,
      y: headerTop - miniSlot + (miniSlot - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  const titleX = logo ? MARGIN + miniSlot + 8 : MARGIN;
  const leftText = toWinAnsiSafe(
    "MINISTERIO DEL PODER POPULAR PARA LA DEFENSA · ACTA DE ACUERDOS Y ÓRDENES",
  );
  page.drawText(leftText, {
    x: titleX,
    y: headerTop - 13,
    size: 8,
    font: fontBold,
    color: COLOR_NAVY,
  });

  const rightText = toWinAnsiSafe(fechaStr);
  const rightWidth = fontRegular.widthOfTextAtSize(rightText, 8);
  page.drawText(rightText, {
    x: PAGE_WIDTH - MARGIN - rightWidth,
    y: headerTop - 13,
    size: 8,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  const tricolorBottom = drawTricolorLine(page, headerTop - miniSlot - 6);
  return tricolorBottom - 12;
}

function drawTableHeader(
  page: PDFPage,
  yTop: number,
  fontBold: PDFFont,
): number {
  const headerFontSize = 8;
  const lineHeight = 10;
  const padX = 5;
  const padY = 6;

  const wrappedHeaders = TABLE_COLUMNS.map((col) =>
    wrapText(col.label, fontBold, headerFontSize, col.width - padX * 2),
  );
  const maxLines = Math.max(1, ...wrappedHeaders.map((lines) => lines.length));
  const headerHeight = maxLines * lineHeight + padY * 2;

  page.drawRectangle({
    x: MARGIN,
    y: yTop - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: COLOR_NAVY,
  });

  let colX = MARGIN;
  TABLE_COLUMNS.forEach((col, idx) => {
    const lines = wrappedHeaders[idx] ?? [];
    lines.forEach((line, lineIdx) => {
      page.drawText(line, {
        x: colX + padX,
        y: yTop - padY - headerFontSize - lineIdx * lineHeight,
        size: headerFontSize,
        font: fontBold,
        color: COLOR_WHITE,
      });
    });
    colX += col.width;
  });

  return yTop - headerHeight;
}

function drawFooters(
  pages: PDFPage[],
  fontRegular: PDFFont,
): void {
  const totalPages = pages.length;
  const footerLineY = MARGIN + 16;
  const footerTextY = MARGIN + 4;
  const fontSize = 8;
  const leftLabel = toWinAnsiSafe("Uso oficial · Sistema AGENDA · MPPD");

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: footerLineY },
      end: { x: PAGE_WIDTH - MARGIN, y: footerLineY },
      thickness: 0.5,
      color: COLOR_BORDER,
    });

    page.drawText(leftLabel, {
      x: MARGIN,
      y: footerTextY,
      size: fontSize,
      font: fontRegular,
      color: COLOR_MUTED,
    });

    const pageLabel = toWinAnsiSafe(`Página ${index + 1} de ${totalPages}`);
    const pageLabelWidth = fontRegular.widthOfTextAtSize(pageLabel, fontSize);
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - pageLabelWidth,
      y: footerTextY,
      size: fontSize,
      font: fontRegular,
      color: COLOR_MUTED,
    });
  });
}

type StyledLine = {
  text: string;
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
};

function buildOrdenCellLines(
  item: ActaPdfOrdenItem,
  maxWidth: number,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  fontOblique: PDFFont,
): StyledLine[] {
  const result: StyledLine[] = [];
  const tituloLines = wrapText(item.titulo || "Sin título", fontBold, 8.5, maxWidth);
  for (const line of tituloLines) {
    result.push({ text: line, font: fontBold, size: 8.5, color: COLOR_TEXT });
  }

  const descripcion = toWinAnsiSafe(item.descripcion ?? "").trim();
  if (descripcion) {
    const descLines = wrapText(descripcion, fontRegular, 7.8, maxWidth);
    const capped = descLines.slice(0, 6);
    if (descLines.length > 6 && capped[5]) {
      capped[5] = `${capped[5].slice(0, Math.max(0, capped[5].length - 3))}...`;
    }
    for (const line of capped) {
      result.push({ text: line, font: fontRegular, size: 7.8, color: COLOR_MUTED });
    }
  }

  const cita = toWinAnsiSafe(item.citaTextual ?? "")
    .trim()
    .replace(/^[«"]+|[»"]+$/g, "")
    .trim();
  if (cita) {
    const citaLines = wrapText(`«${cita}»`, fontOblique, 7.5, maxWidth);
    const cappedCita = citaLines.slice(0, 4);
    if (citaLines.length > 4 && cappedCita[3]) {
      cappedCita[3] = `${cappedCita[3].slice(0, Math.max(0, cappedCita[3].length - 4))}...»`;
    }
    for (const line of cappedCita) {
      result.push({ text: line, font: fontOblique, size: 7.5, color: COLOR_MUTED });
    }
  }

  return result;
}

/**
 * Genera el PDF oficial del Acta de Acuerdos y Órdenes con membrete del MPPD.
 */
export async function generateActaPdf(
  input: GenerateActaPdfInput,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(toWinAnsiSafe(input.titulo || "Acta de Acuerdos y Órdenes"));
  pdfDoc.setSubject(
    toWinAnsiSafe("Acta de Acuerdos y Órdenes - Ministerio del Poder Popular para la Defensa"),
  );
  pdfDoc.setCreator("Sistema AGENDA - MPPD");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const logo = await loadMppdLogo(pdfDoc);

  const fechaHeader = formatFechaEsVe(input.fecha, "short");
  const fechaCompleta = formatFechaEsVe(input.fecha, "long");

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const pages: PDFPage[] = [page];

  let y = drawFirstPageHeader(page, logo, fechaHeader, fontRegular, fontBold);

  // Bloque de datos del acta
  const titleLines = wrapText(
    input.titulo || "Acta de Acuerdos y Órdenes",
    fontBold,
    14,
    CONTENT_WIDTH,
  );
  for (const line of titleLines) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: 14,
      font: fontBold,
      color: COLOR_NAVY,
    });
    y -= 18;
  }

  y -= 2;
  const metaParts: string[] = [`Fecha: ${fechaCompleta}`];
  const referencia = toWinAnsiSafe(input.referencia ?? "").trim();
  if (referencia) {
    metaParts.push(`Referencia: ${referencia}`);
  }
  const generadoPor = toWinAnsiSafe(input.generadoPor ?? "").trim();
  if (generadoPor) {
    metaParts.push(`Generado por: ${generadoPor}`);
  }

  for (const metaLine of metaParts) {
    const wrappedMeta = wrapText(metaLine, fontRegular, 9.5, CONTENT_WIDTH);
    for (const line of wrappedMeta) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 9.5,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      y -= 13;
    }
  }

  const asistentes = (input.asistentes ?? [])
    .map((a) => toWinAnsiSafe(a).trim())
    .filter(Boolean);

  if (asistentes.length > 0) {
    y -= 4;
    page.drawText("Asistentes:", {
      x: MARGIN,
      y,
      size: 9.5,
      font: fontBold,
      color: COLOR_NAVY,
    });
    y -= 13;

    const asistentesText = asistentes.join(", ");
    const wrappedAsistentes = wrapText(
      asistentesText,
      fontRegular,
      9,
      CONTENT_WIDTH - 8,
    );
    for (const line of wrappedAsistentes) {
      if (y < MIN_CONTENT_Y + 40) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pages.push(page);
        y = drawContinuationHeader(page, logo, fechaHeader, fontRegular, fontBold);
      }
      page.drawText(line, {
        x: MARGIN + 8,
        y,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      y -= 12;
    }
  }

  y -= 10;

  if (y < MIN_CONTENT_Y + 45) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = drawContinuationHeader(page, logo, fechaHeader, fontRegular, fontBold);
  }

  y = drawTableHeader(page, y, fontBold);

  const ordenes = input.ordenes ?? [];
  const cellPadX = 5;
  const cellPadY = 6;
  const rowLineHeight = 10.5;

  if (ordenes.length === 0) {
    const emptyHeight = 28;
    page.drawRectangle({
      x: MARGIN,
      y: y - emptyHeight,
      width: CONTENT_WIDTH,
      height: emptyHeight,
      color: COLOR_ROW_ALT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });
    page.drawText("No se registraron acuerdos ni órdenes en esta acta.", {
      x: MARGIN + cellPadX,
      y: y - 17,
      size: 9,
      font: fontOblique,
      color: COLOR_MUTED,
    });
  } else {
    ordenes.forEach((item, index) => {
      const colFolioW = COL_WIDTHS.folio - cellPadX * 2;
      const colOrdenW = COL_WIDTHS.orden - cellPadX * 2;
      const colRespW = COL_WIDTHS.responsable - cellPadX * 2;
      const colPlazoW = COL_WIDTHS.plazo - cellPadX * 2;
      const colPrioW = COL_WIDTHS.prioridad - cellPadX * 2;

      const folioText = toWinAnsiSafe(item.folio?.trim() || `#${index + 1}`);
      const folioLines = wrapText(folioText, fontBold, 8, colFolioW);
      const ordenLines = buildOrdenCellLines(
        item,
        colOrdenW,
        fontRegular,
        fontBold,
        fontOblique,
      );
      const respLines = wrapText(
        formatResponsable(item),
        fontRegular,
        8,
        colRespW,
      );
      const plazoLines = wrapText(
        item.plazo ? formatFechaEsVe(item.plazo, "numeric") : "-",
        fontRegular,
        8,
        colPlazoW,
      );
      const prioLines = wrapText(
        formatPrioridadEs(item.prioridad),
        fontBold,
        8,
        colPrioW,
      );

      const maxLineCount = Math.max(
        1,
        folioLines.length,
        ordenLines.length,
        respLines.length,
        plazoLines.length,
        prioLines.length,
      );
      const rowHeight = maxLineCount * rowLineHeight + cellPadY * 2;

      if (y < MIN_CONTENT_Y || y - rowHeight < MIN_CONTENT_Y) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pages.push(page);
        y = drawContinuationHeader(page, logo, fechaHeader, fontRegular, fontBold);
        y = drawTableHeader(page, y, fontBold);
      }

      const rowBottom = y - rowHeight;
      page.drawRectangle({
        x: MARGIN,
        y: rowBottom,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: index % 2 === 1 ? COLOR_ROW_ALT : COLOR_WHITE,
        borderColor: COLOR_BORDER,
        borderWidth: 0.4,
      });

      let colX = MARGIN;

      // Columna 1: Folio
      folioLines.forEach((line, lineIdx) => {
        page.drawText(line, {
          x: colX + cellPadX,
          y: y - cellPadY - 8 - lineIdx * rowLineHeight,
          size: 8,
          font: fontBold,
          color: COLOR_NAVY,
        });
      });
      colX += COL_WIDTHS.folio;

      // Columna 2: Acuerdo / Orden
      ordenLines.forEach((line, lineIdx) => {
        page.drawText(line.text, {
          x: colX + cellPadX,
          y: y - cellPadY - line.size - lineIdx * rowLineHeight,
          size: line.size,
          font: line.font,
          color: line.color,
        });
      });
      colX += COL_WIDTHS.orden;

      // Columna 3: Responsable
      respLines.forEach((line, lineIdx) => {
        page.drawText(line, {
          x: colX + cellPadX,
          y: y - cellPadY - 8 - lineIdx * rowLineHeight,
          size: 8,
          font: fontRegular,
          color: COLOR_TEXT,
        });
      });
      colX += COL_WIDTHS.responsable;

      // Columna 4: Plazo
      plazoLines.forEach((line, lineIdx) => {
        page.drawText(line, {
          x: colX + cellPadX,
          y: y - cellPadY - 8 - lineIdx * rowLineHeight,
          size: 8,
          font: fontRegular,
          color: COLOR_TEXT,
        });
      });
      colX += COL_WIDTHS.plazo;

      // Columna 5: Prioridad
      prioLines.forEach((line, lineIdx) => {
        page.drawText(line, {
          x: colX + cellPadX,
          y: y - cellPadY - 8 - lineIdx * rowLineHeight,
          size: 8,
          font: fontBold,
          color: COLOR_TEXT,
        });
      });

      y = rowBottom;
    });
  }

  drawFooters(pages, fontRegular);

  return pdfDoc.save();
}

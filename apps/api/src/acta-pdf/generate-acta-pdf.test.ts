import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  generateActaPdf,
  toWinAnsiSafe,
  type ActaPdfOrdenItem,
} from "./generate-acta-pdf";

describe("toWinAnsiSafe", () => {
  it("preserves Spanish accents and safe symbols while replacing unsupported unicode", () => {
    const input =
      "ÁÉÍÓÚ áéíóú ñÑ üÜ «Cita» 100° · Guion — largo – y “comillas” ‘raras’… 🚀✅";
    const safe = toWinAnsiSafe(input);

    expect(safe).toContain("ÁÉÍÓÚ áéíóú ñÑ üÜ «Cita» 100° ·");
    expect(safe).toContain('Guion - largo - y "comillas" \'raras\'...');
    expect(safe).not.toContain("🚀");
    expect(safe).not.toContain("✅");
    expect(safe).not.toContain("—");
  });
});

describe("generateActaPdf", () => {
  it("generates a valid PDF starting with %PDF- and > 2 KB with Spanish accents and asistentes", async () => {
    const bytes = await generateActaPdf({
      titulo: "Reunión de Estado Mayor Superior — Revisión Estratégica",
      fecha: "2026-11-26",
      referencia: "Memorando MPPD-DM-2026-0412",
      generadoPor: "Secretaría del Despacho",
      asistentes: [
        "G/J Padrino López",
        "G/D Bolívar Rodríguez",
        "V/A Pérez Quintero",
      ],
      ordenes: [
        {
          folio: "ORD-2026-0001",
          titulo: "Actualizar plan de despliegue logístico",
          descripcion:
            "Coordinar con las Regiones Estratégicas de Defensa Integral la actualización de inventarios.",
          responsableGrado: "G/D",
          responsableNombre: "Bolívar Rodríguez",
          plazo: "2026-12-05",
          prioridad: "urgent",
          citaTextual: "«Garantizar disponibilidad operativa antes del cierre del mes»",
        },
        {
          folio: "ORD-2026-0002",
          titulo: "Informe de ejecución presupuestaria 🚀",
          responsableNombre: "",
          plazo: null,
          prioridad: "medium",
        },
      ],
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(2048);

    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const pageSize = loaded.getPage(0).getSize();
    expect(pageSize.width).toBe(612);
    expect(pageSize.height).toBe(792);
  });

  it("works without asistentes and generates multiple pages for 15+ ordenes", async () => {
    const ordenes: ActaPdfOrdenItem[] = Array.from({ length: 18 }, (_, i) => ({
      folio: `ORD-2026-${String(i + 1).padStart(4, "0")}`,
      titulo: `Acuerdo operacional número ${i + 1}: Seguimiento de directiva ministerial`,
      descripcion:
        "Evaluación periódica de metas trimestrales, verificación de novedades administrativas y reporte ejecutivo al Despacho.",
      responsableGrado: i % 2 === 0 ? "G/D" : "Cnel.",
      responsableNombre: `Rodríguez Bolívar ${i + 1}`,
      plazo: "2026-12-15",
      prioridad: i % 3 === 0 ? "high" : "low",
      citaTextual: "Cumplimiento estricto según cronograma aprobado.",
    }));

    const bytes = await generateActaPdf({
      titulo: "Acta Consolidada de Seguimiento de Compromisos",
      fecha: "2026-11-26T14:30:00Z",
      ordenes,
    });

    expect(bytes.byteLength).toBeGreaterThan(2048);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
  });

  it("handles an empty ordenes list gracefully", async () => {
    const bytes = await generateActaPdf({
      titulo: "Acta sin acuerdos",
      fecha: "2026-11-26",
      ordenes: [],
    });

    expect(bytes.byteLength).toBeGreaterThan(2048);
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});

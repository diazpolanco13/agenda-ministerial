import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { formatDailyBriefText, sendDailyBriefEmailHook } from "./delivery";
import {
  buildDeterministicBriefParagraph,
  type DailyBrief,
  type DailyBriefSummaryInput,
  generateExecutiveParagraphWithLlm,
} from "./generator";

describe("parte-diario", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("construye un párrafo determinista claro cuando no hay pendientes", () => {
    const summary: DailyBriefSummaryInput = {
      fechaLarga: "Jueves, 26 de noviembre de 2026",
      contadores: {
        venceHoy: 0,
        vencidas: 0,
        ordenesNuevas: 0,
        agendaDia: 0,
        pendientesVistoBueno: 0,
      },
    };

    const text = buildDeterministicBriefParagraph(summary);
    expect(text).toContain("Sin novedades pendientes");
  });

  it("construye un párrafo determinista con plurales y punto focal cuando hay actividad", () => {
    const summary: DailyBriefSummaryInput = {
      fechaLarga: "Jueves, 26 de noviembre de 2026",
      contadores: {
        venceHoy: 2,
        vencidas: 1,
        ordenesNuevas: 3,
        agendaDia: 4,
        pendientesVistoBueno: 1,
      },
      items: {
        vencidas: [
          {
            id: "task-1",
            projectId: "proj-1",
            projectName: "Despacho",
            projectSlug: "DSP",
            number: 14,
            title: "Plan de mantenimiento aéreo",
            priority: "urgent",
            dueDate: new Date("2026-11-25T16:00:00.000Z"),
            isOrder: true,
            orderFolio: "ORD-2026-0014",
            orderClosureStatus: "abierta",
            confidentialityLevel: "publica_interna",
          },
        ],
      },
    };

    const text = buildDeterministicBriefParagraph(summary);
    expect(text).toContain("1 tarea vencida");
    expect(text).toContain("2 compromisos que vencen hoy");
    expect(text).toContain("4 actividades en la agenda del día");
    expect(text).toContain("3 órdenes nuevas");
    expect(text).toContain("1 orden pendiente de visto bueno");
    expect(text).toContain("ORD-2026-0014");
    expect(text).toContain("Plan de mantenimiento aéreo");
  });

  it("usa Ollama cuando responde correctamente y hace fallback a determinista si falla", async () => {
    const summary: DailyBriefSummaryInput = {
      fechaLarga: "Jueves, 26 de noviembre de 2026",
      contadores: {
        venceHoy: 1,
        vencidas: 0,
        ordenesNuevas: 1,
        agendaDia: 2,
        pendientesVistoBueno: 0,
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content:
              "<think>razonamiento interno</think>Hoy se registra una tarea con cierre en la jornada y dos actividades en agenda. Se mantiene seguimiento de la orden nueva recibida.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const llmResult = await generateExecutiveParagraphWithLlm(summary);
    expect(llmResult.motorUsado).toBe("ollama");
    expect(llmResult.paragraph).not.toContain("<think>");
    expect(llmResult.paragraph).toContain("Hoy se registra una tarea");

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    );

    const fallbackResult = await generateExecutiveParagraphWithLlm(summary);
    expect(fallbackResult.motorUsado).toBe("determinista");
    expect(fallbackResult.paragraph).toBe(
      buildDeterministicBriefParagraph(summary),
    );
  });

  it("hace fallback a determinista si Ollama devuelve respuesta vacía o error HTTP", async () => {
    const summary: DailyBriefSummaryInput = {
      fechaLarga: "Jueves, 26 de noviembre de 2026",
      contadores: {
        venceHoy: 0,
        vencidas: 2,
        ordenesNuevas: 0,
        agendaDia: 1,
        pendientesVistoBueno: 0,
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const res = await generateExecutiveParagraphWithLlm(summary);
    expect(res.motorUsado).toBe("determinista");
    expect(res.paragraph).toContain("2 tareas vencidas");
  });

  it("formatea el texto limpio del parte diario para ntfy y correo", () => {
    const brief: DailyBrief = {
      dateKey: "2026-11-26",
      fechaLarga: "Jueves, 26 de noviembre de 2026",
      saludo: "Buenos días, Cnel. Carlos Díaz",
      motorUsado: "determinista",
      parrafoEjecutivo: "Para la jornada de hoy se registra 1 tarea vencida.",
      contadores: {
        venceHoy: 0,
        vencidas: 1,
        ordenesNuevas: 0,
        agendaDia: 0,
        pendientesVistoBueno: 0,
      },
      items: {
        venceHoy: [],
        vencidas: [
          {
            id: "t1",
            projectId: "p1",
            projectName: "Logística",
            projectSlug: "LOG",
            number: 7,
            title: "Informe de inventario",
            priority: "high",
            dueDate: new Date("2026-11-25T16:00:00.000Z"),
            isOrder: false,
            orderFolio: null,
            orderClosureStatus: "abierta",
            confidentialityLevel: "publica_interna",
          },
        ],
        ordenesNuevas: [],
        agendaDia: [],
        pendientesVistoBueno: [],
      },
    };

    const text = formatDailyBriefText(brief);
    expect(text).toContain("Buenos días, Cnel. Carlos Díaz");
    expect(text).toContain("Jueves, 26 de noviembre de 2026");
    expect(text).toContain("Vencidas (1)");
    expect(text).toContain("[LOG-7] Informe de inventario");
  });

  it("sendDailyBriefEmailHook retorna smtp_not_configured cuando no hay SMTP", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;

    const result = await sendDailyBriefEmailHook({
      to: "ministro@mppd.dev",
      subject: "Parte diario",
      text: "Resumen del día",
      html: "<p>Resumen del día</p>",
    });

    expect(result).toEqual({
      sent: false,
      reason: "smtp_not_configured",
    });
  });
});

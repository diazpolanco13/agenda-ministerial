import { describe, expect, it } from "vite-plus/test";
import { obtenerDiscursoEjemplo } from "./ejemplo";
import { extraerOrdenesPorReglas } from "./extractor-reglas";
import { normalizarTranscripcion } from "./transcript-parser";

const FECHA_BASE = new Date("2026-11-12T10:00:00-04:00");

describe("extraerOrdenesPorReglas", () => {
  it("extrae las 5 órdenes del discurso institucional de ejemplo con grados, componentes y plazos", () => {
    const ejemplo = obtenerDiscursoEjemplo(FECHA_BASE);
    const ordenes = extraerOrdenesPorReglas(ejemplo.texto, FECHA_BASE);

    expect(ordenes).toHaveLength(5);

    expect(ordenes[0]).toMatchObject({
      pistas: {
        grado: "General de Brigada",
        componente: "EJB",
        apellido: "Rodríguez",
      },
      plazo: "2026-11-12",
      prioridad: "urgent",
    });

    expect(ordenes[1]).toMatchObject({
      pistas: {
        grado: "Contralmirante",
        componente: "ARB",
        apellido: "González",
      },
      plazo: "2026-11-13",
    });

    expect(ordenes[2]).toMatchObject({
      pistas: {
        grado: "Coronel",
        componente: "AMB",
        apellido: "Hernández",
      },
      plazo: "2026-11-27",
    });

    expect(ordenes[3]).toMatchObject({
      pistas: {
        grado: "General de División",
        componente: "GNB",
        apellido: "Martínez",
      },
      plazo: "2026-11-30",
    });

    expect(ordenes[4]).toMatchObject({
      pistas: {
        grado: "Teniente Coronel",
        componente: "MIL",
        apellido: "Castillo",
      },
      plazo: "2026-11-17",
    });
  });

  it("omite saludos o comentarios sin verbos de instrucción", () => {
    const texto = [
      "Buenos días a todos los presentes en esta sala.",
      "Agradecemos el esfuerzo sostenido durante el último trimestre.",
      "Encárguese el Mayor Pérez del Ejército de revisar las comunicaciones en 48 horas.",
    ].join(" ");

    const ordenes = extraerOrdenesPorReglas(texto, FECHA_BASE);
    expect(ordenes).toHaveLength(1);
    expect(ordenes[0]?.pistas).toMatchObject({
      grado: "Mayor",
      componente: "EJB",
      apellido: "Pérez",
    });
    expect(ordenes[0]?.plazo).toBe("2026-11-14");
  });

  it("normaliza transcripciones VTT y JSON de Plaud antes de extraer órdenes", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:05.000
<v Ministro>Instruyo al Coronel Rojas de la Aviación que prepare el informe para mañana.</v>`;

    const normVtt = normalizarTranscripcion(vtt, "vtt");
    expect(normVtt.texto).not.toContain("WEBVTT");
    expect(normVtt.texto).not.toContain("00:00:01.000");
    const ordenesVtt = extraerOrdenesPorReglas(normVtt.texto, FECHA_BASE);
    expect(ordenesVtt).toHaveLength(1);
    expect(ordenesVtt[0]?.plazo).toBe("2026-11-13");

    const plaudJson = JSON.stringify({
      title: "Minuta Estado Mayor",
      utterances: [
        {
          speaker: "Ministro",
          text: "El Vicealmirante Salazar de la Armada debe remitir la matriz logística en 5 días.",
        },
      ],
    });

    const normJson = normalizarTranscripcion(plaudJson, "json");
    expect(normJson.tituloSugerido).toBe("Minuta Estado Mayor");
    const ordenesJson = extraerOrdenesPorReglas(normJson.texto, FECHA_BASE);
    expect(ordenesJson).toHaveLength(1);
    expect(ordenesJson[0]?.pistas.componente).toBe("ARB");
    expect(ordenesJson[0]?.plazo).toBe("2026-11-17");
  });
});

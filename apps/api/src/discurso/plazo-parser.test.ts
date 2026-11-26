import { describe, expect, it } from "vite-plus/test";
import { parsePlazoEspanol } from "./plazo-parser";

// Jueves 12 de noviembre de 2026, 10:00 AM en America/Caracas (UTC-4)
const FECHA_BASE = new Date("2026-11-12T10:00:00-04:00");

describe("parsePlazoEspanol", () => {
  it("maneja zona horaria America/Caracas cerca de medianoche UTC", () => {
    // 2026-11-13 02:30 UTC corresponde al 2026-11-12 22:30 en Caracas
    const nocheCaracas = new Date("2026-11-13T02:30:00Z");
    const res = parsePlazoEspanol("Entregar hoy mismo", nocheCaracas);
    expect(res.fechaIso).toBe("2026-11-12");
    expect(res.prioridadSugerida).toBe("urgent");
  });

  it("interpreta 'de inmediato' y 'urgente'", () => {
    const inmediato = parsePlazoEspanol(
      "Verificar de inmediato el parque",
      FECHA_BASE,
    );
    expect(inmediato.fechaIso).toBe("2026-11-12");
    expect(inmediato.textoDetectado?.toLowerCase()).toBe("de inmediato");
    expect(inmediato.prioridadSugerida).toBe("urgent");

    const urgente = parsePlazoEspanol("Remitir informe urgente", FECHA_BASE);
    expect(urgente.fechaIso).toBe("2026-11-12");
    expect(urgente.prioridadSugerida).toBe("urgent");
  });

  it("interpreta 'hoy', 'mañana' y 'pasado mañana'", () => {
    expect(parsePlazoEspanol("Presentar hoy", FECHA_BASE).fechaIso).toBe(
      "2026-11-12",
    );
    expect(parsePlazoEspanol("Entregar mañana", FECHA_BASE).fechaIso).toBe(
      "2026-11-13",
    );
    expect(
      parsePlazoEspanol("Revisar pasado mañana", FECHA_BASE).fechaIso,
    ).toBe("2026-11-14");
  });

  it("interpreta 'en N días', 'en N días hábiles', 'en N semanas' y horas", () => {
    expect(
      parsePlazoEspanol("Entregar reporte en 15 días", FECHA_BASE).fechaIso,
    ).toBe("2026-11-27");
    expect(
      parsePlazoEspanol("En 2 semanas deben presentar", FECHA_BASE).fechaIso,
    ).toBe("2026-11-26");

    // Desde jueves 12 nov: 3 días hábiles -> vie 13 (1), lun 16 (2), mar 17 (3)
    expect(
      parsePlazoEspanol("Responder en 3 días hábiles", FECHA_BASE).fechaIso,
    ).toBe("2026-11-17");

    expect(parsePlazoEspanol("Informar en 24 horas", FECHA_BASE)).toMatchObject(
      {
        fechaIso: "2026-11-13",
        prioridadSugerida: "urgent",
      },
    );
    expect(parsePlazoEspanol("Informar en 48 horas", FECHA_BASE)).toMatchObject(
      {
        fechaIso: "2026-11-14",
        prioridadSugerida: "high",
      },
    );
    expect(parsePlazoEspanol("Informar en 72 horas", FECHA_BASE)).toMatchObject(
      {
        fechaIso: "2026-11-15",
        prioridadSugerida: "high",
      },
    );
  });

  it("interpreta días de la semana como 'para el viernes' y 'el próximo martes'", () => {
    // Jueves 12 -> viernes 13
    expect(
      parsePlazoEspanol("Presentar plan para el viernes", FECHA_BASE).fechaIso,
    ).toBe("2026-11-13");
    // Jueves 12 -> próximo martes 17
    expect(
      parsePlazoEspanol("Entregar el próximo martes", FECHA_BASE).fechaIso,
    ).toBe("2026-11-17");
    // Mismo día ("para el jueves" en jueves 12) -> siguiente jueves 19
    expect(
      parsePlazoEspanol("Para el jueves siguiente", FECHA_BASE).fechaIso,
    ).toBe("2026-11-19");
    expect(parsePlazoEspanol("El domingo", FECHA_BASE).fechaIso).toBe(
      "2026-11-15",
    );
  });

  it("interpreta 'antes de fin de mes', 'fin de mes' y 'a mediados de mes'", () => {
    expect(
      parsePlazoEspanol("Garantizar despliegue antes de fin de mes", FECHA_BASE)
        .fechaIso,
    ).toBe("2026-11-30");
    expect(parsePlazoEspanol("Para fin de mes", FECHA_BASE).fechaIso).toBe(
      "2026-11-30",
    );
    expect(parsePlazoEspanol("A mediados de mes", FECHA_BASE).fechaIso).toBe(
      "2026-11-15",
    );

    const despuesDelQuince = new Date("2026-11-20T10:00:00-04:00");
    expect(
      parsePlazoEspanol("A mediados de mes", despuesDelQuince).fechaIso,
    ).toBe("2026-12-15");
  });

  it("interpreta formatos explícitos DD de MES, DD/MM/YYYY y YYYY-MM-DD", () => {
    expect(
      parsePlazoEspanol("Para el 25 de noviembre", FECHA_BASE).fechaIso,
    ).toBe("2026-11-25");
    expect(parsePlazoEspanol("Para el 10 de enero", FECHA_BASE).fechaIso).toBe(
      "2027-01-10",
    );
    expect(
      parsePlazoEspanol("Entregar el 05/12/2026", FECHA_BASE).fechaIso,
    ).toBe("2026-12-05");
    expect(
      parsePlazoEspanol("Fecha límite 2026-12-18", FECHA_BASE).fechaIso,
    ).toBe("2026-12-18");
  });

  it("retorna null cuando no detecta plazo", () => {
    expect(
      parsePlazoEspanol(
        "Coordinar con todas las unidades operativas",
        FECHA_BASE,
      ),
    ).toEqual({
      fechaIso: null,
      textoDetectado: null,
    });
  });
});

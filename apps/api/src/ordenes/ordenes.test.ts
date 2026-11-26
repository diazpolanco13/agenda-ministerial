import { describe, expect, it, vi } from "vite-plus/test";
import {
  allocateOrderFolio,
  computeOrderSealHash,
  formatOrderFolio,
  getCaracasYear,
} from "./folio";
import { computeOrderAvancePct, computeOrderSemaforo } from "./index";

describe("ordenes/folio", () => {
  it("formatea folios institucionales ORD-YYYY-NNNN", () => {
    expect(formatOrderFolio(2026, 1)).toBe("ORD-2026-0001");
    expect(formatOrderFolio(2026, 42)).toBe("ORD-2026-0042");
    expect(formatOrderFolio(2026, 12345)).toBe("ORD-2026-12345");
  });

  it("resuelve el año calendario en America/Caracas (UTC-4)", () => {
    // 2026-01-01T03:30:00Z corresponde a 2025-12-31 23:30 en Caracas
    expect(getCaracasYear(new Date("2026-01-01T03:30:00Z"))).toBe(2025);
    // 2026-01-01T04:00:00Z corresponde a 2026-01-01 00:00 en Caracas
    expect(getCaracasYear(new Date("2026-01-01T04:00:00Z"))).toBe(2026);
  });

  it("asigna folio secuencial atómico usando el contador por workspace y año", async () => {
    const returning = vi.fn().mockResolvedValue([{ lastSeq: 7 }]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });

    const folio = await allocateOrderFolio("ws-ministerio", 2026, {
      insert,
    } as never);

    expect(folio).toBe("ORD-2026-0007");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-ministerio",
        year: 2026,
        lastSeq: 1,
      }),
    );
  });

  it("calcula sello SHA-256 determinista independientemente del orden de claves o undefined vs null", () => {
    const h1 = computeOrderSealHash({
      folio: "ORD-2026-0001",
      taskId: "task-123",
      action: "visto_bueno",
      actorUserId: "user-1",
      timestampIso: "2026-11-26T12:00:00.000Z",
      evidenceText: "Informe entregado",
      evidenceAssetId: undefined,
      comment: null,
    });

    const h2 = computeOrderSealHash({
      comment: undefined,
      timestampIso: "2026-11-26T12:00:00.000Z",
      actorUserId: "user-1",
      taskId: "task-123",
      action: "visto_bueno",
      evidenceAssetId: null,
      folio: "ORD-2026-0001",
      evidenceText: "Informe entregado",
    });

    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);

    const hModified = computeOrderSealHash({
      folio: "ORD-2026-0001",
      taskId: "task-123",
      action: "devolver",
      actorUserId: "user-1",
      timestampIso: "2026-11-26T12:00:00.000Z",
      evidenceText: "Informe entregado",
      evidenceAssetId: null,
      comment: "Falta anexo",
    });

    expect(hModified).not.toBe(h1);
  });
});

describe("ordenes/semaforo y avance", () => {
  const now = new Date("2026-11-26T12:00:00.000Z");

  it("calcula semáforo correctamente según estado, columna final y vencimiento", () => {
    expect(
      computeOrderSemaforo({
        dueDate: new Date("2026-11-20T12:00:00.000Z"),
        isFinalColumn: true,
        orderClosureStatus: "abierta",
        now,
      }),
    ).toBe("completada");

    expect(
      computeOrderSemaforo({
        dueDate: new Date("2026-11-20T12:00:00.000Z"),
        isFinalColumn: false,
        orderClosureStatus: "aprobada",
        now,
      }),
    ).toBe("completada");

    expect(
      computeOrderSemaforo({
        dueDate: null,
        isFinalColumn: false,
        orderClosureStatus: "abierta",
        now,
      }),
    ).toBe("verde");

    expect(
      computeOrderSemaforo({
        dueDate: new Date("2026-11-26T11:59:59.000Z"),
        isFinalColumn: false,
        orderClosureStatus: "abierta",
        now,
      }),
    ).toBe("rojo");

    expect(
      computeOrderSemaforo({
        dueDate: new Date("2026-11-28T12:00:00.000Z"), // +48h exacto
        isFinalColumn: false,
        orderClosureStatus: "en_revision",
        now,
      }),
    ).toBe("amarillo");

    expect(
      computeOrderSemaforo({
        dueDate: new Date("2026-11-28T12:00:01.000Z"), // > 48h
        isFinalColumn: false,
        orderClosureStatus: "abierta",
        now,
      }),
    ).toBe("verde");
  });

  it("calcula avancePct basado en subtareas si existen o según estado de cierre", () => {
    expect(
      computeOrderAvancePct({
        subtaskCounts: { completed: 2, total: 4 },
        orderClosureStatus: "abierta",
      }),
    ).toBe(50);

    expect(
      computeOrderAvancePct({
        subtaskCounts: { completed: 0, total: 0 },
        orderClosureStatus: "abierta",
      }),
    ).toBe(20);

    expect(
      computeOrderAvancePct({
        subtaskCounts: { completed: 0, total: 0 },
        orderClosureStatus: "devuelta",
      }),
    ).toBe(40);

    expect(
      computeOrderAvancePct({
        subtaskCounts: { completed: 0, total: 0 },
        orderClosureStatus: "en_revision",
      }),
    ).toBe(80);

    expect(
      computeOrderAvancePct({
        subtaskCounts: { completed: 0, total: 0 },
        orderClosureStatus: "aprobada",
      }),
    ).toBe(100);
  });
});

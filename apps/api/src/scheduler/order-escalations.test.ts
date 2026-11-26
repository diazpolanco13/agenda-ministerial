import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const sentKeys = new Set<string>();
  const selectResults: unknown[] = [];
  const persistNotification = vi.fn();
  const dispatchNotification = vi.fn();

  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    const nextResult = () => selectResults.shift() ?? [];
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve(nextResult()));
    return chain;
  };

  const makeTx = () => ({
    insert: vi.fn(() => ({
      values: vi.fn((vals: { taskId: string; level: string; recipientUserId: string }) => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => {
            const key = `${vals.taskId}::${vals.level}::${vals.recipientUserId}`;
            if (sentKeys.has(key)) {
              return [];
            }
            sentKeys.add(key);
            return [{ id: `esc-${key}`, ...vals }];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  });

  const db = {
    select: vi.fn(() => makeSelectChain()),
    transaction: vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => unknown) =>
      cb(makeTx()),
    ),
  };

  return {
    sentKeys,
    selectResults,
    persistNotification,
    dispatchNotification,
    db,
  };
});

vi.mock("../database", () => ({
  default: mocks.db,
}));

vi.mock("../notification/controllers/create-notification", () => ({
  persistNotification: mocks.persistNotification,
  dispatchNotification: mocks.dispatchNotification,
}));

import {
  checkOrderEscalations,
  classifyEscalationLevel,
  getApplicableEscalationLevels,
} from "./order-escalations";

describe("scheduler/order-escalations", () => {
  beforeEach(() => {
    mocks.sentKeys.clear();
    mocks.selectResults.length = 0;
    mocks.persistNotification.mockReset();
    mocks.dispatchNotification.mockReset();
    mocks.db.select.mockClear();
    mocks.db.transaction.mockClear();
  });

  it("clasifica ventanas T+0 y T+48h correctamente", () => {
    const dueDate = new Date("2026-11-24T12:00:00.000Z");

    // Antes de vencer -> null
    expect(
      classifyEscalationLevel(dueDate, new Date("2026-11-24T11:59:59.000Z")),
    ).toBeNull();
    expect(
      getApplicableEscalationLevels(
        dueDate,
        new Date("2026-11-24T11:59:59.000Z"),
      ),
    ).toEqual([]);

    // Exactamente al vencer (T+0) -> t0_jefe_despacho
    expect(classifyEscalationLevel(dueDate, dueDate)).toBe("t0_jefe_despacho");
    expect(getApplicableEscalationLevels(dueDate, dueDate)).toEqual([
      "t0_jefe_despacho",
    ]);

    // A las 47h 59m -> t0_jefe_despacho
    expect(
      classifyEscalationLevel(dueDate, new Date("2026-11-26T11:59:00.000Z")),
    ).toBe("t0_jefe_despacho");

    // A las 48h exactas -> t48_ministro (y aplica T+0 + T+48h)
    expect(
      classifyEscalationLevel(dueDate, new Date("2026-11-26T12:00:00.000Z")),
    ).toBe("t48_ministro");
    expect(
      getApplicableEscalationLevels(
        dueDate,
        new Date("2026-11-26T12:00:00.000Z"),
      ),
    ).toEqual(["t0_jefe_despacho", "t48_ministro"]);
  });

  it("envía T+0 solo al jefe_despacho y T+48h al ministro sin duplicar en ejecuciones repetidas", async () => {
    const dueT0 = new Date("2026-11-26T10:00:00.000Z");
    const dueT48 = new Date("2026-11-24T10:00:00.000Z");
    const now = new Date("2026-11-26T12:00:00.000Z");

    mocks.persistNotification.mockImplementation(async (input) => ({
      id: `notif-${input.userId}-${input.type}`,
      ...input,
    }));

    // Primera ejecución: 1 orden en T+0 (2h vencida) y 1 orden en T+48h (50h vencida)
    mocks.selectResults.push(
      [
        {
          id: "task-t0",
          title: "Orden reciente vencida",
          dueDate: dueT0,
          orderFolio: "ORD-2026-0001",
          projectId: "proj-1",
          workspaceId: "ws-1",
          assigneeName: "Cnel. Pérez",
        },
        {
          id: "task-t48",
          title: "Orden crítica 50h",
          dueDate: dueT48,
          orderFolio: "ORD-2026-0002",
          projectId: "proj-1",
          workspaceId: "ws-1",
          assigneeName: "G/B Castillo",
        },
      ],
      [
        { workspaceId: "ws-1", userId: "user-jefe", role: "jefe_despacho" },
        { workspaceId: "ws-1", userId: "user-ministro", role: "ministro" },
        { workspaceId: "ws-1", userId: "user-resp", role: "responsable" },
      ],
    );

    const firstRun = await checkOrderEscalations(now);
    expect(firstRun.degraded).toBe(false);
    // task-t0 -> T+0 (jefe), task-t48 -> T+0 (jefe) + T+48h (ministro) = 3 envíos
    expect(firstRun.sentCount).toBe(3);
    expect(mocks.persistNotification).toHaveBeenCalledTimes(3);
    expect(mocks.dispatchNotification).toHaveBeenCalledTimes(3);

    expect(mocks.persistNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-jefe",
        type: "order_escalation_t0",
        resourceId: "task-t0",
      }),
      expect.anything(),
    );
    expect(mocks.persistNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-jefe",
        type: "order_escalation_t0",
        resourceId: "task-t48",
      }),
      expect.anything(),
    );
    expect(mocks.persistNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-ministro",
        type: "order_escalation_t48",
        resourceId: "task-t48",
      }),
      expect.anything(),
    );

    // Segunda ejecución sobre las mismas órdenes: 0 envíos nuevos por onConflictDoNothing
    mocks.selectResults.push(
      [
        {
          id: "task-t0",
          title: "Orden reciente vencida",
          dueDate: dueT0,
          orderFolio: "ORD-2026-0001",
          projectId: "proj-1",
          workspaceId: "ws-1",
          assigneeName: "Cnel. Pérez",
        },
        {
          id: "task-t48",
          title: "Orden crítica 50h",
          dueDate: dueT48,
          orderFolio: "ORD-2026-0002",
          projectId: "proj-1",
          workspaceId: "ws-1",
          assigneeName: "G/B Castillo",
        },
      ],
      [
        { workspaceId: "ws-1", userId: "user-jefe", role: "jefe_despacho" },
        { workspaceId: "ws-1", userId: "user-ministro", role: "ministro" },
      ],
    );

    const secondRun = await checkOrderEscalations(now);
    expect(secondRun).toEqual({ degraded: false, sentCount: 0 });
    expect(mocks.persistNotification).toHaveBeenCalledTimes(3);
    expect(mocks.dispatchNotification).toHaveBeenCalledTimes(3);
  });
});

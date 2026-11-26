import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import db from "../database";
import { workspaceOrderCounterTable } from "../database/schema";

const CARACAS_TIMEZONE = "America/Caracas";

const caracasYearFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CARACAS_TIMEZONE,
  year: "numeric",
});

/**
 * Obtiene el año calendario vigente en la zona horaria America/Caracas.
 */
export function getCaracasYear(date = new Date()): number {
  const formatted = caracasYearFormatter.format(date);
  const parsed = Number.parseInt(formatted, 10);
  return Number.isFinite(parsed) ? parsed : date.getUTCFullYear();
}

/**
 * Formatea un folio institucional de orden con el patrón ORD-YYYY-NNNN.
 */
export function formatOrderFolio(year: number, seq: number): string {
  return `ORD-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Asigna atómicamente el próximo folio secuencial para un espacio de trabajo y año.
 */
export async function allocateOrderFolio(
  workspaceId: string,
  year?: number,
  dbClient: Pick<typeof db, "insert"> = db,
): Promise<string> {
  const resolvedYear = year ?? getCaracasYear();
  const now = new Date();

  const [row] = await dbClient
    .insert(workspaceOrderCounterTable)
    .values({
      workspaceId,
      year: resolvedYear,
      lastSeq: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        workspaceOrderCounterTable.workspaceId,
        workspaceOrderCounterTable.year,
      ],
      set: {
        lastSeq: sql`${workspaceOrderCounterTable.lastSeq} + 1`,
        updatedAt: now,
      },
    })
    .returning({ lastSeq: workspaceOrderCounterTable.lastSeq });

  const seq = row?.lastSeq ?? 1;
  return formatOrderFolio(resolvedYear, seq);
}

export type OrderSealPayload = {
  folio: string | null;
  taskId: string;
  action: string;
  actorUserId: string;
  timestampIso: string;
  evidenceText?: string | null;
  evidenceAssetId?: string | null;
  comment?: string | null;
};

/**
 * Calcula un sello SHA-256 hex determinista sobre un JSON canónico con claves ordenadas.
 */
export function computeOrderSealHash(payload: OrderSealPayload): string {
  const normalized: Record<string, string | null> = {
    action: payload.action,
    actorUserId: payload.actorUserId,
    comment: payload.comment ?? null,
    evidenceAssetId: payload.evidenceAssetId ?? null,
    evidenceText: payload.evidenceText ?? null,
    folio: payload.folio ?? null,
    taskId: payload.taskId,
    timestampIso: payload.timestampIso,
  };

  const ordered: Record<string, string | null> = {};
  for (const key of Object.keys(normalized).sort()) {
    ordered[key] = normalized[key] ?? null;
  }

  const canonicalJson = JSON.stringify(ordered);
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

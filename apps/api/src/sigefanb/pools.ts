import { Pool } from "pg";
import { getSigefanbPgConfig } from "./config";

export type SigefanbPoolEntry = {
  database: string;
  pool: Pool;
};

/** Error lanzado cuando las bases de datos o almacenamiento de SIGEFANB no están disponibles. */
export class SigefanbUnavailableError extends Error {
  constructor(message = "Servicio SIGEFANB temporalmente no disponible") {
    super(message);
    this.name = "SigefanbUnavailableError";
  }
}

let cachedPools: SigefanbPoolEntry[] | null = null;
let cachedKey: string | null = null;

/**
 * Devuelve el listado de pools PostgreSQL configurados para SIGEFANB.
 * Crea los pools bajo demanda con límites conservadores de lectura.
 */
export function getSigefanbPools(): SigefanbPoolEntry[] {
  const config = getSigefanbPgConfig();
  if (!config) {
    throw new SigefanbUnavailableError(
      "Conexión PostgreSQL de SIGEFANB no configurada",
    );
  }

  const nextKey = `${config.host}:${config.port}/${config.user}/${config.databases.join(",")}`;
  if (cachedPools && cachedKey === nextKey) {
    return cachedPools;
  }

  if (cachedPools) {
    void closeSigefanbPools();
  }

  const created = config.databases.map((database) => {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
      statement_timeout: 4500,
      query_timeout: 5000,
    });

    pool.on("error", (error) => {
      console.error(
        `Error en pool SIGEFANB (${database}):`,
        error instanceof Error ? error.message : "Error desconocido",
      );
    });

    return { database, pool };
  });

  cachedPools = created;
  cachedKey = nextKey;
  return created;
}

/** Cierra ordenadamente todos los pools PostgreSQL de SIGEFANB en caché. */
export async function closeSigefanbPools(): Promise<void> {
  const pools = cachedPools;
  cachedPools = null;
  cachedKey = null;
  if (!pools || pools.length === 0) return;

  await Promise.allSettled(pools.map((entry) => entry.pool.end()));
}

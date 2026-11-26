import { HTTPException } from "hono/http-exception";
import {
  deriveComponent,
  type FanbComponentCode,
  formatGrado,
  formatNombreCompleto,
  normalizeCedulaInput,
  rankInsignia,
} from "./military-assets";
import {
  getSigefanbPools,
  type SigefanbPoolEntry,
  SigefanbUnavailableError,
} from "./pools";

export type SigefanbPersonalItem = {
  cedula: string;
  nacionalidad: "V" | "E";
  nombreCompleto: string;
  grado: string;
  componente: FanbComponentCode | null;
  unidad: string | null;
  sexo: string | null;
  insignia: string | null;
  fotoUrl: string;
};

type PersonalQueryRow = {
  cedula: number | string;
  nacionalidad: string | null;
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  sexo: string | null;
  descripcion_cargo: string | null;
  tipo_personal: string | null;
  unidad: string | null;
};

const BASE_PERSONAL_SELECT = `
SELECT DISTINCT ON (p.cedula)
  p.cedula, p.nacionalidad, p.primer_nombre, p.segundo_nombre,
  p.primer_apellido, p.segundo_apellido, p.sexo,
  c.descripcion_cargo, tp.nombre AS tipo_personal, d.nombre AS unidad
FROM public.trabajador t
INNER JOIN public.personal p ON p.id_personal = t.id_personal
LEFT JOIN public.cargo c ON c.id_cargo = t.id_cargo
LEFT JOIN public.tipopersonal tp ON tp.id_tipo_personal = t.id_tipo_personal
LEFT JOIN public.dependencia d ON d.id_dependencia = COALESCE(t.id_dependencia_real, t.id_dependencia)
WHERE t.estatus = 'A'
`;

const MAX_SEARCH_RESULTS = 20;
const MAX_SEARCH_TOKENS = 4;

function databasePriority(databaseName: string): number {
  const lower = databaseName.toLowerCase();
  if (lower.includes("profesionales")) return 0;
  if (lower.includes("cadetes")) return 1;
  if (lower.includes("alistados")) return 2;
  return 3;
}

function sortPoolsByPriority(pools: SigefanbPoolEntry[]): SigefanbPoolEntry[] {
  return [...pools].sort(
    (a, b) => databasePriority(a.database) - databasePriority(b.database),
  );
}

function normalizeSearchToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[\\%_]/g, "\\$&");
}

function mapRowToPersonalItem(row: PersonalQueryRow): SigefanbPersonalItem {
  const cedula = String(row.cedula).trim();
  const rawNac = row.nacionalidad?.trim().toUpperCase();
  const nacionalidad: "V" | "E" = rawNac === "E" ? "E" : "V";
  const unidad = row.unidad?.trim() || null;
  const componente = deriveComponent(row.tipo_personal);
  const grado = formatGrado(row.descripcion_cargo, componente, unidad);
  const nombreCompleto = formatNombreCompleto([
    row.primer_nombre,
    row.segundo_nombre,
    row.primer_apellido,
    row.segundo_apellido,
  ]);
  const sexo = row.sexo?.trim() || null;
  const insignia =
    rankInsignia(row.descripcion_cargo, componente, unidad)?.src ?? null;

  return {
    cedula,
    nacionalidad,
    nombreCompleto,
    grado,
    componente,
    unidad,
    sexo,
    insignia,
    fotoUrl: `/api/sigefanb/foto/${cedula}`,
  };
}

async function queryPoolsInParallel(
  sql: string,
  params: unknown[],
): Promise<{ entry: SigefanbPoolEntry; rows: PersonalQueryRow[] }[]> {
  const orderedPools = sortPoolsByPriority(getSigefanbPools());
  const settled = await Promise.allSettled(
    orderedPools.map(async (entry) => {
      const result = await entry.pool.query<PersonalQueryRow>(sql, params);
      return { entry, rows: result.rows };
    }),
  );

  const fulfilled: { entry: SigefanbPoolEntry; rows: PersonalQueryRow[] }[] =
    [];
  let rejectedCount = 0;

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const poolEntry = orderedPools[i];
    if (outcome?.status === "fulfilled") {
      fulfilled.push(outcome.value);
    } else if (outcome?.status === "rejected") {
      rejectedCount += 1;
      console.error(
        `Error consultando base SIGEFANB (${poolEntry?.database ?? "desconocida"}):`,
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Error desconocido",
      );
    }
  }

  if (rejectedCount === orderedPools.length) {
    throw new SigefanbUnavailableError(
      "No fue posible consultar ninguna base de datos de SIGEFANB",
    );
  }

  return fulfilled;
}

/**
 * Busca personal activo en las bases de SIGEFANB por cédula o por nombre/apellido.
 * Deduplica por cédula respetando la prioridad profesionales > cadetes > alistados.
 */
export async function buscarPersonal(
  q: string,
): Promise<SigefanbPersonalItem[]> {
  const trimmed = q.trim();
  if (trimmed.length < 3) {
    throw new HTTPException(400, {
      message: "El término de búsqueda debe tener al menos 3 caracteres",
    });
  }

  const cedula = normalizeCedulaInput(trimmed);
  let sql: string;
  let params: unknown[];

  if (cedula !== null) {
    sql = `${BASE_PERSONAL_SELECT}
  AND p.cedula = $1::int
ORDER BY p.cedula ASC
LIMIT ${MAX_SEARCH_RESULTS}`;
    params = [Number.parseInt(cedula, 10)];
  } else {
    const tokens = trimmed
      .split(/\s+/)
      .map(normalizeSearchToken)
      .filter(Boolean)
      .slice(0, MAX_SEARCH_TOKENS);

    if (tokens.length === 0) {
      throw new HTTPException(400, {
        message: "El término de búsqueda no es válido",
      });
    }

    const tokenClauses = tokens.map(
      (_token, index) =>
        `  AND translate(upper(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE $${index + 1} ESCAPE '\\'`,
    );

    sql = `${BASE_PERSONAL_SELECT}
${tokenClauses.join("\n")}
ORDER BY p.cedula ASC
LIMIT ${MAX_SEARCH_RESULTS}`;
    params = tokens.map((token) => `%${token}%`);
  }

  const results = await queryPoolsInParallel(sql, params);
  const byCedula = new Map<string, SigefanbPersonalItem>();

  for (const { rows } of results) {
    for (const row of rows) {
      const item = mapRowToPersonalItem(row);
      if (!byCedula.has(item.cedula)) {
        byCedula.set(item.cedula, item);
        if (byCedula.size >= MAX_SEARCH_RESULTS) {
          return Array.from(byCedula.values());
        }
      }
    }
  }

  return Array.from(byCedula.values());
}

/**
 * Obtiene el registro activo de una persona por cédula desde SIGEFANB.
 * Retorna `null` si no se encuentra activa en ninguna base.
 */
export async function obtenerPersonalPorCedula(
  cedula: string,
): Promise<SigefanbPersonalItem | null> {
  const normalized = normalizeCedulaInput(cedula);
  if (normalized === null) {
    throw new HTTPException(400, { message: "Cédula inválida" });
  }

  const sql = `${BASE_PERSONAL_SELECT}
  AND p.cedula = $1::int
ORDER BY p.cedula ASC
LIMIT 1`;
  const results = await queryPoolsInParallel(sql, [
    Number.parseInt(normalized, 10),
  ]);

  for (const { rows } of results) {
    const first = rows[0];
    if (first) {
      return mapRowToPersonalItem(first);
    }
  }

  return null;
}

const DEFAULT_PG_PORT = 5432;
const DEFAULT_PG_DATABASES = [
  "sigefirrhh_profesionales",
  "sigefirrhh_alistados",
  "sigefirrhh_cadetes",
] as const;
const DEFAULT_S3_REGION = "us-east-1";

export type SigefanbPgConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  databases: string[];
};

export type SigefanbFotosS3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
}

function parseDatabases(raw: string | undefined): string[] {
  const source = raw?.trim();
  if (!source) return [...DEFAULT_PG_DATABASES];
  return source
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Lee la configuración PostgreSQL de SIGEFANB desde variables de entorno.
 * Retorna `null` si faltan parámetros obligatorios de conexión.
 */
export function getSigefanbPgConfig(): SigefanbPgConfig | null {
  const host = process.env.SIGEFANB_PG_HOST?.trim() ?? "";
  const user = process.env.SIGEFANB_PG_USER?.trim() ?? "";
  const password = process.env.SIGEFANB_PG_PASSWORD ?? "";
  const databases = parseDatabases(process.env.SIGEFANB_PG_DATABASES);

  if (!host || !user || !password || databases.length === 0) {
    return null;
  }

  return {
    host,
    port: parsePort(process.env.SIGEFANB_PG_PORT, DEFAULT_PG_PORT),
    user,
    password,
    databases,
  };
}

/**
 * Lee la configuración S3/RustFS de fotos SIGEFANB desde variables de entorno.
 * Retorna `null` si faltan parámetros obligatorios.
 */
export function getSigefanbFotosS3Config(): SigefanbFotosS3Config | null {
  const endpoint = process.env.SIGEFANB_FOTOS_S3_ENDPOINT?.trim() ?? "";
  const bucket = process.env.SIGEFANB_FOTOS_S3_BUCKET?.trim() ?? "";
  const accessKeyId = process.env.SIGEFANB_FOTOS_S3_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.SIGEFANB_FOTOS_S3_SECRET_ACCESS_KEY ?? "";
  const region =
    process.env.SIGEFANB_FOTOS_S3_REGION?.trim() || DEFAULT_S3_REGION;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
  };
}

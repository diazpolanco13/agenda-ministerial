import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSigefanbFotosS3Config, type SigefanbFotosS3Config } from "./config";
import { normalizeCedulaInput } from "./military-assets";
import { SigefanbUnavailableError } from "./pools";

export type SigefanbFotoResult = {
  body: Uint8Array;
  contentType: string;
  etag: string | null;
  contentLength: number;
};

const REQUEST_TIMEOUT_MS = 4000;
const LRU_MAX_ENTRIES = 2000;
const FOUND_TTL_MS = 6 * 60 * 60 * 1000;
const MISSING_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  key: string | null;
  expiresAt: number;
};

const fotoKeyCache = new Map<string, CacheEntry>();

let cachedS3Client: { signature: string; client: S3Client } | null = null;
let cachedAuditoriaPrefixes: {
  signature: string;
  prefixes: string[];
  expiresAt: number;
} | null = null;
let inFlightAuditoriaPrefixes: Promise<string[]> | null = null;

function configSignature(config: SigefanbFotosS3Config): string {
  return `${config.endpoint}|${config.region}|${config.bucket}|${config.accessKeyId}`;
}

function getS3Client(config: SigefanbFotosS3Config): S3Client {
  const signature = configSignature(config);
  if (cachedS3Client?.signature === signature) {
    return cachedS3Client.client;
  }

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  cachedS3Client = { signature, client };
  cachedAuditoriaPrefixes = null;
  fotoKeyCache.clear();
  return client;
}

function getCachedKey(cacheKey: string): string | null | undefined {
  const entry = fotoKeyCache.get(cacheKey);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    fotoKeyCache.delete(cacheKey);
    return undefined;
  }
  // Renueva posición LRU
  fotoKeyCache.delete(cacheKey);
  fotoKeyCache.set(cacheKey, entry);
  return entry.key;
}

function setCachedKey(cacheKey: string, key: string | null): void {
  if (fotoKeyCache.has(cacheKey)) {
    fotoKeyCache.delete(cacheKey);
  } else if (fotoKeyCache.size >= LRU_MAX_ENTRIES) {
    const oldestKey = fotoKeyCache.keys().next().value;
    if (oldestKey !== undefined) {
      fotoKeyCache.delete(oldestKey);
    }
  }

  fotoKeyCache.set(cacheKey, {
    key,
    expiresAt: Date.now() + (key !== null ? FOUND_TTL_MS : MISSING_TTL_MS),
  });
}

function isS3NotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    err.name === "NoSuchKey" ||
    err.Code === "NoSuchKey" ||
    err.name === "NotFound" ||
    err.$metadata?.httpStatusCode === 404
  );
}

function toSigefanbUnavailableError(
  context: string,
  error: unknown,
): SigefanbUnavailableError {
  const detail = error instanceof Error ? error.message : "Error desconocido";
  console.error(`Error S3 SIGEFANB (${context}):`, detail);
  return new SigefanbUnavailableError(
    "Servicio de fotos SIGEFANB temporalmente no disponible",
  );
}

async function listFirstKey(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<string | null> {
  try {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 5,
      }),
      { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );

    const items = (response.Contents ?? []).filter(
      (item) =>
        typeof item.Key === "string" &&
        !item.Key.endsWith("/") &&
        (item.Size === undefined || item.Size > 0),
    );
    return items[0]?.Key ?? null;
  } catch (error) {
    throw toSigefanbUnavailableError(`list ${prefix}`, error);
  }
}

async function getAuditoriaComponentPrefixes(
  client: S3Client,
  config: SigefanbFotosS3Config,
): Promise<string[]> {
  const signature = configSignature(config);
  const now = Date.now();
  if (
    cachedAuditoriaPrefixes &&
    cachedAuditoriaPrefixes.signature === signature &&
    now <= cachedAuditoriaPrefixes.expiresAt
  ) {
    return cachedAuditoriaPrefixes.prefixes;
  }

  if (inFlightAuditoriaPrefixes) {
    return inFlightAuditoriaPrefixes;
  }

  inFlightAuditoriaPrefixes = (async () => {
    try {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: "fondo-blanco/auditoria-militar/",
          Delimiter: "/",
        }),
        { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );

      const prefixes = (response.CommonPrefixes ?? [])
        .map((cp) => cp.Prefix)
        .filter((prefix): prefix is string => Boolean(prefix));

      cachedAuditoriaPrefixes = {
        signature,
        prefixes,
        expiresAt: Date.now() + FOUND_TTL_MS,
      };
      return prefixes;
    } catch (error) {
      throw toSigefanbUnavailableError("list auditoria-militar", error);
    } finally {
      inFlightAuditoriaPrefixes = null;
    }
  })();

  return inFlightAuditoriaPrefixes;
}

async function resolveFotoKey(
  client: S3Client,
  config: SigefanbFotosS3Config,
  cedula: string,
): Promise<string | null> {
  // 1. IPSFA
  const ipsfaKey = await listFirstKey(
    client,
    config.bucket,
    `fondo-blanco/nexus-iris-ipsfa/military/${cedula}/foto_`,
  );
  if (ipsfaKey) return ipsfaKey;

  // 2. Manuales
  const manualKey = await listFirstKey(
    client,
    config.bucket,
    `fondo-blanco/manuales/${cedula}-`,
  );
  if (manualKey) return manualKey;

  // 3. Auditoría militar (subprefijos por componente en paralelo)
  const componentPrefixes = await getAuditoriaComponentPrefixes(client, config);
  if (componentPrefixes.length > 0) {
    const auditoriaMatches = await Promise.all(
      componentPrefixes.map((prefix) =>
        listFirstKey(client, config.bucket, `${prefix}${cedula}-`),
      ),
    );
    const auditoriaKey = auditoriaMatches.find((k) => k !== null);
    if (auditoriaKey) return auditoriaKey;
  }

  // 4. SAIME (V- y E-)
  const [saimeV, saimeE] = await Promise.all([
    listFirstKey(
      client,
      config.bucket,
      `fondo-blanco/nexus-iris-saime/person/V-${cedula}/`,
    ),
    listFirstKey(
      client,
      config.bucket,
      `fondo-blanco/nexus-iris-saime/person/E-${cedula}/`,
    ),
  ]);
  return saimeV ?? saimeE ?? null;
}

function inferImageContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function fetchObjectByKey(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<SigefanbFotoResult | null> {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );

    const body = response.Body
      ? await response.Body.transformToByteArray()
      : new Uint8Array();
    const rawType = response.ContentType?.split(";")[0]?.trim().toLowerCase();
    const contentType =
      rawType && rawType !== "application/octet-stream"
        ? rawType
        : inferImageContentType(key);

    return {
      body,
      contentType,
      etag: response.ETag ?? null,
      contentLength: response.ContentLength ?? body.byteLength,
    };
  } catch (error) {
    if (isS3NotFoundError(error)) {
      return null;
    }
    throw toSigefanbUnavailableError(`get ${key}`, error);
  }
}

/**
 * Obtiene la fotografía de un militar/persona desde RustFS SIGEFANB según el orden de fuentes.
 * Retorna `null` si no existe fotografía; lanza `SigefanbUnavailableError` ante fallos de red/auth/timeout.
 */
export async function obtenerFotoSigefanb(
  cedula: string,
): Promise<SigefanbFotoResult | null> {
  const normalized = normalizeCedulaInput(cedula);
  if (!normalized) return null;

  const config = getSigefanbFotosS3Config();
  if (!config) {
    throw new SigefanbUnavailableError(
      "Almacenamiento de fotos SIGEFANB no configurado",
    );
  }

  const client = getS3Client(config);
  const cacheKey = `${configSignature(config)}:${normalized}`;
  let resolvedKey = getCachedKey(cacheKey);

  if (resolvedKey === undefined) {
    resolvedKey = await resolveFotoKey(client, config, normalized);
    setCachedKey(cacheKey, resolvedKey);
  }

  if (resolvedKey === null) {
    return null;
  }

  const fetched = await fetchObjectByKey(client, config.bucket, resolvedKey);
  if (fetched) {
    return fetched;
  }

  // Si el objeto fue removido desde que se cacheó su clave, re-resuelve una vez.
  fotoKeyCache.delete(cacheKey);
  const freshKey = await resolveFotoKey(client, config, normalized);
  setCachedKey(cacheKey, freshKey);
  if (!freshKey) return null;

  return fetchObjectByKey(client, config.bucket, freshKey);
}

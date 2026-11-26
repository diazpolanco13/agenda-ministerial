import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { HTTPException } from "hono/http-exception";

const execFileAsync = promisify(execFile);

const PLAUD_TIMEOUT_MS = 15_000;
const PLAUD_ID_REGEX = /^[a-zA-Z0-9_-]{3,80}$/;
const INSTRUCCIONES_CONEXION = ["npm i -g @plaud-ai/cli", "plaud login"];

export type PlaudEstado = {
  conectado: boolean;
  tieneTokens: boolean;
  cliInstalada: boolean;
  rutaTokens: string;
  mensaje: string;
  instrucciones: string[];
};

export type PlaudGrabacion = {
  id: string;
  titulo: string;
  fecha: string | null;
  duracionSegundos: number | null;
  resumenDisponible: boolean;
};

export type PlaudExecResult = {
  stdout: string;
  stderr: string;
};

export type PlaudCommandRunner = (
  file: string,
  args: string[],
  timeoutMs: number,
) => Promise<PlaudExecResult>;

export type PlaudFileExistsFn = (filePath: string) => Promise<boolean>;

export type PlaudAdapterDeps = {
  runner?: PlaudCommandRunner;
  fileExists?: PlaudFileExistsFn;
  tokensPath?: string;
};

const defaultRunner: PlaudCommandRunner = async (file, args, timeoutMs) => {
  const result = await execFileAsync(file, args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const defaultFileExists: PlaudFileExistsFn = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export function resolvePlaudTokensPath(override?: string): string {
  if (override?.trim()) return override.trim();
  if (process.env.PLAUD_TOKENS_PATH?.trim()) {
    return process.env.PLAUD_TOKENS_PATH.trim();
  }
  return path.join(os.homedir(), ".plaud", "tokens.json");
}

export function validatePlaudId(id: string): string {
  const trimmed = id.trim();
  if (!PLAUD_ID_REGEX.test(trimmed)) {
    throw new HTTPException(400, {
      message: "Identificador de grabación Plaud inválido.",
    });
  }
  return trimmed;
}

function parseGrabacionesOutput(raw: string): PlaudGrabacion[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? ((parsed as Record<string, unknown>).recordings ??
            (parsed as Record<string, unknown>).items ??
            (parsed as Record<string, unknown>).data ??
            [])
          : [];

      if (Array.isArray(list)) {
        return list
          .map((entry): PlaudGrabacion | null => {
            if (!entry || typeof entry !== "object") return null;
            const rec = entry as Record<string, unknown>;
            const rawId = rec.id ?? rec.file_id ?? rec.recording_id;
            if (typeof rawId !== "string" && typeof rawId !== "number") {
              return null;
            }
            const id = String(rawId).trim();
            if (!PLAUD_ID_REGEX.test(id)) return null;

            const titulo = String(
              rec.title ?? rec.filename ?? rec.name ?? `Grabación ${id}`,
            ).trim();
            const rawFecha = rec.date ?? rec.created_at ?? rec.start_time;
            const rawDuration = rec.duration ?? rec.duration_seconds;

            return {
              id,
              titulo,
              fecha: typeof rawFecha === "string" ? rawFecha : null,
              duracionSegundos:
                typeof rawDuration === "number" && Number.isFinite(rawDuration)
                  ? rawDuration
                  : null,
              resumenDisponible: Boolean(rec.has_summary ?? rec.summary),
            };
          })
          .filter((item): item is PlaudGrabacion => item !== null);
      }
    } catch {
      // Continuar con parseo por líneas de texto.
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: PlaudGrabacion[] = [];
  for (const line of lines) {
    const match = line.match(
      /^([a-zA-Z0-9_-]{3,80})(?:\s*\|\s*|\s{2,}|\t)(.+)$/,
    );
    if (!match?.[1] || !match[2]) continue;
    const id = match[1].trim();
    const rest = match[2].split(/\s*\|\s*/);
    items.push({
      id,
      titulo: (rest[0] ?? `Grabación ${id}`).trim(),
      fecha: rest[1]?.trim() || null,
      duracionSegundos: null,
      resumenDisponible: true,
    });
  }

  return items;
}

export function createPlaudAdapter(deps: PlaudAdapterDeps = {}) {
  const runner = deps.runner ?? defaultRunner;
  const fileExists = deps.fileExists ?? defaultFileExists;
  const tokensPath = resolvePlaudTokensPath(deps.tokensPath);

  async function obtenerEstado(): Promise<PlaudEstado> {
    const tieneTokens = await fileExists(tokensPath);

    let cliInstalada = false;
    try {
      await runner("plaud", ["--version"], 5000);
      cliInstalada = true;
    } catch {
      cliInstalada = false;
    }

    const conectado = tieneTokens && cliInstalada;

    let mensaje = "Plaud conectado y listo para importar grabaciones.";
    if (!cliInstalada && !tieneTokens) {
      mensaje =
        "La CLI de Plaud no está instalada y no se encontraron credenciales locales.";
    } else if (!cliInstalada) {
      mensaje =
        "La CLI de Plaud (@plaud-ai/cli) no está instalada en el equipo.";
    } else if (!tieneTokens) {
      mensaje =
        "Falta iniciar sesión en Plaud CLI para generar las credenciales locales.";
    }

    return {
      conectado,
      tieneTokens,
      cliInstalada,
      rutaTokens: tokensPath,
      mensaje,
      instrucciones: INSTRUCCIONES_CONEXION,
    };
  }

  async function listarGrabaciones(days = 14): Promise<PlaudGrabacion[]> {
    const safeDays = Math.min(90, Math.max(1, Math.trunc(days)));
    const estado = await obtenerEstado();
    if (!estado.conectado) {
      throw new HTTPException(400, {
        message: `${estado.mensaje} Ejecuta: ${INSTRUCCIONES_CONEXION.join(" && ")}`,
      });
    }

    try {
      const res = await runner(
        "plaud",
        ["recent", "--days", String(safeDays), "--json"],
        PLAUD_TIMEOUT_MS,
      );
      return parseGrabacionesOutput(res.stdout);
    } catch {
      const res = await runner(
        "plaud",
        ["recent", "--days", String(safeDays)],
        PLAUD_TIMEOUT_MS,
      );
      return parseGrabacionesOutput(res.stdout);
    }
  }

  async function obtenerTranscripcion(
    id: string,
  ): Promise<{ id: string; texto: string }> {
    const safeId = validatePlaudId(id);
    const estado = await obtenerEstado();
    if (!estado.conectado) {
      throw new HTTPException(400, {
        message: `${estado.mensaje} Ejecuta: ${INSTRUCCIONES_CONEXION.join(" && ")}`,
      });
    }

    const res = await runner("plaud", ["transcript", safeId], PLAUD_TIMEOUT_MS);
    return {
      id: safeId,
      texto: res.stdout.trim(),
    };
  }

  async function obtenerResumen(
    id: string,
  ): Promise<{ id: string; resumen: string }> {
    const safeId = validatePlaudId(id);
    const estado = await obtenerEstado();
    if (!estado.conectado) {
      throw new HTTPException(400, {
        message: `${estado.mensaje} Ejecuta: ${INSTRUCCIONES_CONEXION.join(" && ")}`,
      });
    }

    const res = await runner("plaud", ["summary", safeId], PLAUD_TIMEOUT_MS);
    return {
      id: safeId,
      resumen: res.stdout.trim(),
    };
  }

  return {
    obtenerEstado,
    listarGrabaciones,
    obtenerTranscripcion,
    obtenerResumen,
  };
}

export const plaudAdapter = createPlaudAdapter();

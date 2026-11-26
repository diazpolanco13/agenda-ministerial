import { randomBytes } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PUBLIC_NTFY_URL = "https://ntfy.mppd.dev";
const DEFAULT_PUBLIC_AGENDA_URL = "https://agenda.mppd.dev";

export class NtfyRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "NtfyRequestError";
  }
}

export function getNtfyInternalUrl(): string | null {
  const url = process.env.NTFY_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export function getNtfyPublicUrl(): string {
  const url = process.env.NTFY_PUBLIC_URL?.trim();
  return url ? url.replace(/\/+$/, "") : DEFAULT_PUBLIC_NTFY_URL;
}

export function getAgendaPublicUrl(): string {
  const explicit = process.env.AGENDA_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const clientUrl = process.env.KANEO_CLIENT_URL?.trim();
  if (
    clientUrl &&
    !clientUrl.includes("localhost") &&
    !clientUrl.includes("127.0.0.1")
  ) {
    return clientUrl.replace(/\/+$/, "");
  }

  return DEFAULT_PUBLIC_AGENDA_URL;
}

function getAdminCredentials(): { user: string; password: string } | null {
  const user = process.env.NTFY_ADMIN_USER?.trim();
  const password = process.env.NTFY_ADMIN_PASSWORD?.trim();
  if (!user || !password) return null;
  return { user, password };
}

export function isNtfyConfigured(): boolean {
  return Boolean(getNtfyInternalUrl() && getAdminCredentials());
}

function buildBasicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;
}

function encodeHeaderTitle(title: string): string {
  return /^[\x20-\x7e]*$/.test(title)
    ? title
    : `=?UTF-8?B?${Buffer.from(title, "utf8").toString("base64")}?=`;
}

export function generatePrivateTopic(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(20);
  let suffix = "";
  for (let i = 0; i < 20; i++) {
    suffix += alphabet[bytes[i]! % alphabet.length];
  }
  return `agenda-${suffix}`;
}

export function generateNtfyUsername(userId: string): string {
  const cleaned = userId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `ag_${(cleaned || "usuario").slice(0, 24)}`;
}

export function generateNtfyPassword(): string {
  return randomBytes(18).toString("base64url");
}

async function ntfyAdminFetch(
  path: string,
  init: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: string;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
  },
): Promise<Response> {
  const baseUrl = getNtfyInternalUrl();
  const creds = getAdminCredentials();
  if (!baseUrl || !creds) {
    throw new NtfyRequestError("Servidor ntfy no configurado en el entorno", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: buildBasicAuthHeader(creds.user, creds.password),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body,
      signal: controller.signal,
      redirect: "manual",
    });

    if (
      !response.ok &&
      !(init.allowedStatuses?.includes(response.status) ?? false)
    ) {
      throw new NtfyRequestError(
        `Error del servidor ntfy (HTTP ${response.status})`,
        response.status,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof NtfyRequestError) throw error;
    if (controller.signal.aborted) {
      throw new NtfyRequestError("Tiempo de espera agotado al contactar ntfy", 504);
    }
    throw new NtfyRequestError("No se pudo contactar al servidor ntfy", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteNtfyUser(username: string): Promise<void> {
  const res = await ntfyAdminFetch("/v1/users", {
    method: "DELETE",
    body: JSON.stringify({ username }),
    allowedStatuses: [400, 404],
  });
  await res.body?.cancel().catch(() => {});
}

export async function createOrReplaceNtfyUser(
  username: string,
  password: string,
  topic: string,
): Promise<void> {
  await deleteNtfyUser(username);

  const createRes = await ntfyAdminFetch("/v1/users", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  await createRes.body?.cancel().catch(() => {});

  const accessRes = await ntfyAdminFetch("/v1/users/access", {
    method: "PUT",
    body: JSON.stringify({
      username,
      topic,
      permission: "read-only",
    }),
  });
  await accessRes.body?.cancel().catch(() => {});
}

export async function publishNtfyMessage(input: {
  topic: string;
  title: string;
  body: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  tags?: string;
  clickUrl?: string | null;
}): Promise<void> {
  const headers: Record<string, string> = {
    Title: encodeHeaderTitle(input.title),
    Priority: String(input.priority ?? 3),
    "Content-Type": "text/plain; charset=utf-8",
  };
  if (input.tags) {
    headers.Tags = input.tags;
  }
  if (input.clickUrl) {
    headers.Click = input.clickUrl;
  }

  const res = await ntfyAdminFetch(`/${encodeURIComponent(input.topic)}`, {
    method: "POST",
    headers,
    body: input.body,
  });
  await res.body?.cancel().catch(() => {});
}

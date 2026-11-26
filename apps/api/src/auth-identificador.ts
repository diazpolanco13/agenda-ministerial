import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "./auth";
import db from "./database";
import { militarPerfilTable, userTable } from "./database/schema";
import { normalizeCedulaInput } from "./sigefanb/military-assets";

const SAFE_FORWARD_HEADERS = [
  "cookie",
  "origin",
  "referer",
  "user-agent",
  "x-forwarded-for",
  "x-captcha-response",
  "x-turnstile-token",
] as const;

function invalidCredentialsResponse(c: {
  json: (data: unknown, status: 401) => Response;
}) {
  return c.json(
    {
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Cédula o contraseña incorrecta",
    },
    401,
  );
}

/**
 * Router público para iniciar sesión con cédula de identidad o correo electrónico.
 * Resuelve la cédula a través de `militar_perfil` y reenvía la petición
 * internamente al endpoint `/api/auth/sign-in/email` de Better Auth.
 */
export const authIdentificador = new Hono();

authIdentificador.post("/ingresar", async (c) => {
  const rawBody = (await c.req.json().catch(() => null)) as {
    identificador?: unknown;
    password?: unknown;
  } | null;

  const identificador =
    typeof rawBody?.identificador === "string"
      ? rawBody.identificador.trim()
      : "";
  const password =
    typeof rawBody?.password === "string" ? rawBody.password : "";

  if (!identificador || !password) {
    return invalidCredentialsResponse(c);
  }

  let email: string;
  if (identificador.includes("@")) {
    email = identificador.toLowerCase();
  } else {
    const cedula = normalizeCedulaInput(identificador);
    if (!cedula) {
      return invalidCredentialsResponse(c);
    }

    const [row] = await db
      .select({ email: userTable.email })
      .from(militarPerfilTable)
      .innerJoin(userTable, eq(militarPerfilTable.userId, userTable.id))
      .where(eq(militarPerfilTable.cedula, cedula))
      .limit(1);

    if (!row?.email) {
      return invalidCredentialsResponse(c);
    }
    email = row.email;
  }

  const headers = new Headers();
  for (const headerName of SAFE_FORWARD_HEADERS) {
    const value = c.req.raw.headers.get(headerName);
    if (value !== null) {
      headers.set(headerName, value);
    }
  }
  headers.set("content-type", "application/json");

  const targetUrl = new URL("/api/auth/sign-in/email", c.req.raw.url);
  const forwardedRequest = new Request(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });

  return auth.handler(forwardedRequest);
});

export default authIdentificador;

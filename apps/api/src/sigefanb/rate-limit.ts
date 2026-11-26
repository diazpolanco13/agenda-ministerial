import { HTTPException } from "hono/http-exception";
import { createAttemptLimiter } from "../admin/system/attempt-limiter";

const WINDOW_MS = 60_000;
const API_MAX_REQUESTS = 60;
const PHOTO_MAX_REQUESTS = 300;

const apiLimiter = createAttemptLimiter({
  max: API_MAX_REQUESTS,
  windowMs: WINDOW_MS,
});

const photoLimiter = createAttemptLimiter({
  max: PHOTO_MAX_REQUESTS,
  windowMs: WINDOW_MS,
});

function throwRateLimited(retryAfterSeconds: number): never {
  throw new HTTPException(429, {
    res: Response.json(
      {
        message: `Demasiadas solicitudes. Intente nuevamente en ${retryAfterSeconds} segundos.`,
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    ),
  });
}

/** Aplica límite de 60 req/min por usuario para búsqueda, consulta y provisión SIGEFANB. */
export function enforceSigefanbRateLimit(userId: string): void {
  const decision = apiLimiter.take(userId);
  if (!decision.allowed) {
    throwRateLimited(decision.retryAfterSeconds);
  }
}

/** Aplica límite de 300 req/min por usuario para descarga de fotografías SIGEFANB. */
export function enforceSigefanbPhotoRateLimit(userId: string): void {
  const decision = photoLimiter.take(userId);
  if (!decision.allowed) {
    throwRateLimited(decision.retryAfterSeconds);
  }
}

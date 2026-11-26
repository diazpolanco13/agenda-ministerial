import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

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

export async function obtenerEstadoPlaud(): Promise<PlaudEstado> {
  const response = await fetch(getApiUrl("/plaud/estado"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as PlaudEstado;
}

export async function listarGrabacionesPlaud(
  days = 14,
): Promise<PlaudGrabacion[]> {
  const response = await fetch(
    getApiUrl(`/plaud/grabaciones?days=${encodeURIComponent(String(days))}`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as PlaudGrabacion[];
}

export async function obtenerTranscripcionPlaud(
  id: string,
): Promise<{ id: string; texto: string }> {
  const response = await fetch(
    getApiUrl(`/plaud/grabaciones/${encodeURIComponent(id)}/transcripcion`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as { id: string; texto: string };
}

export async function obtenerResumenPlaud(
  id: string,
): Promise<{ id: string; resumen: string }> {
  const response = await fetch(
    getApiUrl(`/plaud/grabaciones/${encodeURIComponent(id)}/resumen`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as { id: string; resumen: string };
}

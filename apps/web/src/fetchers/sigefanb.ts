import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export type SigefanbPersonalItem = {
  cedula: string;
  nacionalidad: "V" | "E";
  nombreCompleto: string;
  grado: string;
  componente: string | null;
  unidad: string | null;
  sexo: string | null;
  insignia: string | null;
  fotoUrl: string;
};

export type ProvisionarResponsableInput = {
  cedula: string;
  workspaceId: string;
};

export type ProvisionarResponsableResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    cedula: string;
    nacionalidad?: string | null;
    grado: string | null;
    componente: string | null;
    unidad: string | null;
    pendiente: boolean;
  };
  created: boolean;
};

export async function buscarPersonalSigefanb(
  q: string,
): Promise<SigefanbPersonalItem[]> {
  const response = await fetch(
    getApiUrl(`/sigefanb/personal/buscar?q=${encodeURIComponent(q)}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as SigefanbPersonalItem[];
}

export async function obtenerPersonalSigefanb(
  cedula: string,
): Promise<SigefanbPersonalItem | null> {
  const response = await fetch(
    getApiUrl(`/sigefanb/personal/${encodeURIComponent(cedula)}`),
    {
      credentials: "include",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as SigefanbPersonalItem;
}

export async function provisionarResponsableSigefanb(
  input: ProvisionarResponsableInput,
): Promise<ProvisionarResponsableResponse> {
  const response = await fetch(getApiUrl("/sigefanb/provisionar"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as ProvisionarResponsableResponse;
}

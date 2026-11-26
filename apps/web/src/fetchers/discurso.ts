import { getApiUrl } from "@/fetchers/get-api-url";
import type { SigefanbPersonalItem } from "@/fetchers/sigefanb";
import { HttpError } from "@/lib/http-error";

export type DiscursoFuenteTipo = "texto" | "archivo" | "plaud" | "ejemplo";
export type DiscursoEstadoBorrador = "borrador" | "aprobado";
export type DiscursoMotorUsado = "ollama" | "reglas";
export type DiscursoPrioridad =
  | "no-priority"
  | "low"
  | "medium"
  | "high"
  | "urgent";
export type DiscursoAsignacionModo =
  | "auto"
  | "sugerido"
  | "manual"
  | "sin_responsable";

export type DiscursoPistasResponsable = {
  grado: string | null;
  componente: string | null;
  apellido: string | null;
  nombre: string | null;
};

export type DiscursoCandidatoResponsable = SigefanbPersonalItem & {
  score: number;
  motivo: string;
};

export type DiscursoOrdenBorrador = {
  id: string;
  seleccionada: boolean;
  titulo: string;
  descripcion: string;
  proyectoId: string | null;
  responsableMencionado: string;
  pistas: DiscursoPistasResponsable;
  asignacionModo: DiscursoAsignacionModo;
  responsableCedula: string | null;
  responsableUserId: string | null;
  candidatos: DiscursoCandidatoResponsable[];
  plazo: string | null;
  plazoTexto: string | null;
  prioridad: DiscursoPrioridad;
  citaTextual: string;
  confianza: number;
  createdTaskId?: string | null;
};

export type DiscursoBorrador = {
  id: string;
  workspaceId: string;
  createdBy: string;
  titulo: string;
  fuenteTipo: string;
  fuenteReferencia: string | null;
  fechaDiscurso: string | null;
  textoOriginal: string;
  motorUsado: string;
  estado: string;
  ordenes: DiscursoOrdenBorrador[];
  tareasCreadas: number;
  aprobadoEn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DiscursoEjemploResponse = {
  titulo: string;
  fechaDiscurso: string;
  texto: string;
};

export type ExtraerDiscursoInput = {
  workspaceId: string;
  titulo?: string;
  contenido: string;
  formato?: "txt" | "md" | "vtt" | "srt" | "json";
  fuenteTipo?: DiscursoFuenteTipo;
  fuenteReferencia?: string | null;
  fechaDiscurso?: string | null;
  defaultProyectoId?: string | null;
  guardarBorrador?: boolean;
};

export type ExtraerDiscursoResponse = {
  borrador: DiscursoBorrador;
  motorUsado: DiscursoMotorUsado;
  fallbackMotivo?: string;
};

export type AprobarBorradorResponse = {
  tareasCreadas: number;
  tareas: {
    id: string;
    title: string;
    projectId: string;
    number: number | null;
    userId: string | null;
    priority: string | null;
    dueDate: string | null;
  }[];
  borrador: DiscursoBorrador;
};

export async function obtenerEjemploDiscurso(): Promise<DiscursoEjemploResponse> {
  const response = await fetch(getApiUrl("/discurso/ejemplo"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as DiscursoEjemploResponse;
}

export async function extraerOrdenesDiscurso(
  input: ExtraerDiscursoInput,
): Promise<ExtraerDiscursoResponse> {
  const response = await fetch(getApiUrl("/discurso/extraer"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as ExtraerDiscursoResponse;
}

export async function listarBorradoresDiscurso(
  workspaceId: string,
): Promise<DiscursoBorrador[]> {
  const response = await fetch(
    getApiUrl(
      `/discurso/borradores?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as DiscursoBorrador[];
}

export async function actualizarBorradorDiscurso(
  id: string,
  payload: {
    titulo?: string;
    fechaDiscurso?: string | null;
    ordenes?: DiscursoOrdenBorrador[];
  },
): Promise<DiscursoBorrador> {
  const response = await fetch(
    getApiUrl(`/discurso/borradores/${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as DiscursoBorrador;
}

export async function eliminarBorradorDiscurso(
  id: string,
): Promise<{ id: string }> {
  const response = await fetch(
    getApiUrl(`/discurso/borradores/${encodeURIComponent(id)}`),
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as { id: string };
}

export async function aprobarBorradorDiscurso(
  id: string,
  payload?: {
    titulo?: string;
    defaultProyectoId?: string | null;
    ordenes?: DiscursoOrdenBorrador[];
  },
): Promise<AprobarBorradorResponse> {
  const response = await fetch(
    getApiUrl(`/discurso/borradores/${encodeURIComponent(id)}/aprobar`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    },
  );
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return (await response.json()) as AprobarBorradorResponse;
}

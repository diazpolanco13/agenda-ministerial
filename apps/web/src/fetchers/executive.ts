import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export type ExecutiveResponsable = {
  userId: string;
  name: string;
  grado: string | null;
  componente: string | null;
  unidad: string | null;
  cedula: string | null;
  fotoUrl: string | null;
  insignia: string | null;
};

export type ExecutiveUsuario = {
  userId: string;
  name: string;
  grado: string | null;
  gradoCorto: string | null;
  componente: string | null;
  unidad: string | null;
  cedula: string | null;
  insignia: string | null;
  fotoUrl: string | null;
  restrictedResponsable: boolean;
};

export type ExecutiveKpis = {
  vencidas: number;
  vencenHoy: number;
  vencenSemana: number;
  ordenesPendientes: number;
  cumplimientoATiempoPct: number | null;
  cumplimientoEnPlazo: number;
  cumplimientoBase: number;
  totalAbiertas: number;
  totalCompletadas: number;
};

export type ExecutiveAgendaHoyItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectIcon: string | null;
  number: number | null;
  title: string;
  status: string;
  statusName: string | null;
  priority: string;
  completada: boolean;
  esOrden: boolean;
  startDate: string | null;
  dueDate: string | null;
  responsable: ExecutiveResponsable | null;
};

export type ExecutiveOrdenReciente = {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  number: number | null;
  title: string;
  status: string;
  statusName: string | null;
  priority: string;
  completada: boolean;
  esOrden: boolean;
  dueDate: string | null;
  createdAt: string;
  responsable: ExecutiveResponsable | null;
};

export type ExecutiveTopResponsable = ExecutiveResponsable & {
  abiertas: number;
  vencidas: number;
  completadas: number;
};

export type ExecutiveActividadCompactaItem = {
  id: string;
  actorNombre: string;
  actorGrado: string | null;
  actorFotoUrl: string | null;
  actorCedula: string | null;
  dia: string;
  resumen: string;
  cantidad: number;
  ultimaHora: string;
  ultimaTarea: {
    id: string;
    number: number | null;
    title: string;
    projectId: string;
    projectSlug: string;
  };
};

export type ExecutiveSummary = {
  usuario: ExecutiveUsuario;
  kpis: ExecutiveKpis;
  agendaHoy: ExecutiveAgendaHoyItem[];
  ordenesRecientes: ExecutiveOrdenReciente[];
  topResponsables: ExecutiveTopResponsable[];
  actividadCompacta: ExecutiveActividadCompactaItem[];
};

export async function getExecutiveSummary(
  workspaceId: string,
): Promise<ExecutiveSummary> {
  const response = await fetch(
    getApiUrl(
      `/executive/summary?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as ExecutiveSummary;
}

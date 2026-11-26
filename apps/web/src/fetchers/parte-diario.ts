import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export type DailyBriefMotor = "ollama" | "determinista";

export type DailyBriefItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  number: number | null;
  title: string;
  priority: string;
  dueDate: string | null;
  isOrder: boolean;
  orderFolio: string | null;
  orderClosureStatus: string;
  confidentialityLevel: string;
};

export type DailyBriefCounters = {
  venceHoy: number;
  vencidas: number;
  ordenesNuevas: number;
  agendaDia: number;
  pendientesVistoBueno: number;
};

export type DailyBriefCategory = keyof DailyBriefCounters;

export type DailyBriefItems = {
  venceHoy: DailyBriefItem[];
  vencidas: DailyBriefItem[];
  ordenesNuevas: DailyBriefItem[];
  agendaDia: DailyBriefItem[];
  pendientesVistoBueno: DailyBriefItem[];
};

export type DailyBriefResponse = {
  dateKey: string;
  fechaLarga: string;
  saludo: string;
  motorUsado: DailyBriefMotor;
  parrafoEjecutivo: string;
  contadores: DailyBriefCounters;
  items: DailyBriefItems;
};

export type SendDailyBriefTestResponse = {
  sentNtfy: boolean;
  emailHook: {
    sent: boolean;
    reason?: string;
  };
  motorUsado: DailyBriefMotor;
};

export async function getDailyBrief(
  workspaceId: string,
  options?: { llm?: boolean; refresh?: boolean },
): Promise<DailyBriefResponse> {
  const params = new URLSearchParams({ workspaceId });
  if (options?.llm) params.set("llm", "1");
  if (options?.refresh) params.set("refresh", "1");

  const response = await fetch(
    getApiUrl(`/parte-diario/hoy?${params.toString()}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as DailyBriefResponse;
}

export async function sendDailyBriefTest(
  workspaceId: string,
): Promise<SendDailyBriefTestResponse> {
  const response = await fetch(getApiUrl("/parte-diario/enviar-prueba"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspaceId }),
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as SendDailyBriefTestResponse;
}

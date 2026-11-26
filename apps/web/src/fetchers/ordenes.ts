import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export type OrderClosureStatus =
  | "abierta"
  | "en_revision"
  | "aprobada"
  | "devuelta";

export type OrderOrigin = "discurso" | "audiencia" | "verbal" | "escrita";

export type OrderSemaforo = "completada" | "rojo" | "amarillo" | "verde";

export type OrderResponsable = {
  userId: string;
  name: string;
  fotoUrl: string | null;
  grado: string | null;
  gradoCorto: string | null;
  insignia: string | null;
  componente: string | null;
  unidad: string | null;
  cedula: string | null;
};

export type OrderItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectIcon: string | null;
  number: number | null;
  title: string;
  description: string | null;
  status: string;
  statusName: string | null;
  columnId: string | null;
  isFinal: boolean;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  confidentialityLevel: string;
  isOrder: boolean;
  orderFolio: string | null;
  orderOrigin: OrderOrigin | string | null;
  orderQuote: string | null;
  orderClosureStatus: OrderClosureStatus | string;
  orderEvidenceText: string | null;
  orderEvidenceAssetId: string | null;
  orderEvidenceSubmittedAt: string | null;
  orderEvidenceSubmittedBy: string | null;
  orderReviewedAt: string | null;
  orderReviewedBy: string | null;
  orderReviewComment: string | null;
  orderSealHash: string | null;
  subtaskCounts: {
    completed: number;
    total: number;
  };
  semaforo: OrderSemaforo;
  avancePct: number;
  responsable: OrderResponsable | null;
};

export type ListOrdersKpis = {
  total: number;
  abiertas: number;
  enRevision: number;
  aprobadas: number;
  devueltas: number;
  vencidas: number;
};

export type ListOrdersResponse = {
  canApprove: boolean;
  kpis: ListOrdersKpis;
  ordenes: OrderItem[];
};

export type ListOrdersFilters = {
  workspaceId: string;
  closureStatus?: OrderClosureStatus;
  origin?: OrderOrigin;
  search?: string;
};

export type DespachoUsuario = {
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

export type DespachoResponse = {
  usuario: DespachoUsuario;
  workspaceName: string;
  canApprove: boolean;
  counts: {
    hoy: number;
    requiereVistoBueno: number;
    criticasVencidas: number;
  };
  hoy: OrderItem[];
  requiereVistoBueno: OrderItem[];
  criticasVencidas: OrderItem[];
};

export type OrderMutationResponse = {
  id: string;
  isOrder: boolean;
  orderFolio: string | null;
  orderOrigin: string | null;
  orderQuote: string | null;
  orderClosureStatus: string;
  orderEvidenceText: string | null;
  orderEvidenceAssetId: string | null;
  orderEvidenceSubmittedAt: string | null;
  orderEvidenceSubmittedBy: string | null;
  orderReviewedAt: string | null;
  orderReviewedBy: string | null;
  orderReviewComment: string | null;
  orderSealHash: string | null;
  status: string;
  columnId: string | null;
};

export type OrderEvidenceUploadResponse = {
  assetId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
};

export async function listOrders(
  filters: ListOrdersFilters,
): Promise<ListOrdersResponse> {
  const params = new URLSearchParams({
    workspaceId: filters.workspaceId,
  });
  if (filters.closureStatus) {
    params.set("closureStatus", filters.closureStatus);
  }
  if (filters.origin) {
    params.set("origin", filters.origin);
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const response = await fetch(getApiUrl(`/ordenes?${params.toString()}`), {
    credentials: "include",
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as ListOrdersResponse;
}

export async function getDespacho(
  workspaceId: string,
): Promise<DespachoResponse> {
  const response = await fetch(
    getApiUrl(
      `/ordenes/despacho?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as DespachoResponse;
}

export async function markTaskAsOrder(
  taskId: string,
  payload: { origin: OrderOrigin; quote?: string | null },
): Promise<OrderMutationResponse> {
  const response = await fetch(
    getApiUrl(`/ordenes/${encodeURIComponent(taskId)}/marcar`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as OrderMutationResponse;
}

export async function uploadOrderEvidenceFile(
  taskId: string,
  file: File,
): Promise<OrderEvidenceUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    getApiUrl(`/ordenes/${encodeURIComponent(taskId)}/evidencia-archivo`),
    {
      method: "POST",
      credentials: "include",
      body: formData,
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as OrderEvidenceUploadResponse;
}

export async function submitOrderEvidence(
  taskId: string,
  payload: { evidenceText?: string | null; evidenceAssetId?: string | null },
): Promise<OrderMutationResponse> {
  const response = await fetch(
    getApiUrl(`/ordenes/${encodeURIComponent(taskId)}/evidencia`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as OrderMutationResponse;
}

export async function approveOrder(
  taskId: string,
  payload?: { comment?: string | null },
): Promise<OrderMutationResponse> {
  const response = await fetch(
    getApiUrl(`/ordenes/${encodeURIComponent(taskId)}/visto-bueno`),
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

  return (await response.json()) as OrderMutationResponse;
}

export async function returnOrder(
  taskId: string,
  payload: { comment: string },
): Promise<OrderMutationResponse> {
  const response = await fetch(
    getApiUrl(`/ordenes/${encodeURIComponent(taskId)}/devolver`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as OrderMutationResponse;
}

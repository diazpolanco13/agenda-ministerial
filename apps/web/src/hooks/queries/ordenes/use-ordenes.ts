import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  approveOrder,
  getDespacho,
  listOrders,
  markTaskAsOrder,
  type OrderClosureStatus,
  type OrderOrigin,
  returnOrder,
  submitOrderEvidence,
  uploadOrderEvidenceFile,
} from "@/fetchers/ordenes";

export type UseOrdenesFilters = {
  closureStatus?: OrderClosureStatus;
  origin?: OrderOrigin;
  search?: string;
};

function invalidateOrderQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ordenes"] }),
    queryClient.invalidateQueries({ queryKey: ["despacho"] }),
    queryClient.invalidateQueries({ queryKey: ["executive-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["task"] }),
    queryClient.invalidateQueries({ queryKey: ["task-detail"] }),
    queryClient.invalidateQueries({ queryKey: ["activity"] }),
  ]);
}

export function useOrdenes(
  workspaceId: string | undefined,
  filters?: UseOrdenesFilters,
) {
  return useQuery({
    queryKey: [
      "ordenes",
      workspaceId,
      filters?.closureStatus ?? null,
      filters?.origin ?? null,
      filters?.search?.trim() ?? "",
    ],
    queryFn: () =>
      listOrders({
        workspaceId: workspaceId ?? "",
        closureStatus: filters?.closureStatus,
        origin: filters?.origin,
        search: filters?.search,
      }),
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
  });
}

export function useDespacho(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["despacho", workspaceId],
    queryFn: () => getDespacho(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export function useMarkAsOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      origin,
      quote,
    }: {
      taskId: string;
      origin: OrderOrigin;
      quote?: string | null;
    }) => markTaskAsOrder(taskId, { origin, quote }),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
    },
  });
}

export function useUploadOrderEvidenceFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) =>
      uploadOrderEvidenceFile(taskId, file),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
    },
  });
}

export function useSubmitOrderEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      evidenceText,
      evidenceAssetId,
    }: {
      taskId: string;
      evidenceText?: string | null;
      evidenceAssetId?: string | null;
    }) =>
      submitOrderEvidence(taskId, {
        evidenceText,
        evidenceAssetId,
      }),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
    },
  });
}

export function useApproveOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      comment,
    }: {
      taskId: string;
      comment?: string | null;
    }) => approveOrder(taskId, { comment }),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
    },
  });
}

export function useReturnOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, comment }: { taskId: string; comment: string }) =>
      returnOrder(taskId, { comment }),
    onSuccess: async () => {
      await invalidateOrderQueries(queryClient);
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type DailyBriefResponse,
  getDailyBrief,
  sendDailyBriefTest,
} from "@/fetchers/parte-diario";

export function dailyBriefQueryKey(workspaceId: string | undefined) {
  return ["parte-diario", workspaceId] as const;
}

export function useDailyBrief(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dailyBriefQueryKey(workspaceId),
    queryFn: () => getDailyBrief(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSynthesizeDailyBrief(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        return Promise.reject(new Error("Espacio de trabajo no seleccionado"));
      }
      return getDailyBrief(workspaceId, { llm: true, refresh: true });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<DailyBriefResponse>(
        dailyBriefQueryKey(workspaceId),
        data,
      );
    },
  });
}

export function useSendDailyBriefTest(workspaceId: string | undefined) {
  return useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        return Promise.reject(new Error("Espacio de trabajo no seleccionado"));
      }
      return sendDailyBriefTest(workspaceId);
    },
  });
}

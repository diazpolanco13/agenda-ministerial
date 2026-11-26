import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from "@/fetchers/user/saved-filters";

export function useSavedFilters(
  workspaceId: string | undefined,
  scope: "my-tasks" | "delegated" = "my-tasks",
) {
  return useQuery({
    queryKey: ["saved-filters", workspaceId, scope],
    queryFn: () => listSavedFilters(workspaceId ?? "", scope),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSavedFilter,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["saved-filters", variables.workspaceId],
      });
    },
  });
}

export function useDeleteSavedFilter(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSavedFilter(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["saved-filters", workspaceId],
      });
    },
  });
}

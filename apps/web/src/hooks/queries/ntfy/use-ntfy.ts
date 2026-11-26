import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateNtfy,
  deactivateNtfy,
  getNtfyStatus,
  type NtfyEventPreferences,
  type NtfyStatus,
  regenerateNtfy,
  sendNtfyTest,
  updateNtfyPreferences,
} from "@/fetchers/ntfy";

export const NTFY_STATUS_QUERY_KEY = ["ntfy-status"] as const;

export function useNtfyStatus() {
  return useQuery({
    queryKey: NTFY_STATUS_QUERY_KEY,
    queryFn: getNtfyStatus,
  });
}

export function useActivateNtfy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateNtfy,
    onSuccess: (data) => {
      const { credentials: _credentials, ...status } = data;
      queryClient.setQueryData<NtfyStatus>(NTFY_STATUS_QUERY_KEY, status);
    },
  });
}

export function useRegenerateNtfy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateNtfy,
    onSuccess: (data) => {
      const { credentials: _credentials, ...status } = data;
      queryClient.setQueryData<NtfyStatus>(NTFY_STATUS_QUERY_KEY, status);
    },
  });
}

export function useDeactivateNtfy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateNtfy,
    onSuccess: (status) => {
      queryClient.setQueryData<NtfyStatus>(NTFY_STATUS_QUERY_KEY, status);
    },
  });
}

export function useSendNtfyTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendNtfyTest,
    onSuccess: (result) => {
      queryClient.setQueryData<NtfyStatus>(NTFY_STATUS_QUERY_KEY, (prev) =>
        prev ? { ...prev, lastTestAt: result.sentAt } : prev,
      );
    },
  });
}

export function useUpdateNtfyPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Partial<NtfyEventPreferences>) =>
      updateNtfyPreferences(preferences),
    onSuccess: (status) => {
      queryClient.setQueryData<NtfyStatus>(NTFY_STATUS_QUERY_KEY, status);
    },
  });
}

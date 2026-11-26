import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  getUiPreferences,
  updateUiPreferences,
} from "@/fetchers/user/ui-preferences";
import type { AccessibilityPreferences } from "@/lib/accessibility";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function useGetUiPreferences(enabled = true) {
  return useQuery({
    queryKey: ["user-ui-preferences"],
    queryFn: getUiPreferences,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useUpdateUiPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AccessibilityPreferences>) =>
      updateUiPreferences(input),
    onSuccess: (data) => {
      queryClient.setQueryData(["user-ui-preferences"], data);
    },
  });
}

export function useSyncUiPreferences(userId: string | undefined) {
  const hydrateAccessibility = useUserPreferencesStore(
    (state) => state.hydrateAccessibility,
  );
  const lastUserIdRef = useRef<string | null>(null);
  const { data } = useGetUiPreferences(Boolean(userId));

  useEffect(() => {
    if (!userId || !data) return;
    if (lastUserIdRef.current === userId) return;
    lastUserIdRef.current = userId;
    hydrateAccessibility(data);
  }, [userId, data, hydrateAccessibility]);
}

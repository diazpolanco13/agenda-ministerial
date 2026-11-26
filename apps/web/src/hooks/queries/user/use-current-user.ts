import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { syncSigefanbProfile } from "@/fetchers/user/sync-sigefanb-profile";
import { currentUserQueryOptions } from "@/hooks/queries/user/use-managed-profile-fields";
import { toast } from "@/lib/toast";

export function useCurrentUser() {
  const { user } = useAuth();
  return useQuery({
    ...currentUserQueryOptions(user?.id),
    enabled: Boolean(user?.id),
  });
}

export function useSyncSigefanbProfile() {
  const queryClient = useQueryClient();
  const { user, refetchUser } = useAuth();

  return useMutation({
    mutationFn: syncSigefanbProfile,
    onSuccess: async (updated) => {
      queryClient.setQueryData(["current-user", user?.id], updated);
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      await refetchUser();
      toast.success("Ficha militar sincronizada con SIGEFANB");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo sincronizar con SIGEFANB",
      );
    },
  });
}

export default useCurrentUser;

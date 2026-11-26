import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateTemporaryPassword } from "@/fetchers/admin/generate-temporary-password";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useGenerateTemporaryPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateTemporaryPassword,
    onSuccess: () => {
      toast.success("Contraseña temporal generada");
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo generar la contraseña temporal",
      );
    },
  });
}

export default useGenerateTemporaryPassword;

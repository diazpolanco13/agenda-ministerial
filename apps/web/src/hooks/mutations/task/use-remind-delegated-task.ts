import { useMutation, useQueryClient } from "@tanstack/react-query";
import { remindDelegatedTask } from "@/fetchers/task/remind-delegated-task";

export function useRemindDelegatedTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, message }: { taskId: string; message?: string }) =>
      remindDelegatedTask(taskId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delegated-tasks"] });
    },
  });
}

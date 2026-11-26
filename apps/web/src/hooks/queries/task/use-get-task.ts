import { useQuery, useQueryClient } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";
import {
  findCachedTaskSummary,
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "./task-detail-cache";

function useGetTask(taskId: string, refreshWhileVisible = false) {
  const queryClient = useQueryClient();
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: Boolean(taskId) && !isBootstrapping,
    placeholderData: () => findCachedTaskSummary(queryClient, taskId),
    refetchOnMount: refreshWhileVisible ? "always" : true,
    staleTime: refreshWhileVisible ? 0 : TASK_DETAIL_STALE_TIME_MS,
    refetchInterval: refreshWhileVisible ? 30_000 : false,
    refetchOnWindowFocus: refreshWhileVisible ? "always" : false,
  });
}

export default useGetTask;

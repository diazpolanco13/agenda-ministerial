import { useQuery } from "@tanstack/react-query";
import getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";
import {
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "@/hooks/queries/task/task-detail-cache";

function useGetActivitiesByTaskId(
  taskId: string | undefined,
  refreshWhileVisible = false,
  limit?: number,
) {
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey:
      limit === undefined
        ? ["activities", taskId]
        : ["activities", taskId, { limit }],
    queryFn: () => {
      if (!taskId) {
        return [];
      }
      return getActivitesByTaskId({ taskId, limit });
    },
    enabled: Boolean(taskId) && !isBootstrapping,
    staleTime: refreshWhileVisible ? 0 : TASK_DETAIL_STALE_TIME_MS,
    refetchOnMount: refreshWhileVisible ? "always" : false,
    refetchInterval: refreshWhileVisible ? 30_000 : false,
    refetchOnWindowFocus: refreshWhileVisible ? "always" : false,
  });
}

export default useGetActivitiesByTaskId;

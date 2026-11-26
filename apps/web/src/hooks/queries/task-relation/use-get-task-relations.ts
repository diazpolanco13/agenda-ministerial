import { useQuery } from "@tanstack/react-query";
import getTaskRelations from "@/fetchers/task-relation/get-task-relations";
import {
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "@/hooks/queries/task/task-detail-cache";

function useGetTaskRelations(taskId: string) {
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey: ["task-relations", taskId],
    queryFn: () => getTaskRelations(taskId),
    enabled: Boolean(taskId) && !isBootstrapping,
    staleTime: TASK_DETAIL_STALE_TIME_MS,
  });
}

export default useGetTaskRelations;

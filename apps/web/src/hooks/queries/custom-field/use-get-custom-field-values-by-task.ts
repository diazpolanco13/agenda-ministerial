import { useQuery } from "@tanstack/react-query";
import getCustomFieldValuesByTask from "@/fetchers/custom-field/get-custom-field-values-by-task";
import {
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "@/hooks/queries/task/task-detail-cache";

function useGetCustomFieldValuesByTask(
  taskId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey: ["custom-field-values", taskId],
    queryFn: () => getCustomFieldValuesByTask({ taskId }),
    enabled: enabled && Boolean(taskId) && !isBootstrapping,
    staleTime: TASK_DETAIL_STALE_TIME_MS,
    refetchOnMount: true,
  });
}

export default useGetCustomFieldValuesByTask;

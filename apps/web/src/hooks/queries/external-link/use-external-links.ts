import { useQuery } from "@tanstack/react-query";
import getExternalLinks from "@/fetchers/external-link/get-external-links";
import {
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "@/hooks/queries/task/task-detail-cache";

function useExternalLinks(taskId: string) {
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey: ["external-links", taskId],
    queryFn: () => getExternalLinks(taskId),
    enabled: Boolean(taskId) && !isBootstrapping,
    staleTime: TASK_DETAIL_STALE_TIME_MS,
    refetchOnMount: true,
  });
}

export default useExternalLinks;

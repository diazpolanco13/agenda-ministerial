import { useQuery } from "@tanstack/react-query";
import getTimeEntriesByTaskId from "@/fetchers/time-entry/get-time-entries";
import {
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "@/hooks/queries/task/task-detail-cache";

function useGetTimeEntriesByTaskId(taskId: string) {
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey: ["time-entries", taskId],
    queryFn: () => getTimeEntriesByTaskId(taskId),
    enabled: Boolean(taskId) && !isBootstrapping,
    refetchOnMount: true,
    staleTime: TASK_DETAIL_STALE_TIME_MS,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetTimeEntriesByTaskId;

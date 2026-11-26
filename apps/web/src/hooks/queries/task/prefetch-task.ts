import type { QueryClient } from "@tanstack/react-query";
import getTaskDetail from "@/fetchers/task/get-task-detail";
import {
  seedTaskDetailCache,
  TASK_DETAIL_STALE_TIME_MS,
} from "./task-detail-cache";

export function prefetchTask(queryClient: QueryClient, taskId: string) {
  if (!taskId) return Promise.resolve();

  return queryClient.prefetchQuery({
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      const detail = await getTaskDetail(taskId);
      seedTaskDetailCache(queryClient, taskId, detail);
      return detail;
    },
    staleTime: TASK_DETAIL_STALE_TIME_MS,
  });
}

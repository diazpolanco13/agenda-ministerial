import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBoardProgress } from "./board-progress";
import { tasksQueryOptions } from "./tasks-query-options";

export function useGetTasks(
  projectId: string,
  {
    refetchOnMount = true,
    enabled = true,
  }: { refetchOnMount?: boolean; enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const progress = useBoardProgress(projectId);
  const query = useQuery({
    ...tasksQueryOptions(queryClient, projectId),
    refetchOnMount,
    refetchOnWindowFocus: true,
    enabled: enabled && Boolean(projectId),
  });
  return {
    ...query,
    data: query.data ?? (query.isFetching ? progress : undefined),
  };
}

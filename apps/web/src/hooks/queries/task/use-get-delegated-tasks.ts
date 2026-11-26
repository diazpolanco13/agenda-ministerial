import { useQuery } from "@tanstack/react-query";
import { getDelegatedTasks } from "@/fetchers/task/get-delegated-tasks";

export function useGetDelegatedTasks(
  workspaceId: string | undefined,
  options: { includeCompleted?: boolean; allWorkspaces?: boolean } = {},
  enabled = true,
) {
  const includeCompleted = options.includeCompleted !== false;
  const allWorkspaces = Boolean(options.allWorkspaces);

  return useQuery({
    queryKey: [
      "delegated-tasks",
      workspaceId,
      { includeCompleted, allWorkspaces },
    ],
    queryFn: () => getDelegatedTasks(workspaceId ?? "", options),
    enabled: Boolean(workspaceId) && enabled,
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

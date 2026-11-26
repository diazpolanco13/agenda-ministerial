import { useQuery } from "@tanstack/react-query";
import { getExecutiveSummary } from "@/fetchers/executive";

export function useExecutiveSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["executive-summary", workspaceId],
    queryFn: () => getExecutiveSummary(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

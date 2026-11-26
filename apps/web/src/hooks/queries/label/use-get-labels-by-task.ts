import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import getLabelsByTask from "@/fetchers/label/get-labels-by-task";
import {
  TASK_DETAIL_STALE_TIME_MS,
  useIsTaskBootstrapping,
} from "@/hooks/queries/task/task-detail-cache";
import { localeCompareSort } from "@/lib/format";

function useGetLabelsByTask(taskId: string) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const isBootstrapping = useIsTaskBootstrapping(taskId);

  return useQuery({
    queryKey: ["labels", taskId],
    queryFn: () => getLabelsByTask({ taskId }),
    enabled: Boolean(taskId) && !isBootstrapping,
    staleTime: TASK_DETAIL_STALE_TIME_MS,
    select: (labels) =>
      [...labels].sort((a, b) => localeCompareSort(a.name, b.name, locale)),
    refetchOnMount: true,
  });
}

export default useGetLabelsByTask;

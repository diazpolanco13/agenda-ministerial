import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import getTaskDetail, {
  type TaskDetailAggregate,
} from "@/fetchers/task/get-task-detail";
import type getTask from "@/fetchers/task/get-task";

export const TASK_DETAIL_STALE_TIME_MS = 15_000;

type TaskQueryData = Awaited<ReturnType<typeof getTask>>;

const TaskDetailBootstrapContext = createContext<string | null>(null);

export function useIsTaskBootstrapping(taskId: string | undefined): boolean {
  const bootstrappingTaskId = useContext(TaskDetailBootstrapContext);
  return Boolean(taskId && bootstrappingTaskId === taskId);
}

export function seedTaskDetailCache(
  queryClient: QueryClient,
  taskId: string,
  detail: TaskDetailAggregate,
) {
  const updatedAt = Date.now();
  queryClient.setQueryData(["task", taskId], detail.task, { updatedAt });
  queryClient.setQueryData(["activities", taskId], detail.activities, {
    updatedAt,
  });
  queryClient.setQueryData(["task-relations", taskId], detail.relations, {
    updatedAt,
  });
  queryClient.setQueryData(["labels", taskId], detail.labels, { updatedAt });
  queryClient.setQueryData(["external-links", taskId], detail.externalLinks, {
    updatedAt,
  });
  queryClient.setQueryData(["time-entries", taskId], detail.timeEntries, {
    updatedAt,
  });
  queryClient.setQueryData(
    ["custom-field-values", taskId],
    detail.customFieldValues,
    { updatedAt },
  );
}

type BoardLikeCache = {
  columns?: Array<{ tasks?: Array<Record<string, unknown>> }>;
  archivedTasks?: Array<Record<string, unknown>>;
  plannedTasks?: Array<Record<string, unknown>>;
};

type AssignedLikeCache = {
  tasks?: Array<Record<string, unknown>>;
};

export function findCachedTaskSummary(
  queryClient: QueryClient,
  taskId: string,
): TaskQueryData | undefined {
  if (!taskId) return undefined;

  const boardQueries = queryClient.getQueriesData<BoardLikeCache>({
    queryKey: ["tasks"],
  });
  for (const [, data] of boardQueries) {
    if (!data) continue;
    for (const column of data.columns ?? []) {
      const hit = column.tasks?.find((item) => item.id === taskId);
      if (hit) return hit as unknown as TaskQueryData;
    }
    const archived = data.archivedTasks?.find((item) => item.id === taskId);
    if (archived) return archived as unknown as TaskQueryData;
    const planned = data.plannedTasks?.find((item) => item.id === taskId);
    if (planned) return planned as unknown as TaskQueryData;
  }

  const assignedQueries = queryClient.getQueriesData<AssignedLikeCache>({
    queryKey: ["assigned-tasks"],
  });
  for (const [, data] of assignedQueries) {
    const hit = data?.tasks?.find((item) => item.id === taskId);
    if (hit) return hit as unknown as TaskQueryData;
  }

  return undefined;
}

export function TaskDetailBootstrapProvider({
  taskId,
  children,
}: {
  taskId: string | undefined;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["task-detail", taskId ?? ""],
    queryFn: async () => {
      const detail = await getTaskDetail(taskId ?? "");
      if (taskId) {
        seedTaskDetailCache(queryClient, taskId, detail);
      }
      return detail;
    },
    enabled: Boolean(taskId),
    staleTime: TASK_DETAIL_STALE_TIME_MS,
  });

  const bootstrappingTaskId =
    taskId && detailQuery.isPending && !detailQuery.data ? taskId : null;

  return (
    <TaskDetailBootstrapContext.Provider value={bootstrappingTaskId}>
      {children}
    </TaskDetailBootstrapContext.Provider>
  );
}

import { differenceInCalendarDays } from "date-fns";
import type { AssignedTask, ProjectColumnSummary } from "@/fetchers/task/get-assigned-tasks";
import type { DelegatedTask } from "@/fetchers/task/get-delegated-tasks";

export type MyTasksViewMode = "list" | "board" | "calendar" | "timeline";
export type MyTasksScope = "assigned" | "delegated";
export type MyTasksSegment =
  | "all"
  | "overdue"
  | "today"
  | "thisWeek"
  | "upcoming"
  | "noDueDate"
  | "completedRecent";
export type MyTasksGroupBy = "dueDate" | "project" | "priority" | "status";

export type MyTasksFilterState = {
  search: string;
  projectId: string | "all";
  priority: string | "all";
  status: string | "all";
  labelId: string | "all";
  allWorkspaces: boolean;
  workspaceFilterId: string | "all";
  segment: MyTasksSegment;
};

export const DEFAULT_MY_TASKS_FILTERS: MyTasksFilterState = {
  search: "",
  projectId: "all",
  priority: "all",
  status: "all",
  labelId: "all",
  allWorkspaces: false,
  workspaceFilterId: "all",
  segment: "all",
};

export type TaskLike = AssignedTask | DelegatedTask;

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  "no-priority": 4,
};

export function classifyTaskSegment(
  task: Pick<TaskLike, "dueDate" | "isFinal">,
  now = new Date(),
): Exclude<MyTasksSegment, "all"> {
  if (task.isFinal) {
    return "completedRecent";
  }
  if (!task.dueDate) {
    return "noDueDate";
  }
  const days = differenceInCalendarDays(new Date(task.dueDate), now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "thisWeek";
  return "upcoming";
}

export type SegmentCounts = Record<MyTasksSegment, number>;

export function computeSegmentCounts(
  tasks: readonly TaskLike[],
  now = new Date(),
): SegmentCounts {
  const counts: SegmentCounts = {
    all: 0,
    overdue: 0,
    today: 0,
    thisWeek: 0,
    upcoming: 0,
    noDueDate: 0,
    completedRecent: 0,
  };

  for (const task of tasks) {
    const seg = classifyTaskSegment(task, now);
    counts[seg] += 1;
    if (seg !== "completedRecent") {
      counts.all += 1;
    }
  }
  return counts;
}

export function filterMyTasks<T extends TaskLike>(
  tasks: readonly T[],
  filters: MyTasksFilterState,
  now = new Date(),
): T[] {
  const query = filters.search.trim().toLowerCase();

  return tasks.filter((task) => {
    const seg = classifyTaskSegment(task, now);

    if (filters.segment === "all") {
      if (seg === "completedRecent") return false;
    } else if (seg !== filters.segment) {
      return false;
    }

    if (
      filters.workspaceFilterId !== "all" &&
      task.workspaceId &&
      task.workspaceId !== filters.workspaceFilterId
    ) {
      return false;
    }

    if (filters.projectId !== "all" && task.projectId !== filters.projectId) {
      return false;
    }

    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }

    if (filters.status !== "all" && task.status !== filters.status) {
      return false;
    }

    if (
      filters.labelId !== "all" &&
      !task.labels.some(
        (l) => l.id === filters.labelId || l.name === filters.labelId,
      )
    ) {
      return false;
    }

    if (query) {
      const code =
        task.number != null
          ? `${task.projectSlug}-${task.number}`.toLowerCase()
          : task.projectSlug.toLowerCase();
      const haystack = [
        task.title,
        code,
        task.projectName,
        task.workspaceName ?? "",
        task.assigneeName ?? "",
        task.assigneeGrado ?? "",
        ...task.labels.map((l) => l.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export type MyTasksGroup<T extends TaskLike = TaskLike> = {
  id: string;
  title: string;
  tone?: "overdue" | "today" | "done" | "default";
  tasks: T[];
};

const DUE_BUCKET_LABELS: Record<Exclude<MyTasksSegment, "all">, string> = {
  overdue: "Vencidas",
  today: "Para hoy",
  thisWeek: "Esta semana",
  upcoming: "Próximas",
  noDueDate: "Sin fecha límite",
  completedRecent: "Completadas recientes",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  "no-priority": "Sin prioridad",
};

export function groupMyTasks<T extends TaskLike>(
  tasks: readonly T[],
  groupBy: MyTasksGroupBy,
  columnsByProject: Record<string, ProjectColumnSummary[]> = {},
  now = new Date(),
): MyTasksGroup<T>[] {
  if (groupBy === "project") {
    const map = new Map<string, MyTasksGroup<T>>();
    for (const task of tasks) {
      const existing = map.get(task.projectId) ?? {
        id: task.projectId,
        title: task.projectName,
        tone: "default" as const,
        tasks: [],
      };
      existing.tasks.push(task);
      map.set(task.projectId, existing);
    }
    return [...map.values()];
  }

  if (groupBy === "priority") {
    const order = ["urgent", "high", "medium", "low", "no-priority"];
    const map = new Map<string, T[]>();
    for (const task of tasks) {
      const p = task.priority || "no-priority";
      const list = map.get(p) ?? [];
      list.push(task);
      map.set(p, list);
    }
    return order.flatMap((priority) => {
      const list = map.get(priority);
      return list?.length
        ? [
            {
              id: `priority-${priority}`,
              title: PRIORITY_LABELS[priority] ?? priority,
              tone: priority === "urgent" ? ("overdue" as const) : ("default" as const),
              tasks: list,
            },
          ]
        : [];
    });
  }

  if (groupBy === "status") {
    const map = new Map<
      string,
      { id: string; title: string; tone: "done" | "default"; tasks: T[]; rank: number }
    >();
    for (const task of tasks) {
      const cols = columnsByProject[task.projectId] ?? [];
      const col = cols.find((c) => c.slug === task.status);
      const label = col?.name ?? task.statusName ?? task.status;
      const key = `${task.status}::${label}`;
      const existing = map.get(key) ?? {
        id: `status-${key}`,
        title: label,
        tone: task.isFinal || col?.isFinal ? ("done" as const) : ("default" as const),
        tasks: [],
        rank: col?.position ?? (task.isFinal ? 99 : 50),
      };
      existing.tasks.push(task);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => a.rank - b.rank);
  }

  // Default: dueDate
  const order: Exclude<MyTasksSegment, "all">[] = [
    "overdue",
    "today",
    "thisWeek",
    "upcoming",
    "noDueDate",
    "completedRecent",
  ];
  const map = new Map<Exclude<MyTasksSegment, "all">, T[]>();
  for (const task of tasks) {
    const seg = classifyTaskSegment(task, now);
    const list = map.get(seg) ?? [];
    list.push(task);
    map.set(seg, list);
  }
  return order.flatMap((seg) => {
    const list = map.get(seg);
    return list?.length
      ? [
          {
            id: `due-${seg}`,
            title: DUE_BUCKET_LABELS[seg],
            tone:
              seg === "overdue"
                ? ("overdue" as const)
                : seg === "today"
                  ? ("today" as const)
                  : seg === "completedRecent"
                    ? ("done" as const)
                    : ("default" as const),
            tasks: list,
          },
        ]
      : [];
  });
}

export function comparePriority(a: string, b: string): number {
  return (PRIORITY_ORDER[a] ?? 9) - (PRIORITY_ORDER[b] ?? 9);
}

export function hasActiveFilters(filters: MyTasksFilterState): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.projectId !== "all" ||
    filters.priority !== "all" ||
    filters.status !== "all" ||
    filters.labelId !== "all" ||
    filters.workspaceFilterId !== "all" ||
    filters.allWorkspaces
  );
}

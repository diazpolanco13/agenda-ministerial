import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  ChartGantt,
  LayoutDashboard,
  Rows3,
  SquareKanban,
  SquircleDashed,
  Users,
} from "lucide-react";
import type { TaskLayout } from "@/store/user-preferences";

export type ProjectRoute =
  | "gantt"
  | "board"
  | "backlog"
  | "calendar"
  | "workload"
  | "people"
  | "dashboard";

export type ProjectView =
  | "gantt"
  | "board"
  | "list"
  | "calendar"
  | "workload"
  | "people"
  | "dashboard"
  | "backlog";

export const PROJECT_ROUTE_PATHS = {
  gantt: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
  board: "/dashboard/workspace/$workspaceId/project/$projectId/board",
  backlog: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
  calendar: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
  workload: "/dashboard/workspace/$workspaceId/project/$projectId/workload",
  people: "/dashboard/workspace/$workspaceId/project/$projectId/people",
  dashboard: "/dashboard/workspace/$workspaceId/project/$projectId/dashboard",
} as const;

export type ProjectViewDefinition = {
  id: ProjectView;
  labelKey: string;
  icon: LucideIcon;
  shortcut?: string;
};

export const PROJECT_VIEWS: ReadonlyArray<ProjectViewDefinition> = [
  {
    id: "gantt",
    labelKey: "tasks:view.gantt",
    icon: ChartGantt,
    shortcut: "1",
  },
  {
    id: "board",
    labelKey: "tasks:view.board",
    icon: SquareKanban,
    shortcut: "2",
  },
  {
    id: "list",
    labelKey: "tasks:view.list",
    icon: Rows3,
    shortcut: "3",
  },
  {
    id: "calendar",
    labelKey: "tasks:calendar.title",
    icon: CalendarDays,
    shortcut: "4",
  },
  {
    id: "workload",
    labelKey: "tasks:view.workload",
    icon: BarChart3,
    shortcut: "5",
  },
  {
    id: "people",
    labelKey: "tasks:view.people",
    icon: Users,
    shortcut: "6",
  },
  {
    id: "dashboard",
    labelKey: "tasks:view.dashboard",
    icon: LayoutDashboard,
    shortcut: "7",
  },
  {
    id: "backlog",
    labelKey: "tasks:view.backlog",
    icon: SquircleDashed,
  },
];

export const QUICK_VIEW_TABS = PROJECT_VIEWS.filter(
  (view) => view.id !== "backlog",
);

export const TASK_LAYOUTS = QUICK_VIEW_TABS;

export const LAST_PROJECT_VIEW_PREFIX = "agenda:project-last-view:";

export function isProjectView(value: unknown): value is ProjectView {
  return (
    typeof value === "string" && PROJECT_VIEWS.some((view) => view.id === value)
  );
}

export function getLastProjectView(projectId: string): ProjectView {
  if (!projectId || typeof window === "undefined") return "board";
  try {
    const stored = window.localStorage.getItem(
      `${LAST_PROJECT_VIEW_PREFIX}${projectId}`,
    );
    return isProjectView(stored) ? stored : "board";
  } catch {
    return "board";
  }
}

export function setLastProjectView(projectId: string, view: ProjectView): void {
  if (!projectId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LAST_PROJECT_VIEW_PREFIX}${projectId}`,
      view,
    );
  } catch {
    // Storage may be unavailable or full.
  }
}

export function routeForView(view: ProjectView): ProjectRoute {
  return view === "list" ? "board" : view;
}

export function resolveProjectView(
  route: ProjectRoute,
  viewMode: "board" | "list",
): ProjectView {
  return route === "board" ? viewMode : route;
}

export function tasksViewFor(
  taskLayout: TaskLayout,
  viewMode: "board" | "list",
): ProjectView {
  return taskLayout === "board" || taskLayout === "list"
    ? viewMode
    : taskLayout;
}

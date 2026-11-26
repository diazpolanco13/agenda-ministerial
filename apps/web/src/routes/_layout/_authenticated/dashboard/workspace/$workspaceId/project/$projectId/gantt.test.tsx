import enUS from "@i18n/en-US.json";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type Task from "@/types/task";
import { Route } from "./gantt";

// jsdom does not implement either of these; the component relies on both to
// center the timeline on "today".
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

const navigate = vi.fn();

const routeParams = { workspaceId: "workspace-1", projectId: "project-1" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as Record<string, unknown>),
    useParams: () => routeParams,
    useSearch: () => ({ taskId: undefined }),
  }),
  useNavigate: () => navigate,
}));

const useGetTasks = vi.fn();
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: (projectId: string) => useGetTasks(projectId),
}));

const getProjectTaskRelationsMock = vi.fn((_projectId: string) => ({
  data: [] as unknown[],
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: (projectId: string) => getProjectTaskRelationsMock(projectId),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (state: { weekStartsOn: number }) => unknown,
  ) => selector({ weekStartsOn: 0 }),
}));

vi.mock("@/components/common/project-layout", () => ({
  default: ({
    children,
    toolbar,
  }: {
    children: ReactNode;
    toolbar?: ReactNode;
  }) => (
    <div>
      {toolbar}
      {children}
    </div>
  ),
}));

vi.mock("@/hooks/queries/task/use-description-matches", () => ({
  useDescriptionMatches: () => ({
    ids: new Set<string>(),
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/components/project/task-filters/use-task-filter-options", () => ({
  useTaskFilterOptions: () => ({
    members: [],
    labels: [],
    customFields: [],
    usedCustomFieldValues: {},
  }),
}));

const noCustomFieldValues = () => [];
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-all-custom-field-values-by-project",
  () => ({
    default: () => ({ getValuesForTask: noCustomFieldValues }),
  }),
);

vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));

vi.mock("@/components/page-title", () => ({
  default: () => null,
}));

vi.mock("@/components/gantt/gantt-task-bar", () => ({
  GanttTaskBar: ({
    task,
    isSummary,
    isMilestone,
    swatch,
  }: {
    task: { title: string };
    isSummary?: boolean;
    isMilestone?: boolean;
    swatch?: { fill: string };
  }) => (
    <div
      data-testid="gantt-bar-mock"
      data-summary={isSummary ? "true" : "false"}
      data-milestone={isMilestone ? "true" : "false"}
      data-fill={swatch?.fill ?? ""}
    >
      {task.title}
    </div>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const [namespace, path] = key.split(":");
      const source = path
        .split(".")
        .reduce<unknown>(
          (accumulator, part) =>
            (accumulator as Record<string, unknown> | undefined)?.[part],
          (enUS as Record<string, unknown>)[namespace],
        );

      if (typeof source !== "string") return key;

      return source.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(options?.[name] ?? `{{${name}}}`),
      );
    },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const GanttRoute = (Route as unknown as { component: ComponentType }).component;

function searchFor(value: string) {
  const existing = screen.queryByRole("searchbox", { name: "Search tasks" });
  if (!existing) {
    fireEvent.click(screen.getByRole("button", { name: "Search tasks" }));
  }
  fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
    target: { value },
  });
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Task",
    number: 1,
    description: null,
    status: "in-progress",
    priority: null,
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    ...overrides,
  };
}

function mockProjectWithTasks(
  tasks: Task[],
  overrides: { id?: string; name?: string } = {},
) {
  useGetTasks.mockReturnValue({
    data: {
      id: overrides.id ?? "project-1",
      name: overrides.name ?? "Roadmap",
      slug: "RM",
      columns: [{ id: "col-1", name: "In Progress", tasks }],
      plannedTasks: [],
      archivedTasks: [],
    },
  });
}

function mockProjectWithTask(
  task: Task,
  overrides: { id?: string; name?: string } = {},
) {
  mockProjectWithTasks([task], overrides);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 31));
  getProjectTaskRelationsMock.mockReturnValue({ data: [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  scrollIntoView.mockClear();
  useGetTasks.mockReset();
  routeParams.projectId = "project-1";
});

describe("Gantt jump-to-today", () => {
  it("centers a new project after a search stops hiding its timeline", () => {
    mockProjectWithTask(
      makeTask({
        title: "First task",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );
    const { rerender } = render(<GanttRoute />);
    searchFor("no match");
    routeParams.projectId = "project-2";
    mockProjectWithTask(
      makeTask({
        title: "Second task",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
      { id: "project-2" },
    );
    rerender(<GanttRoute />);

    searchFor("");

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );
  });

  it("disables the button and never auto-scrolls when no task falls near today", () => {
    mockProjectWithTask(
      makeTask({
        id: "past-task",
        title: "Old milestone",
        startDate: "2026-05-01",
        dueDate: "2026-05-03",
      }),
    );

    render(<GanttRoute />);

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).toBeDisabled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("auto-centers on today and re-centers on demand when today is in range", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    render(<GanttRoute />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "smooth", inline: "center" }),
    );
  });

  it("re-arms auto-centering after switching to a different project on the same route", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    const { rerender } = render(<GanttRoute />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    routeParams.projectId = "project-2";
    mockProjectWithTask(
      makeTask({
        id: "other-project-task",
        title: "Other project's work",
        startDate: "2026-08-30",
        dueDate: "2026-09-03",
      }),
      { id: "project-2", name: "Other roadmap" },
    );

    rerender(<GanttRoute />);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );
  });

  it("disables the button once a search filters out every task, even with today in range", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    render(<GanttRoute />);

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).not.toBeDisabled();

    searchFor("no such task");

    expect(
      screen.getByText("No tasks match your search or filters."),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("insets scroll-alignment by the task rail's width so a scrollIntoView center lands in the visible timeline", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    render(<GanttRoute />);

    const container = screen.getByTestId("gantt-scroll-container");
    expect(container.style.scrollPaddingLeft).toBe("34rem");
  });
});

describe("Gantt hierarchy, zoom and coloring", () => {
  it("renders WBS hierarchy, supports collapse/expand all, and uses smart months zoom for multi-month spans", () => {
    mockProjectWithTasks([
      makeTask({
        id: "phase-1",
        title: "Fase 1",
        position: 1,
        startDate: "2026-12-01",
        dueDate: "2026-12-15",
      }),
      makeTask({
        id: "sub-1",
        title: "Subtarea 1",
        position: 1,
        startDate: "2026-12-01",
        dueDate: "2026-12-10",
      }),
      makeTask({
        id: "milestone-1",
        title: "Hito final",
        position: 2,
        startDate: "2027-03-10",
        dueDate: "2027-03-10",
      }),
    ]);
    getProjectTaskRelationsMock.mockReturnValue({
      data: [
        {
          id: "rel-1",
          sourceTaskId: "phase-1",
          targetTaskId: "sub-1",
          relationType: "subtask",
        },
      ],
    });

    render(<GanttRoute />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("1.1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Milestone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Months" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const bars = screen.getAllByTestId("gantt-bar-mock");
    expect(bars[0]).toHaveAttribute("data-summary", "true");
    expect(bars[2]).toHaveAttribute("data-milestone", "true");

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("1.1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("1.1")).toBeInTheDocument();
  });

  it("switches zoom levels manually when user clicks Weeks or Days", () => {
    mockProjectWithTask(
      makeTask({
        id: "t-1",
        title: "Multi-month task",
        startDate: "2026-12-01",
        dueDate: "2027-03-15",
      }),
    );

    render(<GanttRoute />);

    expect(screen.getByRole("button", { name: "Months" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Weeks" }));
    expect(screen.getByRole("button", { name: "Weeks" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Days" }));
    expect(screen.getByRole("button", { name: "Days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

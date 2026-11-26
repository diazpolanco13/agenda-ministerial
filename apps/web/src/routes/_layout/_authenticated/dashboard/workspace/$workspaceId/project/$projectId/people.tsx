import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { DisplaySection } from "@/components/project/display/display-section";
import { PeopleView } from "@/components/project/people/people-view";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import { useGoToProjectView } from "@/components/project/views/use-go-to-project-view";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { countColumnTasks } from "@/lib/task-filters/count-tasks";

type PeopleSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/people",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): PeopleSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useGetTasks(projectId);
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "board",
  });
  const goToView = useGoToProjectView({
    workspaceId,
    projectId,
    currentRoute: "people",
  });

  const shownCount = useMemo(
    () => countColumnTasks(view.filters.filteredProject),
    [view.filters.filteredProject],
  );
  const totalCount = useMemo(() => countColumnTasks(project), [project]);

  const handleOpenTask = useCallback(
    (nextTaskId: string) => {
      navigate({ to: ".", search: { taskId: nextTaskId }, replace: true });
    },
    [navigate],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const handleViewInGantt = useCallback(
    (userId: string) => {
      const storageKey = `kaneo:board-filters:${projectId}`;
      try {
        const raw = window.localStorage.getItem(storageKey);
        const existing = raw ? (JSON.parse(raw) as unknown) : {};
        const base =
          existing && typeof existing === "object" && !Array.isArray(existing)
            ? existing
            : {};
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ ...base, assignee: [userId] }),
        );
      } catch {
        // Storage may be unavailable; continue navigating to Gantt.
      }
      goToView("gantt");
    },
    [goToView, projectId],
  );

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="people"
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <DisplaySection>
              <LayoutSwitch
                workspaceId={workspaceId}
                projectId={projectId}
                currentRoute="people"
                currentView="people"
              />
            </DisplaySection>
          }
        />
      }
      summary={<TaskCount shown={shownCount} total={totalCount} />}
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={view.filters.clearFilters}
          customFieldValues={view.filters.customFieldValues}
        />
      }
    >
      <PageTitle
        title={
          project
            ? t("tasks:people.pageTitle", { name: project.name })
            : undefined
        }
      />

      <PeopleView
        project={project}
        filteredProject={view.filters.filteredProject}
        workspaceId={workspaceId}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={view.filters.hasActiveFilters || !!view.search}
        onOpenTask={handleOpenTask}
        onViewInGantt={handleViewInGantt}
      />

      <TaskDetailsSheet
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={handleCloseTaskSheet}
      />
    </ProjectLayout>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { DisplaySection } from "@/components/project/display/display-section";
import { WeekStartControl } from "@/components/project/display/week-start-control";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import { WorkloadView } from "@/components/project/workload/workload-view";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { countColumnTasks } from "@/lib/task-filters/count-tasks";

type WorkloadSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/workload",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): WorkloadSearchParams => ({
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

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="workload"
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <>
              <DisplaySection>
                <LayoutSwitch
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute="workload"
                  currentView="workload"
                />
              </DisplaySection>
              <DisplaySection>
                <WeekStartControl />
              </DisplaySection>
            </>
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
            ? t("tasks:workload.pageTitle", { name: project.name })
            : undefined
        }
      />

      <WorkloadView
        project={project}
        filteredProject={view.filters.filteredProject}
        workspaceId={workspaceId}
        isLoading={isLoading}
        isError={isError}
        hasActiveFilters={view.filters.hasActiveFilters || !!view.search}
        onOpenTask={handleOpenTask}
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

import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrialExpiredCallout } from "@/components/billing/trial-expired-callout";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { AgendaTodayCard } from "@/components/executive/agenda-today-card";
import { CommandHeader } from "@/components/executive/command-header";
import { CompactActivityCard } from "@/components/executive/compact-activity-card";
import { DailyBriefCard } from "@/components/executive/daily-brief-card";
import { KpiStrip } from "@/components/executive/kpi-strip";
import { RecentOrdersCard } from "@/components/executive/recent-orders-card";
import { TopResponsablesCard } from "@/components/executive/top-responsables-card";
import { HomeProjects } from "@/components/home/home-projects";
import PageTitle from "@/components/page-title";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { Button } from "@/components/ui/button";
import { useExecutiveSummary } from "@/hooks/queries/executive/use-executive-summary";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const executiveQuery = useExecutiveSummary(workspaceId);
  const { data: projects } = useGetProjects({ workspaceId }, true);
  const { canCreateTasks, canCreateProjects } = useWorkspacePermission();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const needsProjectFirst = projects?.length === 0 && canCreateProjects();
  const openCreateProject = canCreateProjects()
    ? () => setIsCreateProjectOpen(true)
    : undefined;

  const summary = executiveQuery.data;

  return (
    <>
      <PageTitle title={t("workspace:home.pageTitle")} />
      <WorkspaceLayout title={t("workspace:home.pageTitle")}>
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <TrialExpiredCallout workspaceId={workspaceId} className="m-4" />
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <CommandHeader
              workspaceId={workspaceId}
              usuario={summary?.usuario}
              isLoading={executiveQuery.isLoading}
              canCreateTasks={canCreateTasks()}
              needsProjectFirst={needsProjectFirst}
              onCreateTask={() =>
                needsProjectFirst
                  ? setIsCreateProjectOpen(true)
                  : setIsCreateTaskOpen(true)
              }
            />

            {executiveQuery.isError && !summary ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
              >
                <span className="text-foreground">
                  No se pudo cargar el Panel de Mando.
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void executiveQuery.refetch()}
                >
                  <RefreshCw />
                  Reintentar
                </Button>
              </div>
            ) : null}

            <KpiStrip
              kpis={summary?.kpis}
              isLoading={executiveQuery.isLoading}
            />

            <DailyBriefCard workspaceId={workspaceId} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                <RecentOrdersCard
                  workspaceId={workspaceId}
                  items={summary?.ordenesRecientes}
                  isLoading={executiveQuery.isLoading}
                  isError={executiveQuery.isError}
                />
                <AgendaTodayCard
                  workspaceId={workspaceId}
                  items={summary?.agendaHoy}
                  isLoading={executiveQuery.isLoading}
                  isError={executiveQuery.isError}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                <TopResponsablesCard
                  items={summary?.topResponsables}
                  isLoading={executiveQuery.isLoading}
                  isError={executiveQuery.isError}
                />
                <CompactActivityCard
                  workspaceId={workspaceId}
                  items={summary?.actividadCompacta}
                  isLoading={executiveQuery.isLoading}
                  isError={executiveQuery.isError}
                />
              </div>
            </div>

            <HomeProjects
              workspaceId={workspaceId}
              onCreateProject={openCreateProject}
            />
          </div>
        </div>
      </WorkspaceLayout>

      <CreateTaskModal
        open={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
      />
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}

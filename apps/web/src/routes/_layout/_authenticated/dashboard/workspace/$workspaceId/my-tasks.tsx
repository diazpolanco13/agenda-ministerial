import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  CheckCircle2,
  GanttChartSquare,
  LayoutGrid,
  List,
  Send,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { MyTasksBoardView } from "@/components/my-tasks/my-tasks-board-view";
import { MyTasksBulkBar } from "@/components/my-tasks/my-tasks-bulk-bar";
import { MyTasksCalendarView } from "@/components/my-tasks/my-tasks-calendar-view";
import { MyTasksDelegatedView } from "@/components/my-tasks/my-tasks-delegated-view";
import { MyTasksFilterBar } from "@/components/my-tasks/my-tasks-filter-bar";
import {
  computeSegmentCounts,
  DEFAULT_MY_TASKS_FILTERS,
  filterMyTasks,
  type MyTasksFilterState,
  type MyTasksGroupBy,
  type MyTasksScope,
  type MyTasksViewMode,
} from "@/components/my-tasks/my-tasks-filters";
import type { WorkspaceMemberOption } from "@/components/my-tasks/my-tasks-inline-row";
import { MyTasksKpiStrip } from "@/components/my-tasks/my-tasks-kpi-strip";
import { MyTasksListView } from "@/components/my-tasks/my-tasks-list-view";
import { MyTasksSegments } from "@/components/my-tasks/my-tasks-segments";
import { MyTasksTimelineView } from "@/components/my-tasks/my-tasks-timeline-view";
import { useMyTasksShortcuts } from "@/components/my-tasks/use-my-tasks-shortcuts";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import { useGetDelegatedTasks } from "@/hooks/queries/task/use-get-delegated-tasks";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
});

const VIEW_TABS: ReadonlyArray<{
  id: MyTasksViewMode;
  label: string;
  shortcut: string;
  icon: typeof List;
}> = [
  { id: "list", label: "Lista", shortcut: "1", icon: List },
  { id: "board", label: "Tablero", shortcut: "2", icon: LayoutGrid },
  { id: "calendar", label: "Calendario", shortcut: "3", icon: Calendar },
  {
    id: "timeline",
    label: "Línea de tiempo",
    shortcut: "4",
    icon: GanttChartSquare,
  },
];

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const day = useLocalDay();

  const [scope, setScope] = useState<MyTasksScope>("assigned");
  const [viewMode, setViewMode] = useState<MyTasksViewMode>("list");
  const [groupBy, setGroupBy] = useState<MyTasksGroupBy>("dueDate");
  const [filters, setFilters] = useState<MyTasksFilterState>(
    DEFAULT_MY_TASKS_FILTERS,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [activeDetailTask, setActiveDetailTask] = useState<{
    id: string;
    projectId: string;
    workspaceId: string;
  } | null>(null);

  const {
    data: assigned,
    isLoading: assignedLoading,
    isError: assignedError,
  } = useGetAssignedTasks(workspaceId, false, {
    includeCompleted: true,
    allWorkspaces: filters.allWorkspaces,
  });

  const {
    data: delegated,
    isLoading: delegatedLoading,
    isError: delegatedError,
  } = useGetDelegatedTasks(
    workspaceId,
    {
      includeCompleted: true,
      allWorkspaces: filters.allWorkspaces,
    },
    scope === "delegated",
  );

  const { data: workspacesData } = useGetWorkspaces();
  const { data: workspaceUsersData } = useGetActiveWorkspaceUsers(workspaceId);

  const workspaces = useMemo(() => {
    const raw = Array.isArray(workspacesData) ? workspacesData : [];
    return raw.map((w) => ({ id: w.id, name: w.name }));
  }, [workspacesData]);

  const workspaceMembers = useMemo<WorkspaceMemberOption[]>(() => {
    const raw = Array.isArray(workspaceUsersData)
      ? workspaceUsersData
      : ((workspaceUsersData as { members?: unknown[] } | undefined)?.members ??
        []);
    const out: WorkspaceMemberOption[] = [];
    for (const entry of raw as Array<{
      userId?: string;
      user?: {
        id?: string;
        name?: string | null;
        image?: string | null;
        militar?: {
          cedula?: string | null;
          grado?: string | null;
          componente?: string | null;
          unidad?: string | null;
        } | null;
      };
    }>) {
      const uid = entry.user?.id ?? entry.userId;
      if (!uid) continue;
      out.push({
        userId: uid,
        name: entry.user?.name ?? "Sin nombre",
        image: entry.user?.image ?? null,
        cedula: entry.user?.militar?.cedula ?? null,
        grado: entry.user?.militar?.grado ?? null,
        componente: entry.user?.militar?.componente ?? null,
        unidad: entry.user?.militar?.unidad ?? null,
      });
    }
    return out;
  }, [workspaceUsersData]);

  const assignedTasks = assigned?.tasks ?? [];
  const delegatedTasks = delegated?.tasks ?? [];
  const activeSourceTasks =
    scope === "delegated" ? delegatedTasks : assignedTasks;

  const segmentCounts = useMemo(
    () => computeSegmentCounts(activeSourceTasks, new Date(day)),
    [activeSourceTasks, day],
  );

  const filteredAssigned = useMemo(
    () => filterMyTasks(assignedTasks, filters, new Date(day)),
    [assignedTasks, filters, day],
  );

  const filteredDelegated = useMemo(
    () => filterMyTasks(delegatedTasks, filters, new Date(day)),
    [delegatedTasks, filters, day],
  );

  const columnsByProject = useMemo(
    () => ({
      ...(assigned?.columnsByProject ?? {}),
      ...(delegated?.columnsByProject ?? {}),
    }),
    [assigned?.columnsByProject, delegated?.columnsByProject],
  );

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredAssigned.map((task) => task.id)));
  }, [filteredAssigned]);

  const handleOpenDetail = useCallback(
    (taskId: string) => {
      const task =
        assignedTasks.find((item) => item.id === taskId) ??
        delegatedTasks.find((item) => item.id === taskId);
      if (!task) return;
      setFocusedTaskId(task.id);
      setActiveDetailTask({
        id: task.id,
        projectId: task.projectId,
        workspaceId: task.workspaceId ?? workspaceId,
      });
    },
    [assignedTasks, delegatedTasks, workspaceId],
  );

  useMyTasksShortcuts({
    enabled: scope === "assigned" && !activeDetailTask,
    taskIds: filteredAssigned.map((t) => t.id),
    focusedTaskId,
    setFocusedTaskId,
    toggleSelect,
    onOpenDetail: handleOpenDetail,
    onChangeView: setViewMode,
  });

  const isLoading =
    scope === "delegated" ? delegatedLoading : assignedLoading;
  const isError =
    scope === "delegated"
      ? delegatedError && !delegated
      : assignedError && !assigned;

  return (
    <>
      <PageTitle title={t("workspace:myTasks.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:myTasks.pageTitle")}
        headerActions={
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Scope switch: Asignadas a mí vs Delegadas */}
            <div
              role="tablist"
              aria-label="Ámbito de tareas"
              className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === "assigned"}
                data-testid="scope-assigned"
                onClick={() => setScope("assigned")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  scope === "assigned"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Mis tareas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === "delegated"}
                data-testid="scope-delegated"
                onClick={() => {
                  setScope("delegated");
                  clearSelection();
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  scope === "delegated"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Send className="size-3" />
                <span>Delegadas</span>
              </button>
            </div>

            {/* View mode tabs (Lista / Tablero / Calendario / Línea de tiempo) */}
            {scope === "assigned" && (
              <div
                role="tablist"
                aria-label="Vistas de Mis tareas"
                className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5"
              >
                {VIEW_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = viewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={`view-${tab.id}`}
                      title={`${tab.label} (atajo ${tab.shortcut})`}
                      onClick={() => setViewMode(tab.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                        active
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span className="hidden lg:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {scope === "assigned" && (
            <MyTasksKpiStrip
              kpis={assigned?.kpis}
              activeSegment={filters.segment}
              onSelectSegment={(segment) =>
                setFilters((prev) => ({ ...prev, segment }))
              }
            />
          )}

          <MyTasksSegments
            value={filters.segment}
            counts={segmentCounts}
            onChange={(segment) => setFilters((prev) => ({ ...prev, segment }))}
          />

          <MyTasksFilterBar
            workspaceId={workspaceId}
            scope={scope}
            viewMode={viewMode}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            filters={filters}
            onFiltersChange={setFilters}
            tasks={activeSourceTasks}
            workspaces={workspaces}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col px-4">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="flex h-11 items-center gap-3 border-border/50 border-b px-1"
                  >
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-3.5 flex-1" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p role="alert" className="p-6 text-sm text-muted-foreground">
                {t("workspace:myWork.loadError")}
              </p>
            ) : scope === "delegated" ? (
              <MyTasksDelegatedView
                tasks={filteredDelegated}
                onOpenDetail={handleOpenDetail}
              />
            ) : filteredAssigned.length === 0 ? (
              <Empty className="min-h-[45vh]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CheckCircle2 />
                  </EmptyMedia>
                  <EmptyTitle>
                    {assignedTasks.length === 0
                      ? t("workspace:myWork.empty")
                      : "Sin tareas en este filtro"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {assignedTasks.length === 0
                      ? t("workspace:myTasks.emptyDescription")
                      : "Prueba cambiando el segmento o limpiando los filtros activos."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : viewMode === "list" ? (
              <MyTasksListView
                tasks={filteredAssigned}
                total={assigned?.total ?? filteredAssigned.length}
                groupBy={groupBy}
                columnsByProject={columnsByProject}
                workspaceMembers={workspaceMembers}
                selectedTaskIds={selectedIds}
                focusedTaskId={focusedTaskId}
                onToggleSelect={toggleSelect}
                onOpenDetail={handleOpenDetail}
              />
            ) : viewMode === "board" ? (
              <MyTasksBoardView
                tasks={filteredAssigned}
                columnsByProject={columnsByProject}
                selectedTaskIds={selectedIds}
                onToggleSelect={toggleSelect}
                onOpenDetail={handleOpenDetail}
              />
            ) : viewMode === "calendar" ? (
              <MyTasksCalendarView
                tasks={filteredAssigned}
                onOpenDetail={handleOpenDetail}
              />
            ) : (
              <MyTasksTimelineView
                tasks={filteredAssigned}
                onOpenDetail={handleOpenDetail}
              />
            )}
          </div>
        </div>

        {scope === "assigned" && (
          <MyTasksBulkBar
            workspaceId={workspaceId}
            selectedTaskIds={selectedIds}
            clearSelection={clearSelection}
            selectAll={selectAllVisible}
            columnsByProject={columnsByProject}
            workspaceMembers={workspaceMembers}
          />
        )}

        <TaskDetailsSheet
          taskId={activeDetailTask?.id}
          projectId={activeDetailTask?.projectId ?? ""}
          workspaceId={activeDetailTask?.workspaceId ?? workspaceId}
          onClose={() => setActiveDetailTask(null)}
        />
      </WorkspaceLayout>
    </>
  );
}

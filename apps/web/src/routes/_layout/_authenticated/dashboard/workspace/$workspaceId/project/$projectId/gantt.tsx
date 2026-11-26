import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addDays,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  type Locale,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import { GanttDependencyArrows } from "@/components/gantt/gantt-dependency-arrows";
import {
  buildGanttHierarchy,
  type GanttRelation,
  type GanttRow,
  type GanttTaskLike,
} from "@/components/gantt/gantt-hierarchy";
import { GanttTaskBar } from "@/components/gantt/gantt-task-bar";
import {
  buildGanttTimeline,
  GANTT_ZOOM_CONFIG,
  type GanttZoom,
  parseTaskDate,
  resolveSmartGanttZoom,
} from "@/components/gantt/timeline";
import PageTitle from "@/components/page-title";
import { DisplaySection } from "@/components/project/display/display-section";
import { WeekStartControl } from "@/components/project/display/week-start-control";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type AgendaColorSwatch,
  getAssigneeColor,
  getGroupColor,
  getPriorityColor,
  getStatusColor,
} from "@/lib/agenda-palette";
import { cn } from "@/lib/cn";
import { getPriorityLabel, getStatusLabel } from "@/lib/i18n/domain";
import { useUserPreferencesStore } from "@/store/user-preferences";

type GanttSearchParams = {
  taskId?: string;
};

type GanttColorMode = "group" | "status" | "priority" | "assignee";

const TASK_RAIL_WIDTH_DESKTOP_REM = 34;
const TASK_RAIL_WIDTH_MOBILE_REM = 14;
const ROW_HEIGHT_PX = 44;

type TimelineSegment = {
  key: string;
  label: string;
  days: number;
};

function groupTimelineDays(
  days: Date[],
  getKey: (day: Date) => string,
  getLabel: (day: Date) => string,
): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  for (const day of days) {
    const key = getKey(day);
    const last = segments[segments.length - 1];
    if (last && last.key === key) {
      last.days += 1;
    } else {
      segments.push({ key, label: getLabel(day), days: 1 });
    }
  }
  return segments;
}

function escapeCsvCell(value: string): string {
  const safe = value.replaceAll('"', '""');
  return `"${safe}"`;
}

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): GanttSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const dateLocale: Locale | undefined = i18n?.language?.startsWith("es")
    ? es
    : undefined;
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project } = useGetTasks(projectId);
  const { data: relationsData } = useGetProjectTaskRelations(projectId);
  const { data: workspaceUsersData } = useGetActiveWorkspaceUsers(workspaceId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "schedule",
  });
  const filteredProject = view.filters.filteredProject;

  const [windowStart, setWindowStart] = useState<{
    projectId: string;
    date: Date;
  } | null>(null);
  const requestedStart =
    windowStart && windowStart.projectId === projectId
      ? windowStart.date
      : null;
  const showDate = (date: Date) => setWindowStart({ projectId, date });

  const [userZoom, setUserZoom] = useState<{
    projectId: string;
    zoom: GanttZoom;
  } | null>(null);
  const [colorMode, setColorMode] = useState<GanttColorMode>("group");
  const [collapsedByProject, setCollapsedByProject] = useState<{
    projectId: string;
    ids: Set<string>;
  }>({ projectId, ids: new Set() });

  const collapsedIds = useMemo(
    () =>
      collapsedByProject.projectId === projectId
        ? collapsedByProject.ids
        : new Set<string>(),
    [collapsedByProject, projectId],
  );

  const isMobile = useIsMobile();
  const [isTaskRailOpen, setIsTaskRailOpen] = useState(false);

  const taskColumnWidthRem = isMobile
    ? TASK_RAIL_WIDTH_MOBILE_REM
    : TASK_RAIL_WIDTH_DESKTOP_REM;
  const showTaskRail = !isMobile || isTaskRailOpen;
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);
  const todayCellRef = useRef<HTMLDivElement>(null);

  const hasCenteredOnTodayRef = useRef(false);
  const previousProjectIdRef = useRef(projectId);
  if (previousProjectIdRef.current !== projectId) {
    previousProjectIdRef.current = projectId;
    hasCenteredOnTodayRef.current = false;
  }

  useEffect(() => {
    if (!isMobile) {
      setIsTaskRailOpen(true);
      return;
    }

    setIsTaskRailOpen(false);
  }, [isMobile]);

  const memberByUserId = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string | null; image: string | null }
    >();
    const rawMembers = Array.isArray(workspaceUsersData)
      ? workspaceUsersData
      : ((workspaceUsersData as { members?: unknown[] } | undefined)?.members ??
        []);
    for (const entry of rawMembers as Array<{
      userId?: string;
      user?: { id?: string; name?: string | null; image?: string | null };
    }>) {
      const uid = entry.user?.id ?? entry.userId;
      if (!uid) continue;
      map.set(uid, {
        id: uid,
        name: entry.user?.name ?? null,
        image: entry.user?.image ?? null,
      });
    }
    return map;
  }, [workspaceUsersData]);

  const allTasks = useMemo(
    () => [
      ...(project?.columns.flatMap((column) => column.tasks) ?? []),
      ...(project?.plannedTasks ?? []),
    ],
    [project],
  );

  const parsedTasks = useMemo(() => {
    const items: GanttTaskLike[] = [];
    for (const task of allTasks) {
      const parsedStart =
        parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
      const parsedEnd =
        parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

      if (!parsedStart || !parsedEnd) continue;

      const start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
      const end = parsedEnd >= parsedStart ? parsedEnd : parsedStart;
      const member = task.assigneeId
        ? memberByUserId.get(task.assigneeId)
        : undefined;

      items.push({
        ...task,
        assigneeName: task.assigneeName ?? member?.name ?? null,
        assigneeImage: task.assigneeImage ?? member?.image ?? null,
        scheduleStart: start,
        scheduleEnd: end,
      });
    }
    return items.sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime(),
    );
  }, [allTasks, memberByUserId]);

  const scheduledTasks = useMemo(() => {
    const visibleIds = new Set(
      [
        ...(filteredProject?.columns.flatMap((column) => column.tasks) ?? []),
        ...(filteredProject?.plannedTasks ?? []),
      ].map((task) => task.id),
    );
    return parsedTasks.filter((task) => visibleIds.has(task.id));
  }, [parsedTasks, filteredProject]);

  const relations = useMemo<GanttRelation[]>(
    () => (Array.isArray(relationsData) ? relationsData : []),
    [relationsData],
  );

  const columnsMeta = useMemo(
    () =>
      (project?.columns ?? []).map((col) => ({
        slug: (col as { slug?: string }).slug,
        isFinal: (col as { isFinal?: boolean }).isFinal,
      })),
    [project],
  );

  const hierarchy = useMemo(
    () =>
      buildGanttHierarchy(scheduledTasks, relations, columnsMeta, collapsedIds),
    [scheduledTasks, relations, columnsMeta, collapsedIds],
  );

  const smartZoom = useMemo(
    () => resolveSmartGanttZoom(parsedTasks),
    [parsedTasks],
  );
  const activeZoom: GanttZoom =
    userZoom && userZoom.projectId === projectId ? userZoom.zoom : smartZoom;

  const zoomConfig = GANTT_ZOOM_CONFIG[activeZoom];
  const dayColumnWidthRem = isMobile
    ? zoomConfig.mobileDayColumnWidthRem
    : zoomConfig.dayColumnWidthRem;

  const timeline = useMemo(
    () =>
      buildGanttTimeline(
        parsedTasks,
        weekStartsOn,
        dayColumnWidthRem,
        requestedStart,
        new Date(),
        zoomConfig.maxWindowDays,
      ),
    [
      parsedTasks,
      weekStartsOn,
      dayColumnWidthRem,
      requestedStart,
      zoomConfig.maxWindowDays,
    ],
  );

  const todayIndex = useMemo(
    () => timeline?.days.findIndex((day) => isToday(day)) ?? -1,
    [timeline],
  );
  const todayInRange = todayIndex >= 0;

  const scrollPaddingLeftRem = showTaskRail ? taskColumnWidthRem : 0;

  const scrollToToday = useCallback((behavior: ScrollBehavior = "smooth") => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    todayCellRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : behavior,
      inline: "center",
      block: "nearest",
    });
  }, []);

  useLayoutEffect(() => {
    const element = timelineTrackRef.current;
    if (!element || !timeline) return;

    const update = () => {
      const count = timeline.days.length;
      if (count <= 0) return;
      const measured = element.clientWidth / count;
      if (measured > 0) {
        setPixelsPerDay(measured);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [timeline]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- projectId is intentionally listed to force a re-run on project switch.
  useLayoutEffect(() => {
    if (
      hasCenteredOnTodayRef.current ||
      !todayInRange ||
      scheduledTasks.length === 0 ||
      !todayCellRef.current
    )
      return;
    hasCenteredOnTodayRef.current = true;
    scrollToToday("auto");
  }, [todayInRange, scrollToToday, projectId, scheduledTasks.length]);

  const finalStatusSet = useMemo(() => {
    const set = new Set<string>();
    for (const col of columnsMeta) {
      if (col.isFinal && col.slug) set.add(col.slug);
    }
    return set;
  }, [columnsMeta]);

  const getRowSwatch = useCallback(
    (row: GanttRow): AgendaColorSwatch => {
      switch (colorMode) {
        case "group":
          return getGroupColor(row.groupIndex);
        case "status":
          return getStatusColor(
            row.task.status,
            finalStatusSet.has(row.task.status),
          );
        case "priority":
          return getPriorityColor(row.task.priority);
        case "assignee":
          return getAssigneeColor(
            row.task.assigneeId || row.task.assigneeName || "unassigned",
          );
      }
    },
    [colorMode, finalStatusSet],
  );

  const legendItems = useMemo(() => {
    if (hierarchy.visibleRows.length === 0) return [];
    const seen = new Map<
      string,
      { label: string; swatch: AgendaColorSwatch }
    >();

    for (const row of hierarchy.visibleRows) {
      if (colorMode === "group") {
        if (row.depth === 0) {
          const key = `g-${row.groupIndex}`;
          if (!seen.has(key)) {
            seen.set(key, {
              label: `${row.wbs}. ${row.task.title}`,
              swatch: getGroupColor(row.groupIndex),
            });
          }
        }
      } else if (colorMode === "status") {
        const key = row.task.status;
        if (!seen.has(key)) {
          seen.set(key, {
            label: getStatusLabel(key),
            swatch: getStatusColor(key, finalStatusSet.has(key)),
          });
        }
      } else if (colorMode === "priority") {
        const key = row.task.priority ?? "no-priority";
        if (!seen.has(key)) {
          seen.set(key, {
            label: getPriorityLabel(key),
            swatch: getPriorityColor(row.task.priority),
          });
        }
      } else if (colorMode === "assignee") {
        const key =
          row.task.assigneeId || row.task.assigneeName || "unassigned";
        if (!seen.has(key)) {
          seen.set(key, {
            label: row.task.assigneeName ?? t("tasks:gantt.unassigned"),
            swatch: getAssigneeColor(key),
          });
        }
      }
      if (seen.size >= 6) break;
    }

    return Array.from(seen.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }, [colorMode, finalStatusSet, hierarchy.visibleRows, t]);

  const toggleCollapse = useCallback(
    (taskIdToToggle: string) => {
      setCollapsedByProject((prev) => {
        const base =
          prev.projectId === projectId ? new Set(prev.ids) : new Set<string>();
        if (base.has(taskIdToToggle)) {
          base.delete(taskIdToToggle);
        } else {
          base.add(taskIdToToggle);
        }
        return { projectId, ids: base };
      });
    },
    [projectId],
  );

  const handleExpandAll = useCallback(() => {
    setCollapsedByProject({ projectId, ids: new Set() });
  }, [projectId]);

  const handleCollapseAll = useCallback(() => {
    setCollapsedByProject({
      projectId,
      ids: new Set(hierarchy.parentIds),
    });
  }, [hierarchy.parentIds, projectId]);

  const handleZoomChange = useCallback(
    (nextZoom: GanttZoom) => {
      setUserZoom({ projectId, zoom: nextZoom });
      setWindowStart(null);
    },
    [projectId],
  );

  const handleExportCsv = useCallback(() => {
    const header = [
      t("tasks:gantt.colNumber"),
      t("tasks:gantt.colName"),
      t("tasks:statusLabel", { defaultValue: "Estado" }),
      t("tasks:priorityLabel", { defaultValue: "Prioridad" }),
      t("tasks:gantt.colAssignee"),
      "Inicio",
      "Fin",
      t("tasks:gantt.colDuration"),
    ];
    const rows = hierarchy.allRows.map((row) => [
      row.wbs,
      row.task.title,
      getStatusLabel(row.task.status),
      row.task.priority ? getPriorityLabel(row.task.priority) : "",
      row.task.assigneeName ?? t("tasks:gantt.unassigned"),
      format(row.scheduleStart, "yyyy-MM-dd"),
      format(row.scheduleEnd, "yyyy-MM-dd"),
      row.isMilestone
        ? t("tasks:gantt.milestone")
        : t("tasks:gantt.daysShort", { count: row.durationDays }),
    ]);
    const csvContent =
      "\uFEFF" +
      [header, ...rows]
        .map((cols) =>
          cols.map((cell) => escapeCsvCell(String(cell))).join(","),
        )
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gantt-${project?.slug?.toLowerCase() ?? "proyecto"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [hierarchy.allRows, project?.slug, t]);

  const yearSegments = useMemo(
    () =>
      timeline
        ? groupTimelineDays(
            timeline.days,
            (d) => format(d, "yyyy"),
            (d) => format(d, "yyyy"),
          )
        : [],
    [timeline],
  );

  const monthSegments = useMemo(
    () =>
      timeline
        ? groupTimelineDays(
            timeline.days,
            (d) => format(d, "yyyy-MM"),
            (d) => format(d, "MMM", { locale: dateLocale }),
          )
        : [],
    [dateLocale, timeline],
  );

  const todayPercent =
    timeline && todayIndex >= 0
      ? ((todayIndex + 0.5) / timeline.days.length) * 100
      : null;

  const hasParents = hierarchy.parentIds.size > 0;

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="gantt"
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <>
              <DisplaySection>
                <LayoutSwitch
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute="gantt"
                  currentView="gantt"
                />
              </DisplaySection>
              <DisplaySection>
                <WeekStartControl />
              </DisplaySection>
            </>
          }
        />
      }
      summary={
        <TaskCount shown={scheduledTasks.length} total={parsedTasks.length} />
      }
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
            ? t("tasks:gantt.pageTitle", { name: project.name })
            : undefined
        }
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="border-b border-border/80 px-3 py-2 print:hidden sm:px-4">
          <h1 className="sr-only">{t("tasks:gantt.title")}</h1>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                disabled={!hasParents}
                onClick={handleExpandAll}
              >
                <ChevronsUpDown className="size-3.5" />
                <span className="hidden md:inline">
                  {t("tasks:gantt.expandAll")}
                </span>
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={!hasParents}
                onClick={handleCollapseAll}
              >
                <ChevronsDownUp className="size-3.5" />
                <span className="hidden md:inline">
                  {t("tasks:gantt.collapseAll")}
                </span>
              </Button>

              <span className="mx-0.5 hidden h-4 w-px bg-border sm:inline-block" />

              <div className="flex items-center gap-1.5">
                <span className="hidden text-xs text-muted-foreground lg:inline">
                  {t("tasks:gantt.colorBy")}:
                </span>
                <Select
                  value={colorMode}
                  onValueChange={(value) => {
                    if (value) setColorMode(value as GanttColorMode);
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={t("tasks:gantt.colorBy")}
                    className="h-7 min-w-[7.5rem] text-xs"
                  >
                    <SelectValue>
                      {(value: GanttColorMode | null) =>
                        t(`tasks:gantt.colorMode.${value ?? "group"}`)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="group">
                      {t("tasks:gantt.colorMode.group")}
                    </SelectItem>
                    <SelectItem value="status">
                      {t("tasks:gantt.colorMode.status")}
                    </SelectItem>
                    <SelectItem value="priority">
                      {t("tasks:gantt.colorMode.priority")}
                    </SelectItem>
                    <SelectItem value="assignee">
                      {t("tasks:gantt.colorMode.assignee")}
                    </SelectItem>
                  </SelectPopup>
                </Select>
              </div>

              {legendItems.length > 0 && (
                <div
                  aria-label={t("tasks:gantt.legend")}
                  className="hidden items-center gap-2 pl-1 xl:flex"
                >
                  {legendItems.map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex max-w-[9rem] items-center gap-1 truncate text-[11px] text-muted-foreground"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.swatch.fill }}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div
                role="group"
                aria-label="Zoom"
                className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5"
              >
                {(["days", "weeks", "months"] as const).map((zoomOption) => {
                  const labelKey =
                    zoomOption === "days"
                      ? "tasks:gantt.zoomDays"
                      : zoomOption === "weeks"
                        ? "tasks:gantt.zoomWeeks"
                        : "tasks:gantt.zoomMonths";
                  const selected = activeZoom === zoomOption;
                  return (
                    <button
                      key={zoomOption}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleZoomChange(zoomOption)}
                      className={cn(
                        "rounded-xs px-2 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>

              {timeline && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("tasks:gantt.previousPeriod")}
                    disabled={!timeline.hasPrevious}
                    onClick={() =>
                      showDate(
                        addDays(timeline.rangeStart, -timeline.windowDays),
                      )
                    }
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <input
                    type="date"
                    aria-label={t("tasks:gantt.periodStart")}
                    className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs"
                    min={format(timeline.minimumStart, "yyyy-MM-dd")}
                    max={format(timeline.maximumStart, "yyyy-MM-dd")}
                    value={format(timeline.rangeStart, "yyyy-MM-dd")}
                    onChange={(event) => {
                      const date = parseTaskDate(event.target.value);
                      if (date) showDate(date);
                    }}
                  />
                  <span className="hidden text-xs text-muted-foreground 2xl:inline">
                    –{" "}
                    {format(timeline.rangeEnd, "MMM d, yyyy", {
                      locale: dateLocale,
                    })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("tasks:gantt.nextPeriod")}
                    disabled={!timeline.hasNext}
                    onClick={() =>
                      showDate(
                        addDays(timeline.rangeStart, timeline.windowDays),
                      )
                    }
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                size="xs"
                className="h-8 touch-manipulation sm:h-7"
                aria-label={t("tasks:gantt.jumpToToday")}
                onClick={() => scrollToToday()}
                disabled={!todayInRange || scheduledTasks.length === 0}
              >
                <Calendar className="size-3.5" />
                <span className="hidden sm:inline">
                  {t("tasks:gantt.jumpToToday")}
                </span>
              </Button>

              <Menu>
                <MenuTrigger
                  render={
                    <Button variant="outline" size="xs" className="h-8 sm:h-7">
                      <Download className="size-3.5" />
                      <span className="hidden sm:inline">
                        {t("tasks:gantt.export")}
                      </span>
                    </Button>
                  }
                />
                <MenuPopup align="end">
                  <MenuItem onClick={handleExportCsv}>
                    <FileSpreadsheet className="size-4" />
                    {t("tasks:gantt.exportCsv")}
                  </MenuItem>
                  <MenuItem onClick={() => window.print()}>
                    <Printer className="size-4" />
                    {t("tasks:gantt.exportPrint")}
                  </MenuItem>
                </MenuPopup>
              </Menu>

              <Button
                variant="outline"
                size="xs"
                className="h-8 touch-manipulation sm:hidden"
                aria-pressed={showTaskRail}
                onClick={() => setIsTaskRailOpen((current) => !current)}
              >
                {showTaskRail ? (
                  <ChevronLeft className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                {showTaskRail
                  ? t("tasks:gantt.hideTasks")
                  : t("tasks:gantt.showTasks")}
              </Button>
            </div>
          </div>
        </div>

        {!timeline || parsedTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.noTasks")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:gantt.noTasksSubtitle")}
              </p>
            </div>
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.noTasksFound")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:filterBar.noMatches")}
              </p>
            </div>
          </div>
        ) : (
          <div
            data-testid="gantt-scroll-container"
            className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] print:overflow-visible"
            style={{ scrollPaddingLeft: `${scrollPaddingLeftRem}rem` }}
          >
            <div className="relative min-w-max touch-pan-x touch-pan-y">
              <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
                {showTaskRail ? (
                  <div
                    className="sticky left-0 z-30 flex shrink-0 items-center border-r border-border bg-background text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                    style={{ width: `${taskColumnWidthRem}rem` }}
                  >
                    <div className="w-11 shrink-0 border-r border-border/60 px-2 py-3 text-center">
                      {t("tasks:gantt.colNumber")}
                    </div>
                    <div className="min-w-0 flex-1 px-3 py-3">
                      {t("tasks:gantt.colName")}
                    </div>
                    <div className="hidden w-[9rem] shrink-0 border-l border-border/60 px-2.5 py-3 sm:block">
                      {t("tasks:gantt.colAssignee")}
                    </div>
                    <div className="hidden w-[5rem] shrink-0 border-l border-border/60 px-2 py-3 text-center sm:block">
                      {t("tasks:gantt.colDuration")}
                    </div>
                  </div>
                ) : null}

                <div
                  className="relative shrink-0"
                  style={{ minWidth: `${timeline.timelineMinWidthRem}rem` }}
                >
                  {activeZoom === "months" ? (
                    <div className="flex flex-col">
                      <div
                        className="grid border-b border-border/60"
                        style={{
                          gridTemplateColumns: timeline.gridTemplateColumns,
                        }}
                      >
                        {yearSegments.map((seg) => (
                          <div
                            key={seg.key}
                            style={{ gridColumn: `span ${seg.days}` }}
                            className="border-r border-border/70 px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground"
                          >
                            {seg.label}
                          </div>
                        ))}
                      </div>
                      <div
                        className="relative grid"
                        style={{
                          gridTemplateColumns: timeline.gridTemplateColumns,
                        }}
                      >
                        {monthSegments.map((seg) => (
                          <div
                            key={seg.key}
                            style={{ gridColumn: `span ${seg.days}` }}
                            className="border-r border-border/70 px-1 py-1.5 text-center text-xs font-medium capitalize text-foreground/85"
                          >
                            {seg.label}
                          </div>
                        ))}
                        {todayInRange && (
                          <div
                            ref={todayCellRef}
                            style={{
                              gridColumn: `${todayIndex + 1} / ${todayIndex + 2}`,
                            }}
                            className="pointer-events-none absolute inset-y-0 z-10 flex items-end justify-center"
                          >
                            <span className="mb-0.5 rounded-full bg-destructive px-1.5 py-px text-[9px] font-semibold leading-none text-white shadow-xs">
                              {t("tasks:gantt.today")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeZoom === "weeks" ? (
                    <div className="flex flex-col">
                      <div
                        className="grid border-b border-border/60"
                        style={{
                          gridTemplateColumns: timeline.gridTemplateColumns,
                        }}
                      >
                        {monthSegments.map((seg) => (
                          <div
                            key={seg.key}
                            style={{ gridColumn: `span ${seg.days}` }}
                            className="border-r border-border/70 px-2 py-1 text-left text-[11px] font-semibold capitalize text-muted-foreground"
                          >
                            {seg.label} {format(timeline.days[0], "yyyy")}
                          </div>
                        ))}
                      </div>
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: timeline.gridTemplateColumns,
                        }}
                      >
                        {timeline.days.map((day, index) => {
                          const isWeekStart =
                            index === 0 || day.getDay() === weekStartsOn;
                          const isCurrentDay = isToday(day);
                          return (
                            <div
                              key={day.toISOString()}
                              ref={isCurrentDay ? todayCellRef : undefined}
                              className={cn(
                                "relative flex h-7 items-center justify-center text-[10px]",
                                isWeekStart && "border-l border-border/70",
                                isWeekend(day) && "bg-muted/20",
                              )}
                            >
                              {isCurrentDay ? (
                                <span className="rounded-full bg-destructive px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
                                  {format(day, "d")}
                                </span>
                              ) : isWeekStart ? (
                                <span className="font-medium text-foreground/80">
                                  {format(day, "d")}
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: timeline.gridTemplateColumns,
                        minWidth: `${timeline.timelineMinWidthRem}rem`,
                      }}
                    >
                      {timeline.days.map((day, index) => {
                        const showMonth =
                          index === 0 ||
                          !isSameMonth(day, timeline.days[index - 1] ?? day);
                        const isCurrentDay = isToday(day);

                        return (
                          <div
                            key={day.toISOString()}
                            ref={isCurrentDay ? todayCellRef : undefined}
                            className={cn(
                              "border-r border-border/70 px-0.5 py-2 text-center sm:px-1",
                              isWeekend(day) && "bg-muted/25",
                            )}
                          >
                            <div className="h-4 text-[10px] font-medium capitalize text-muted-foreground">
                              {isCurrentDay ? (
                                <span className="rounded-full bg-destructive/15 px-1 text-[9px] font-semibold text-destructive">
                                  {t("tasks:gantt.today")}
                                </span>
                              ) : showMonth ? (
                                format(day, "MMM", { locale: dateLocale })
                              ) : (
                                ""
                              )}
                            </div>
                            <div
                              className={cn(
                                "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                                isCurrentDay && "bg-destructive text-white",
                              )}
                            >
                              {format(day, "d")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div
                  ref={timelineTrackRef}
                  className="absolute inset-y-0 z-0 grid"
                  style={{
                    left: showTaskRail ? `${taskColumnWidthRem}rem` : "0rem",
                    gridTemplateColumns: timeline.gridTemplateColumns,
                    width: `${timeline.timelineMinWidthRem}rem`,
                  }}
                >
                  {timeline.days.map((day) => {
                    const isMonthBoundary =
                      activeZoom === "months" && day.getDate() === 1;
                    const isWeekBoundary =
                      activeZoom === "weeks" && day.getDay() === weekStartsOn;
                    return (
                      <div
                        key={`bg-line-${day.toISOString()}`}
                        className={cn(
                          "h-full min-h-0",
                          activeZoom === "days" && "border-r border-border/60",
                          activeZoom === "weeks" &&
                            (isWeekBoundary
                              ? "border-l border-border/70"
                              : "border-r border-border/20"),
                          activeZoom === "months" &&
                            isMonthBoundary &&
                            "border-l border-border/70",
                          activeZoom !== "months" &&
                            isWeekend(day) &&
                            "bg-muted/25",
                        )}
                      />
                    );
                  })}

                  {todayPercent !== null && (
                    <div
                      aria-hidden="true"
                      data-testid="gantt-today-line"
                      className="pointer-events-none absolute inset-y-0 z-[6] w-[2px] -translate-x-1/2 bg-destructive/75"
                      style={{ left: `${todayPercent}%` }}
                    />
                  )}

                  <GanttDependencyArrows
                    rows={hierarchy.visibleRows}
                    relations={relations}
                    rangeStart={timeline.rangeStart}
                    dayCount={timeline.days.length}
                    pixelsPerDay={pixelsPerDay}
                    rowHeightPx={ROW_HEIGHT_PX}
                  />
                </div>

                <div className="relative z-10 flex flex-col">
                  {hierarchy.visibleRows.map((row) => {
                    const task = row.task;
                    const swatch = getRowSwatch(row);
                    const outOfWindow =
                      row.scheduleEnd < timeline.rangeStart ||
                      row.scheduleStart > timeline.rangeEnd;
                    const hasAssignee = Boolean(
                      task.assigneeId || task.assigneeName,
                    );

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "grid h-[44px] items-stretch border-b border-border/60",
                          row.isSummary && "bg-muted/20",
                        )}
                        style={{
                          gridTemplateColumns: showTaskRail
                            ? `${taskColumnWidthRem}rem max-content`
                            : "max-content",
                        }}
                      >
                        {showTaskRail ? (
                          <div className="sticky left-0 z-[11] flex h-full items-center border-r border-border bg-background">
                            <div className="w-11 shrink-0 border-r border-border/50 px-1.5 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                              {row.wbs}
                            </div>

                            <div
                              className="flex min-w-0 flex-1 items-center gap-1.5 px-2"
                              style={{
                                paddingLeft: `${8 + row.depth * 14}px`,
                              }}
                            >
                              {row.hasChildren ? (
                                <button
                                  type="button"
                                  aria-label={`${
                                    row.isExpanded
                                      ? t("tasks:gantt.collapseAll")
                                      : t("tasks:gantt.expandAll")
                                  }: ${task.title}`}
                                  aria-expanded={row.isExpanded}
                                  onClick={() => toggleCollapse(task.id)}
                                  className="flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  {row.isExpanded ? (
                                    <ChevronDown className="size-3" />
                                  ) : (
                                    <ChevronRight className="size-3" />
                                  )}
                                </button>
                              ) : (
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: swatch.fill }}
                                />
                              )}

                              <button
                                type="button"
                                className="min-w-0 flex-1 truncate text-left text-xs transition-colors hover:text-primary"
                                onClick={() =>
                                  navigate({
                                    to: ".",
                                    search: { taskId: task.id },
                                    replace: true,
                                  })
                                }
                              >
                                <span
                                  className={cn(
                                    "truncate",
                                    row.isSummary
                                      ? "font-semibold text-foreground"
                                      : "font-medium text-foreground/90",
                                    row.isCompleted &&
                                      "line-through text-muted-foreground opacity-70",
                                  )}
                                >
                                  {task.title}
                                </span>
                              </button>

                              {row.isOverdue && (
                                <span
                                  title={t("tasks:gantt.overdue")}
                                  className="size-2 shrink-0 rounded-full bg-destructive"
                                />
                              )}

                              {outOfWindow && (
                                <button
                                  type="button"
                                  className="shrink-0 text-[10px] font-medium text-primary underline"
                                  onClick={() =>
                                    showDate(addDays(row.scheduleStart, -7))
                                  }
                                >
                                  {t("tasks:gantt.showTaskDates")}
                                </button>
                              )}
                            </div>

                            <div className="hidden w-[9rem] shrink-0 items-center gap-1.5 border-l border-border/50 px-2.5 sm:flex">
                              {hasAssignee ? (
                                <>
                                  <ResponsableAvatar
                                    size="xs"
                                    userId={task.assigneeId}
                                    name={task.assigneeName}
                                    image={task.assigneeImage}
                                    assigned
                                  />
                                  <span className="truncate text-xs text-foreground/85">
                                    {task.assigneeName}
                                  </span>
                                </>
                              ) : !row.isSummary ? (
                                <>
                                  <ResponsableAvatar
                                    size="xs"
                                    assigned={false}
                                  />
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {t("tasks:gantt.unassigned")}
                                  </span>
                                </>
                              ) : null}
                            </div>

                            <div className="hidden w-[5rem] shrink-0 justify-end border-l border-border/50 px-2.5 text-right text-xs tabular-nums text-muted-foreground sm:flex">
                              {row.isMilestone
                                ? t("tasks:gantt.milestone")
                                : t("tasks:gantt.daysShort", {
                                    count: row.durationDays,
                                  })}
                            </div>
                          </div>
                        ) : null}

                        <div
                          className="relative h-[44px] shrink-0 select-none"
                          style={{
                            minWidth: `${timeline.timelineMinWidthRem}rem`,
                          }}
                        >
                          <GanttTaskBar
                            task={task}
                            timeline={timeline}
                            pixelsPerDay={pixelsPerDay}
                            isMobile={isMobile}
                            isSummary={row.isSummary}
                            isMilestone={row.isMilestone}
                            isCompleted={row.isCompleted}
                            isOverdue={row.isOverdue}
                            progressPercent={row.progressPercent}
                            swatch={swatch}
                            scheduleStart={row.scheduleStart}
                            scheduleEnd={row.scheduleEnd}
                            assigneeId={task.assigneeId}
                            assigneeName={task.assigneeName}
                            assigneeImage={task.assigneeImage}
                            onOpenTask={() =>
                              navigate({
                                to: ".",
                                search: { taskId: task.id },
                                replace: true,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() =>
            navigate({
              to: ".",
              search: {},
              replace: true,
            })
          }
        />
      </div>
    </ProjectLayout>
  );
}

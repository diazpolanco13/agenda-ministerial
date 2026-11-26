import { differenceInCalendarDays, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ListTodo,
} from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  flattenColumnTasks,
  groupTasksByAssignee,
  isTaskOverdue,
  type WorkspaceMemberEntry,
} from "@/components/project/views/task-metrics";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CircularProgress from "@/components/ui/circular-progress";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getPriorityColor, getStatusColor } from "@/lib/agenda-palette";
import { cn } from "@/lib/cn";
import { isTaskCompleted } from "@/lib/due-date-status";
import { formatDateShort } from "@/lib/format";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { parseTaskDate } from "@/lib/task-schedule";
import type { ProjectWithTasks } from "@/types/project";

type ProjectDashboardViewProps = {
  project?: ProjectWithTasks;
  filteredProject?: ProjectWithTasks | null;
  workspaceId: string;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  onOpenTask: (taskId: string) => void;
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "no-priority"];

export function ProjectDashboardView({
  project,
  filteredProject,
  workspaceId,
  isLoading,
  isError,
  hasActiveFilters,
  onOpenTask,
}: ProjectDashboardViewProps) {
  const { t } = useTranslation();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const members = useMemo(
    () => (workspaceUsers?.members ?? []) as WorkspaceMemberEntry[],
    [workspaceUsers?.members],
  );

  const activeSource = filteredProject ?? project;
  const allTasks = useMemo(() => flattenColumnTasks(project), [project]);
  const tasks = useMemo(() => flattenColumnTasks(activeSource), [activeSource]);

  const metrics = useMemo(() => {
    const columns = project?.columns ?? [];
    const total = tasks.length;
    const completed = tasks.filter((task) =>
      isTaskCompleted(task.status, columns),
    ).length;
    const open = total - completed;
    const overdue = tasks.filter((task) => isTaskOverdue(task, columns)).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, open, overdue, percent };
  }, [project?.columns, tasks]);

  const statusBreakdown = useMemo(() => {
    const columns = activeSource?.columns ?? [];
    const total = tasks.length;
    return columns.map((column) => {
      const count = column.tasks.length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        id: column.id,
        slug: column.slug,
        label: getStatusDisplayLabel(column.slug, column.name),
        count,
        pct,
        swatch: getStatusColor(column.slug, column.isFinal),
      };
    });
  }, [activeSource?.columns, tasks.length]);

  const priorityBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      const key = task.priority || "no-priority";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const keys = [
      ...PRIORITY_ORDER,
      ...[...counts.keys()].filter((key) => !PRIORITY_ORDER.includes(key)),
    ];
    const maxCount = Math.max(1, ...counts.values());
    return keys.map((key) => {
      const count = counts.get(key) ?? 0;
      const pct =
        tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0;
      const barWidth = Math.round((count / maxCount) * 100);
      return {
        key,
        label: getPriorityLabel(key),
        count,
        pct,
        barWidth,
        swatch: getPriorityColor(key),
      };
    });
  }, [tasks]);

  const assigneeBreakdown = useMemo(() => {
    const grouped = groupTasksByAssignee(
      tasks,
      members,
      t("tasks:dashboard.unassigned"),
    );
    const maxTasks = Math.max(1, ...grouped.map((g) => g.tasks.length));
    return grouped.map((group) => {
      const completed = group.tasks.filter((task) =>
        isTaskCompleted(task.status, project?.columns),
      ).length;
      const total = group.tasks.length;
      const open = total - completed;
      return {
        ...group,
        total,
        completed,
        open,
        barPct: Math.round((total / maxTasks) * 100),
        completedPctOfBar:
          total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }, [members, project?.columns, t, tasks]);

  const upcomingDeadlines = useMemo(() => {
    const today = startOfDay(new Date());
    const memberMap = new Map(members.map((m) => [m.userId, m]));

    return tasks
      .filter((task) => !isTaskCompleted(task.status, project?.columns))
      .map((task) => {
        const due = parseTaskDate(task.dueDate);
        if (!due) return null;
        const diffDays = differenceInCalendarDays(startOfDay(due), today);
        const assigneeId = task.userId || task.assigneeId || null;
        const member = assigneeId ? memberMap.get(assigneeId) : undefined;
        return {
          task,
          due,
          diffDays,
          assigneeId,
          assigneeName:
            member?.user?.name ||
            task.assigneeName ||
            (assigneeId ?? t("tasks:dashboard.unassigned")),
          assigneeImage: member?.user?.image || task.assigneeImage || null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.due.getTime() - right.due.getTime())
      .slice(0, 10);
  }, [members, project?.columns, t, tasks]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="border-border/80 border-b px-4 py-3 sm:px-6">
        <h1 className="font-semibold text-base text-foreground">
          {t("tasks:dashboard.title")}
        </h1>
        <p className="text-muted-foreground text-xs">
          {t("tasks:dashboard.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("common:empty.loading")}
        </div>
      ) : isError ? (
        <div className="px-4 py-8 text-center text-sm font-semibold text-destructive">
          {t("tasks:calendar.loadError")}
        </div>
      ) : allTasks.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("tasks:workload.empty")}
        </div>
      ) : tasks.length === 0 && hasActiveFilters ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("tasks:filterBar.noMatches")}
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("tasks:dashboard.overallProgress")}
                  </p>
                  <p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
                    {metrics.percent}%
                  </p>
                </div>
                <div className="relative flex items-center justify-center">
                  <CircularProgress
                    completed={metrics.completed}
                    total={metrics.total}
                    size={48}
                    strokeWidth={4.5}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("tasks:dashboard.totalTasks")}
                  </p>
                  <p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
                    {metrics.total}
                  </p>
                </div>
                <ListTodo className="size-4 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("tasks:dashboard.openTasks")}
                  </p>
                  <p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
                    {metrics.open}
                  </p>
                </div>
                <CircleDot className="size-4 text-primary" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs">
                    {t("tasks:dashboard.completedTasks")}
                  </p>
                  <p className="mt-1 font-bold text-2xl text-foreground tabular-nums">
                    {metrics.completed}
                  </p>
                </div>
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </Card>

            <Card
              className={cn(
                "p-4",
                metrics.overdue > 0 &&
                  "border-destructive/45 bg-destructive/8 dark:bg-destructive/15",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={cn(
                      "text-xs",
                      metrics.overdue > 0
                        ? "font-medium text-destructive dark:text-red-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {t("tasks:dashboard.overdueTasks")}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-bold text-2xl tabular-nums",
                      metrics.overdue > 0
                        ? "text-destructive dark:text-red-300"
                        : "text-foreground",
                    )}
                  >
                    {metrics.overdue}
                  </p>
                </div>
                <AlertTriangle
                  className={cn(
                    "size-4",
                    metrics.overdue > 0
                      ? "text-destructive dark:text-red-300"
                      : "text-muted-foreground",
                  )}
                />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {t("tasks:dashboard.byStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3.5 pb-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60">
                  {statusBreakdown.map((item) =>
                    item.count > 0 ? (
                      <div
                        key={item.id}
                        title={`${item.label}: ${item.count}`}
                        className="h-full bg-(--swatch) transition-all dark:bg-(--swatch-dark)"
                        style={
                          {
                            width: `${(item.count / Math.max(1, metrics.total)) * 100}%`,
                            "--swatch": item.swatch.fill,
                            "--swatch-dark": item.swatch.fillDark,
                          } as CSSProperties
                        }
                      />
                    ) : null,
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  {statusBreakdown.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-2 font-medium text-foreground">
                          <span
                            className="size-2.5 rounded-full bg-(--swatch) dark:bg-(--swatch-dark)"
                            style={
                              {
                                "--swatch": item.swatch.fill,
                                "--swatch-dark": item.swatch.fillDark,
                              } as CSSProperties
                            }
                          />
                          {item.label}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.count} ({item.pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-(--swatch) dark:bg-(--swatch-dark)"
                          style={
                            {
                              width: `${item.pct}%`,
                              "--swatch": item.swatch.fill,
                              "--swatch-dark": item.swatch.fillDark,
                            } as CSSProperties
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {t("tasks:dashboard.byPriority")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pb-5">
                {priorityBreakdown.map((item) => (
                  <div key={item.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 font-medium text-foreground">
                        {getPriorityIcon(item.key)}
                        {item.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                      <div
                        className="h-full rounded-full bg-(--swatch) transition-all dark:bg-(--swatch-dark)"
                        style={
                          {
                            width: `${item.barWidth}%`,
                            "--swatch": item.swatch.fill,
                            "--swatch-dark": item.swatch.fillDark,
                          } as CSSProperties
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {t("tasks:dashboard.byAssignee")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pb-5">
                {assigneeBreakdown.map((item) => (
                  <div
                    key={item.person.key}
                    className="flex items-center gap-3"
                  >
                    <ResponsableAvatar
                      userId={item.person.userId}
                      name={item.person.name}
                      image={item.person.image}
                      assigned={item.person.isAssigned}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">
                          {item.person.name}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {item.completed}/{item.total}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="flex h-full overflow-hidden rounded-full bg-primary/30"
                          style={{ width: `${item.barPct}%` }}
                        >
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${item.completedPctOfBar}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {t("tasks:dashboard.upcomingDeadlines")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 pb-5">
                {upcomingDeadlines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/60 border-dashed py-8 text-center">
                    <CalendarClock className="size-5 text-muted-foreground/70" />
                    <p className="text-xs text-muted-foreground">
                      {t("tasks:dashboard.noUpcomingDeadlines")}
                    </p>
                  </div>
                ) : (
                  upcomingDeadlines.map((item) => {
                    const isOverdue = item.diffDays < 0;
                    const isToday = item.diffDays === 0;
                    const badgeVariant = isOverdue
                      ? "error"
                      : isToday
                        ? "warning"
                        : "outline";
                    const badgeText = isOverdue
                      ? t("tasks:dashboard.overdueDays", {
                          count: Math.abs(item.diffDays),
                        })
                      : isToday
                        ? t("tasks:dashboard.dueToday")
                        : t("tasks:dashboard.dueInDays", {
                            count: item.diffDays,
                          });

                    return (
                      <button
                        key={item.task.id}
                        type="button"
                        onClick={() => onOpenTask(item.task.id)}
                        className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border/70 hover:bg-accent/55"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <ResponsableAvatar
                            userId={item.assigneeId}
                            name={item.assigneeName}
                            image={item.assigneeImage}
                            assigned={Boolean(item.assigneeId)}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-xs text-foreground">
                              {item.task.title}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {item.assigneeName} · {formatDateShort(item.due)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={badgeVariant}
                          size="sm"
                          className="shrink-0 tabular-nums"
                        >
                          {badgeText}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

import {
  addWeeks,
  endOfDay,
  endOfWeek,
  isSameWeek,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  flattenColumnTasks,
  groupTasksByAssignee,
  isTaskOverdue,
  type WorkspaceMemberEntry,
} from "@/components/project/views/task-metrics";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getStatusColor } from "@/lib/agenda-palette";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { getPriorityLabel, getStatusLabel } from "@/lib/i18n/domain";
import { toScheduledTask } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

const CAPACITY_OPTIONS = [3, 4, 5, 6] as const;
const VISIBLE_WEEKS = 8;
const WEEK_STEP = 2;

type WorkloadViewProps = {
  project?: ProjectWithTasks;
  filteredProject?: ProjectWithTasks | null;
  workspaceId: string;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  onOpenTask: (taskId: string) => void;
};

type WeekBucket = {
  key: string;
  start: Date;
  end: Date;
  label: string;
  isCurrent: boolean;
};

function getCellTone(count: number, capacity: number) {
  if (count === 0) {
    return "border-border/50 bg-muted/25 text-muted-foreground/60 hover:bg-muted/45";
  }
  if (count < capacity) {
    return "border-emerald-500/25 bg-emerald-500/14 text-emerald-800 hover:bg-emerald-500/22 dark:border-emerald-500/35 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/28";
  }
  if (count === capacity) {
    return "border-amber-500/35 bg-amber-500/18 text-amber-900 hover:bg-amber-500/26 dark:border-amber-500/40 dark:bg-amber-500/22 dark:text-amber-300 dark:hover:bg-amber-500/30";
  }
  return "border-destructive/45 bg-destructive/18 font-semibold text-destructive hover:bg-destructive/26 dark:border-destructive/55 dark:bg-destructive/25 dark:text-red-300 dark:hover:bg-destructive/35";
}

export function WorkloadView({
  project,
  filteredProject,
  workspaceId,
  isLoading,
  isError,
  hasActiveFilters,
  onOpenTask,
}: WorkloadViewProps) {
  const { t } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const [capacity, setCapacity] = useState<number>(4);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const members = useMemo(
    () => (workspaceUsers?.members ?? []) as WorkspaceMemberEntry[],
    [workspaceUsers?.members],
  );
  const allTasks = useMemo(() => flattenColumnTasks(project), [project]);
  const visibleTasks = useMemo(
    () => flattenColumnTasks(filteredProject ?? project),
    [filteredProject, project],
  );

  const weeks = useMemo<WeekBucket[]>(() => {
    const today = new Date();
    const baseStart = startOfWeek(addWeeks(today, weekOffset * WEEK_STEP), {
      weekStartsOn,
    });
    return Array.from({ length: VISIBLE_WEEKS }, (_, index) => {
      const start = startOfDay(addWeeks(baseStart, index));
      const end = endOfDay(endOfWeek(start, { weekStartsOn }));
      return {
        key: start.toISOString(),
        start,
        end,
        label: `${formatDateShort(start)} – ${formatDateShort(end)}`,
        isCurrent: isSameWeek(start, today, { weekStartsOn }),
      };
    });
  }, [weekOffset, weekStartsOn]);

  const rows = useMemo(() => {
    const grouped = groupTasksByAssignee(
      visibleTasks,
      members,
      t("tasks:workload.unassigned"),
    );

    return grouped.map((group) => {
      const scheduled = group.tasks.map((task) => ({
        task,
        span: toScheduledTask(task),
      }));

      const byWeek = weeks.map((week) =>
        scheduled
          .filter(
            ({ span }) =>
              span !== null &&
              startOfDay(span.scheduleStart) <= week.end &&
              endOfDay(span.scheduleEnd) >= week.start,
          )
          .map(({ task }) => task),
      );

      return {
        ...group,
        byWeek,
      };
    });
  }, [members, t, visibleTasks, weeks]);

  const rangeLabel =
    weeks.length > 0
      ? `${formatDateShort(weeks[0].start)} – ${formatDateShort(weeks[weeks.length - 1].end)}`
      : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-border/80 border-b px-4 py-3">
        <div>
          <h1 className="font-semibold text-base text-foreground">
            {t("tasks:workload.title")}
          </h1>
          <p className="text-muted-foreground text-xs">
            {t("tasks:workload.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs border border-emerald-500/35 bg-emerald-500/20" />
              {t("tasks:workload.legendOptimal")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs border border-amber-500/40 bg-amber-500/25" />
              {t("tasks:workload.legendHigh")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs border border-destructive/50 bg-destructive/25" />
              {t("tasks:workload.legendOverload")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              {t("tasks:workload.weeklyCapacity")}
            </span>
            <Select
              value={String(capacity)}
              onValueChange={(value) => {
                const parsed = Number(value);
                if (Number.isFinite(parsed) && parsed > 0) setCapacity(parsed);
              }}
            >
              <SelectTrigger size="sm" className="w-32 min-w-0">
                <SelectValue>
                  {t("tasks:workload.tasksPerWeek", { count: capacity })}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CAPACITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {t("tasks:workload.tasksPerWeek", { count: option })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-card p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("tasks:workload.previousWeeks")}
              onClick={() => setWeekOffset((current) => current - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="gap-1 px-2 text-xs"
            >
              <Calendar className="size-3" />
              {t("tasks:workload.today")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("tasks:workload.nextWeeks")}
              onClick={() => setWeekOffset((current) => current + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">
            {rangeLabel}
          </span>
        </div>
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
      ) : rows.length === 0 && hasActiveFilters ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("tasks:filterBar.noMatches")}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur">
              <tr className="border-border/80 border-b">
                <th className="sticky left-0 z-30 w-64 min-w-56 border-border/80 border-r bg-card/95 px-4 py-2.5 text-left font-medium text-xs text-muted-foreground">
                  {t("tasks:workload.person")}
                </th>
                {weeks.map((week) => (
                  <th
                    key={week.key}
                    className={cn(
                      "min-w-24 border-border/60 border-r px-2 py-2 text-center font-medium text-xs",
                      week.isCurrent
                        ? "bg-primary/8 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <div className="truncate tabular-nums">
                      {formatDateShort(week.start)}
                    </div>
                    <div className="truncate font-normal text-[10px] opacity-75 tabular-nums">
                      {formatDateShort(week.end)}
                    </div>
                  </th>
                ))}
                <th className="w-20 px-3 py-2.5 text-center font-medium text-xs text-muted-foreground">
                  {t("tasks:workload.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.person.key}
                  className="border-border/60 border-b transition-colors hover:bg-muted/20"
                >
                  <td className="sticky left-0 z-10 border-border/80 border-r bg-background px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ResponsableAvatar
                        userId={row.person.userId}
                        name={row.person.name}
                        image={row.person.image}
                        assigned={row.person.isAssigned}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm text-foreground">
                          {row.person.name}
                        </div>
                        {row.person.subtitle ? (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {row.person.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {weeks.map((week, weekIndex) => {
                    const cellTasks: Task[] = row.byWeek[weekIndex] ?? [];
                    const count = cellTasks.length;
                    return (
                      <td
                        key={week.key}
                        className={cn(
                          "border-border/50 border-r p-1.5 text-center",
                          week.isCurrent && "bg-primary/4",
                        )}
                      >
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${row.person.name} (${week.label}): ${count}`}
                              className={cn(
                                "inline-flex h-8 w-full items-center justify-center rounded-md border text-xs transition-colors tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                getCellTone(count, capacity),
                              )}
                            >
                              {count > 0 ? count : "–"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="center" className="w-80 p-2">
                            <div className="mb-2 flex items-center justify-between gap-2 border-border/70 border-b px-1 pb-1.5">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-xs text-foreground">
                                  {t("tasks:workload.weekTasksTitle")}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {row.person.name} · {week.label}
                                </p>
                              </div>
                              <Badge variant="outline" size="sm">
                                {count}
                              </Badge>
                            </div>
                            {cellTasks.length === 0 ? (
                              <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                                {t("tasks:workload.noTasksInWeek")}
                              </p>
                            ) : (
                              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                                {cellTasks.map((task) => {
                                  const statusSwatch = getStatusColor(
                                    task.status,
                                  );
                                  const overdue = isTaskOverdue(
                                    task,
                                    project?.columns,
                                  );
                                  return (
                                    <button
                                      key={task.id}
                                      type="button"
                                      onClick={() => onOpenTask(task.id)}
                                      className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="line-clamp-2 font-medium text-xs text-foreground">
                                          {task.title}
                                        </span>
                                        {overdue ? (
                                          <Badge
                                            variant="error"
                                            size="sm"
                                            className="shrink-0"
                                          >
                                            {t("tasks:workload.overdueBadge")}
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                          <span
                                            className="size-2 rounded-full bg-(--swatch) dark:bg-(--swatch-dark)"
                                            style={
                                              {
                                                "--swatch": statusSwatch.fill,
                                                "--swatch-dark":
                                                  statusSwatch.fillDark,
                                              } as React.CSSProperties
                                            }
                                          />
                                          {getStatusLabel(task.status)}
                                        </span>
                                        {task.priority ? (
                                          <span>
                                            · {getPriorityLabel(task.priority)}
                                          </span>
                                        ) : null}
                                        {task.dueDate ? (
                                          <span className="ml-auto tabular-nums">
                                            {formatDateShort(task.dueDate)}
                                          </span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </td>
                    );
                  })}

                  <td className="px-3 py-2.5 text-center font-semibold text-xs text-foreground tabular-nums">
                    {row.tasks.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

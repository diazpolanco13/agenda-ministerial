import { ArrowRight, CalendarClock } from "lucide-react";
import { useMemo } from "react";
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
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import {
  indexMilitaryProfiles,
  resolvePersonMilitary,
} from "@/hooks/use-responsable-foto";
import { getStatusColor } from "@/lib/agenda-palette";
import { cn } from "@/lib/cn";
import { isTaskCompleted } from "@/lib/due-date-status";
import { formatDateShort } from "@/lib/format";
import { parseTaskDate } from "@/lib/task-schedule";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type PeopleViewProps = {
  project?: ProjectWithTasks;
  filteredProject?: ProjectWithTasks | null;
  workspaceId: string;
  isLoading: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  onOpenTask: (taskId: string) => void;
  onViewInGantt: (userId: string) => void;
};

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortKeyTasks(
  tasks: ReadonlyArray<Task>,
  columns?: ProjectWithTasks["columns"],
): Task[] {
  return [...tasks].sort((left, right) => {
    const leftOverdue = isTaskOverdue(left, columns);
    const rightOverdue = isTaskOverdue(right, columns);
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;

    const leftDue = parseTaskDate(left.dueDate)?.getTime() ?? Infinity;
    const rightDue = parseTaskDate(right.dueDate)?.getTime() ?? Infinity;
    if (leftDue !== rightDue) return leftDue - rightDue;

    const leftPriority = PRIORITY_WEIGHT[left.priority ?? ""] ?? 0;
    const rightPriority = PRIORITY_WEIGHT[right.priority ?? ""] ?? 0;
    return rightPriority - leftPriority;
  });
}

export function PeopleView({
  project,
  filteredProject,
  workspaceId,
  isLoading,
  isError,
  hasActiveFilters,
  onOpenTask,
  onViewInGantt,
}: PeopleViewProps) {
  const { t } = useTranslation();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: projectMembers } = useGetProjectMembers({
    workspaceId,
    projectId: project?.id ?? "",
  });
  const militaryByUserId = useMemo(
    () => indexMilitaryProfiles(projectMembers),
    [projectMembers],
  );
  const members = useMemo(
    () => (workspaceUsers?.members ?? []) as WorkspaceMemberEntry[],
    [workspaceUsers?.members],
  );

  const allTasks = useMemo(() => flattenColumnTasks(project), [project]);
  const visibleTasks = useMemo(
    () => flattenColumnTasks(filteredProject ?? project),
    [filteredProject, project],
  );

  const cards = useMemo(() => {
    const groups = groupTasksByAssignee(
      visibleTasks,
      members,
      t("tasks:people.unassigned"),
    );

    return groups.map((group) => {
      const total = group.tasks.length;
      const completed = group.tasks.filter((task) =>
        isTaskCompleted(task.status, project?.columns),
      ).length;
      const openTasks = group.tasks.filter(
        (task) => !isTaskCompleted(task.status, project?.columns),
      );
      const overdue = openTasks.filter((task) =>
        isTaskOverdue(task, project?.columns),
      ).length;
      const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;
      const keyTasks = sortKeyTasks(openTasks, project?.columns).slice(0, 3);

      return {
        ...group,
        total,
        open: openTasks.length,
        completed,
        overdue,
        compliance,
        keyTasks,
      };
    });
  }, [members, project?.columns, t, visibleTasks]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="border-border/60 border-b px-4 py-3.5 sm:px-6">
        <h1 className="font-semibold text-base tracking-tight text-foreground">
          {t("tasks:people.title")}
        </h1>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {t("tasks:people.subtitle")}
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
          {t("tasks:people.empty")}
        </div>
      ) : cards.length === 0 && hasActiveFilters ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("tasks:filterBar.noMatches")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const military = resolvePersonMilitary(
              card.person.userId,
              militaryByUserId,
              card.tasks,
            );
            const subtitle = military.grado
              ? `${military.grado}${military.unidad ? ` · ${military.unidad}` : ""}`
              : card.person.subtitle;
            return (
              <Card
                key={card.person.key}
                className="justify-between border-border/70"
              >
                <CardHeader className="gap-3 pb-3">
                  <div className="flex items-center gap-3">
                    <ResponsableAvatar
                      userId={card.person.userId}
                      name={card.person.name}
                      image={card.person.image}
                      cedula={military.cedula}
                      nacionalidad={military.nacionalidad}
                      grado={military.grado}
                      componente={military.componente}
                      unidad={military.unidad}
                      showHoverCard
                      assigned={card.person.isAssigned}
                      size="md"
                      className="size-11 text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold text-sm text-foreground">
                        {card.person.name}
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {subtitle ||
                          t("tasks:people.totalAssigned", {
                            count: card.total,
                          })}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-4 divide-x divide-border/60 rounded-lg bg-muted/40 py-2 text-center">
                    <div className="min-w-0 px-1">
                      <div className="font-semibold text-sm text-foreground tabular-nums">
                        {card.open}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                        {t("tasks:people.open")}
                      </div>
                    </div>
                    <div className="min-w-0 px-1">
                      <div className="font-semibold text-sm text-foreground tabular-nums">
                        {card.completed}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                        {t("tasks:people.completed")}
                      </div>
                    </div>
                    <div className="min-w-0 px-1">
                      <div
                        className={cn(
                          "font-semibold text-sm tabular-nums",
                          card.overdue > 0
                            ? "text-destructive dark:text-red-300"
                            : "text-foreground",
                        )}
                      >
                        {card.overdue}
                      </div>
                      <div
                        className={cn(
                          "truncate text-[10px] sm:text-[11px]",
                          card.overdue > 0
                            ? "text-destructive/90 dark:text-red-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {t("tasks:people.overdue")}
                      </div>
                    </div>
                    <div className="min-w-0 px-1">
                      <div className="font-semibold text-sm text-foreground tabular-nums">
                        {card.compliance}%
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                        {t("tasks:people.compliance")}
                      </div>
                    </div>
                  </div>

                  <Progress value={card.compliance} className="gap-1 [&_[data-slot=progress-track]]:h-1" />

                  <div>
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t("tasks:people.recentTasks")}
                    </div>
                    {card.keyTasks.length === 0 ? (
                      <p className="rounded-md border border-border/50 border-dashed px-2.5 py-2 text-xs text-muted-foreground">
                        {t("tasks:people.noRecentTasks")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {card.keyTasks.map((task) => {
                          const statusSwatch = getStatusColor(task.status);
                          const overdue = isTaskOverdue(task, project?.columns);
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onOpenTask(task.id)}
                              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="size-2 shrink-0 rounded-full bg-(--swatch) dark:bg-(--swatch-dark)"
                                  style={
                                    {
                                      "--swatch": statusSwatch.fill,
                                      "--swatch-dark": statusSwatch.fillDark,
                                    } as React.CSSProperties
                                  }
                                />
                                <span className="truncate text-xs text-foreground">
                                  {task.title}
                                </span>
                              </div>
                              {task.dueDate ? (
                                <Badge
                                  variant={overdue ? "error" : "outline"}
                                  size="sm"
                                  className="shrink-0 gap-1 tabular-nums"
                                >
                                  <CalendarClock className="size-2.5" />
                                  {formatDateShort(task.dueDate)}
                                </Badge>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>

                {card.person.userId ? (
                  <CardFooter className="border-border/50 border-t px-4 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-muted-foreground hover:text-foreground"
                      onClick={() => onViewInGantt(card.person.userId!)}
                    >
                      <span>{t("tasks:people.filterInGantt")}</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </CardFooter>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

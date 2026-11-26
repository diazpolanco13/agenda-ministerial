import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import MonthAgenda from "@/components/calendar/month-agenda";
import MonthGrid from "@/components/calendar/month-grid";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import type { CalendarTask } from "@/components/calendar/calendar-task-bar";
import { Button } from "@/components/ui/button";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CalendarMode = "month" | "week";

type MyTasksCalendarViewProps = {
  tasks: AssignedTask[];
  onOpenDetail: (taskId: string) => void;
};

function toCalendarSchedule(task: AssignedTask): CalendarTask | null {
  const due = task.dueDate ? parseISO(task.dueDate) : null;
  const start = task.startDate ? parseISO(task.startDate) : null;
  const validDue = due && !Number.isNaN(due.getTime()) ? startOfDay(due) : null;
  const validStart =
    start && !Number.isNaN(start.getTime()) ? startOfDay(start) : null;

  if (!validDue && !validStart) return null;

  const scheduleStart = validStart ?? validDue!;
  const scheduleEnd =
    validDue && validDue >= scheduleStart ? validDue : scheduleStart;

  return {
    id: task.id,
    title:
      task.number != null
        ? `${task.projectSlug}-${task.number} · ${task.title}`
        : task.title,
    number: task.number,
    status: task.status,
    scheduleStart,
    scheduleEnd,
  };
}

export function MyTasksCalendarView({
  tasks,
  onOpenDetail,
}: MyTasksCalendarViewProps) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));

  const visibleMonth = useMemo(() => startOfMonth(anchorDate), [anchorDate]);
  const scheduledTasks = useMemo(
    () =>
      tasks
        .map(toCalendarSchedule)
        .filter((item): item is CalendarTask => item !== null),
    [tasks],
  );

  const taskById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );

  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate, weekStartsOn]);

  const titleLabel =
    mode === "month"
      ? format(visibleMonth, "MMMM yyyy", { locale: es })
      : `${format(weekDays[0]!, "d MMM", { locale: es })} – ${format(
          endOfWeek(anchorDate, { weekStartsOn }),
          "d MMM yyyy",
          { locale: es },
        )}`;

  const handlePrev = () => {
    setAnchorDate((d) => (mode === "month" ? subMonths(d, 1) : subWeeks(d, 1)));
  };

  const handleNext = () => {
    setAnchorDate((d) => (mode === "month" ? addMonths(d, 1) : addWeeks(d, 1)));
  };

  const handleToday = () => {
    setAnchorDate(startOfDay(new Date()));
  };

  return (
    <div className="flex h-full min-h-[28rem] flex-col bg-background pb-16">
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/70 border-b px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border/80 bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handlePrev}
              aria-label="Periodo anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-7 px-2 text-xs"
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleNext}
              aria-label="Periodo siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <h2 className="text-sm font-semibold capitalize text-foreground">
            {titleLabel}
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setMode("month")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "month"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mes
          </button>
          <button
            type="button"
            onClick={() => setMode("week")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              mode === "week"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Semana
          </button>
        </div>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          No hay tareas con fecha programada para el filtro actual.
        </div>
      ) : mode === "month" ? (
        isMobile ? (
          <MonthAgenda
            tasks={scheduledTasks}
            visibleMonth={visibleMonth}
            onOpenTask={onOpenDetail}
          />
        ) : (
          <MonthGrid
            weeks={weeks}
            tasks={scheduledTasks}
            visibleMonth={visibleMonth}
            maxLanes={3}
            onOpenTask={onOpenDetail}
          />
        )
      ) : (
        <div className="grid flex-1 grid-cols-1 divide-y divide-border/60 overflow-y-auto md:grid-cols-7 md:divide-x md:divide-y-0">
          {weekDays.map((day) => {
            const dayTasks = scheduledTasks.filter(
              (item) =>
                isSameDay(item.scheduleStart, day) ||
                isSameDay(item.scheduleEnd, day) ||
                (item.scheduleStart <= day && item.scheduleEnd >= day),
            );
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex min-w-0 flex-col p-2.5",
                  today && "bg-primary/4",
                )}
              >
                <div className="mb-2 flex items-center justify-between border-border/50 border-b pb-1.5">
                  <span className="text-[11px] font-medium uppercase text-muted-foreground">
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      today
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {dayTasks.map((calTask) => {
                    const source = taskById.get(calTask.id);
                    return (
                      <button
                        key={calTask.id}
                        type="button"
                        onClick={() => onOpenDetail(calTask.id)}
                        className="flex flex-col gap-1 rounded-md border border-border/70 bg-card px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 [&_svg]:size-3">
                            {getPriorityIcon(source?.priority ?? "no-priority")}
                          </span>
                          <span className="truncate text-xs font-medium text-foreground">
                            {source?.title ?? calTask.title}
                          </span>
                        </div>
                        {source && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {source.projectName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

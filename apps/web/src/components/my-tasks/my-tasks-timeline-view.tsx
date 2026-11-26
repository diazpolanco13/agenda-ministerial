import { addDays, format, isToday, isWeekend, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GanttTaskBar } from "@/components/gantt/gantt-task-bar";
import {
  buildGanttTimeline,
  GANTT_ZOOM_CONFIG,
  type GanttZoom,
  parseTaskDate,
  resolveSmartGanttZoom,
} from "@/components/gantt/timeline";
import { Button } from "@/components/ui/button";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPriorityColor, getStatusColor } from "@/lib/agenda-palette";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

type ScheduledAssignedTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
  projectName: string;
  projectSlug: string;
  isFinal?: boolean;
};

type MyTasksTimelineViewProps = {
  tasks: AssignedTask[];
  onOpenDetail: (taskId: string) => void;
};

const ZOOM_OPTIONS: ReadonlyArray<{ value: GanttZoom; label: string }> = [
  { value: "days", label: "Días" },
  { value: "weeks", label: "Semanas" },
  { value: "months", label: "Meses" },
];

export function MyTasksTimelineView({
  tasks,
  onOpenDetail,
}: MyTasksTimelineViewProps) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [userZoom, setUserZoom] = useState<GanttZoom | null>(null);
  const [windowStart, setWindowStart] = useState<Date | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);

  const scheduledTasks = useMemo<ScheduledAssignedTask[]>(() => {
    const out: ScheduledAssignedTask[] = [];
    for (const item of tasks) {
      const start = parseTaskDate(item.startDate ?? null);
      const due = parseTaskDate(item.dueDate ?? null);
      if (!start && !due) continue;
      const scheduleStart = startOfDay(start ?? due!);
      const rawEnd = due ? startOfDay(due) : scheduleStart;
      const scheduleEnd = rawEnd >= scheduleStart ? rawEnd : scheduleStart;

      out.push({
        id: item.id,
        title: item.title,
        number: item.number,
        description: null,
        status: item.status,
        priority: item.priority,
        startDate: item.startDate ?? null,
        dueDate: item.dueDate ?? null,
        position: item.position ?? 0,
        createdAt: item.createdAt ?? new Date().toISOString(),
        updatedAt: item.updatedAt ?? undefined,
        userId: item.userId ?? null,
        assigneeId: item.userId ?? null,
        assigneeName: item.assigneeName ?? null,
        assigneeImage: item.assigneeImage ?? null,
        assigneeCedula: item.assigneeCedula ?? null,
        assigneeGrado: item.assigneeGrado ?? null,
        assigneeComponente: item.assigneeComponente ?? null,
        assigneeUnidad: item.assigneeUnidad ?? null,
        projectId: item.projectId,
        columnId: item.columnId ?? null,
        labels: item.labels,
        scheduleStart,
        scheduleEnd,
        projectName: item.projectName,
        projectSlug: item.projectSlug,
        isFinal: item.isFinal,
      });
    }
    return out;
  }, [tasks]);

  const effectiveZoom = useMemo(
    () => userZoom ?? resolveSmartGanttZoom(scheduledTasks),
    [userZoom, scheduledTasks],
  );

  const zoomConfig = GANTT_ZOOM_CONFIG[effectiveZoom];
  const dayColWidthRem = isMobile
    ? zoomConfig.mobileDayColumnWidthRem
    : zoomConfig.dayColumnWidthRem;

  const timeline = useMemo(
    () =>
      buildGanttTimeline(
        scheduledTasks,
        weekStartsOn,
        dayColWidthRem,
        windowStart,
        new Date(),
        effectiveZoom,
      ),
    [scheduledTasks, weekStartsOn, dayColWidthRem, windowStart, effectiveZoom],
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !timeline) return;
    const updateWidth = () => {
      if (timeline.days.length > 0) {
        setPixelsPerDay(el.clientWidth / timeline.days.length);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [timeline]);

  if (!timeline || scheduledTasks.length === 0) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center p-8 text-center text-sm text-muted-foreground">
        No hay tareas con fecha de inicio o límite para mostrar en la línea de
        tiempo.
      </div>
    );
  }

  const todayStart = startOfDay(new Date());

  return (
    <div className="flex h-full min-h-[26rem] flex-col bg-background pb-16">
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/70 border-b px-4 py-2 sm:px-5">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border/80">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Desplazar atrás"
              onClick={() => setWindowStart(addDays(timeline.rangeStart, -14))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setWindowStart(addDays(todayStart, -7))}
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Desplazar adelante"
              onClick={() => setWindowStart(addDays(timeline.rangeStart, 14))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {format(timeline.rangeStart, "d MMM", { locale: es })} –{" "}
            {format(timeline.rangeEnd, "d MMM yyyy", { locale: es })}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-0.5">
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setUserZoom(opt.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                effectiveZoom === opt.value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="inline-flex min-w-full flex-col">
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-border border-b bg-background/95 backdrop-blur">
            <div className="sticky left-0 z-30 flex w-44 shrink-0 items-center border-border border-r bg-background px-3 py-2 text-xs font-medium text-muted-foreground sm:w-64">
              Tarea
            </div>
            <div
              ref={trackRef}
              className="grid shrink-0"
              style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
            >
              {timeline.days.map((day) => {
                const today = isToday(day);
                const weekend = isWeekend(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex flex-col items-center justify-center border-border/40 border-r py-1 text-[10px]",
                      weekend && "bg-muted/25",
                      today && "bg-primary/10 font-semibold text-primary",
                    )}
                  >
                    {effectiveZoom === "days" ? (
                      <>
                        <span className="uppercase text-muted-foreground">
                          {format(day, "EEEEE", { locale: es })}
                        </span>
                        <span className="tabular-nums">{format(day, "d")}</span>
                      </>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">
                        {day.getDate() === 1 || day.getDay() === weekStartsOn
                          ? format(day, "d/M")
                          : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          <div className="flex flex-col divide-y divide-border/50">
            {scheduledTasks.map((task) => {
              const isCompleted = Boolean(task.isFinal);
              const isOverdue = !isCompleted && task.scheduleEnd < todayStart;
              const swatch =
                getPriorityColor(task.priority) ?? getStatusColor(task.status);
              const code =
                task.number != null
                  ? `${task.projectSlug}-${task.number}`
                  : task.projectSlug;

              return (
                <div key={task.id} className="flex h-11 items-stretch">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(task.id)}
                    className="sticky left-0 z-10 flex w-44 shrink-0 items-center gap-2 border-border border-r bg-background px-3 text-left transition-colors hover:bg-accent/40 sm:w-64"
                  >
                    <span className="shrink-0">
                      {getColumnIcon(task.status, isCompleted)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-xs font-medium text-foreground",
                          isCompleted && "line-through text-muted-foreground",
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {code} · {task.projectName}
                      </p>
                    </div>
                  </button>

                  <div
                    className="relative grid shrink-0"
                    style={{
                      gridTemplateColumns: timeline.gridTemplateColumns,
                    }}
                  >
                    {timeline.days.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-border/30 border-r",
                          isWeekend(day) && "bg-muted/20",
                          isToday(day) && "bg-primary/5",
                        )}
                      />
                    ))}
                    <GanttTaskBar
                      task={task}
                      timeline={timeline}
                      pixelsPerDay={pixelsPerDay}
                      isMobile={isMobile}
                      isCompleted={isCompleted}
                      isOverdue={isOverdue}
                      swatch={swatch}
                      onOpenTask={() => onOpenDetail(task.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

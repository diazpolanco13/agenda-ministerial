import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useTaskHoverPrefetch } from "@/hooks/use-task-hover-prefetch";
import {
  AGENDA_VIVID_PALETTE,
  type AgendaColorSwatch,
  GANTT_SUMMARY_COLOR,
} from "@/lib/agenda-palette";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const CLICK_MOVE_THRESHOLD_PX = 4;
const MOBILE_MOVE_THRESHOLD_PX = 14;
// Below this width a phone bar can't fit two 24px resize handles plus a
// usable move/tap area, so it's left as one target; dates stay editable from
// the task sheet.
const MIN_TOUCH_RESIZABLE_PX = 120;

type ScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

type GanttTaskBarProps = {
  task: ScheduledTask;
  timeline: {
    days: Date[];
    rangeStart: Date;
    gridTemplateColumns: string;
  };
  pixelsPerDay: number;
  isMobile?: boolean;
  isSummary?: boolean;
  isMilestone?: boolean;
  isCompleted?: boolean;
  isOverdue?: boolean;
  progressPercent?: number;
  swatch?: AgendaColorSwatch;
  scheduleStart?: Date;
  scheduleEnd?: Date;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assigneeImage?: string | null;
  assigneeCedula?: string | null;
  assigneeGrado?: string | null;
  assigneeComponente?: string | null;
  assigneeUnidad?: string | null;
  onOpenTask: () => void;
};

function getBarGridColumns(
  scheduleStart: Date,
  scheduleEnd: Date,
  rangeStart: Date,
  trackCount: number,
): { barInView: boolean; lineStart: number; lineEnd: number } {
  const startIndex = differenceInCalendarDays(scheduleStart, rangeStart);
  const endIndex = differenceInCalendarDays(scheduleEnd, rangeStart);
  const barInView = endIndex >= 0 && startIndex < trackCount && trackCount > 0;
  if (!barInView) {
    return { barInView: false, lineStart: 1, lineEnd: 1 };
  }
  const lineStart = Math.max(1, Math.min(startIndex + 1, trackCount));
  const lineEnd = Math.max(
    lineStart + 1,
    Math.min(endIndex + 2, trackCount + 1),
  );
  return { barInView: true, lineStart, lineEnd };
}

function toIsoDay(d: Date) {
  return startOfDay(d).toISOString();
}

export function GanttTaskBar({
  task,
  timeline,
  pixelsPerDay,
  isMobile = false,
  isSummary = false,
  isMilestone = false,
  isCompleted = false,
  isOverdue = false,
  progressPercent = 0,
  swatch = AGENDA_VIVID_PALETTE[1],
  scheduleStart: effectiveScheduleStart,
  scheduleEnd: effectiveScheduleEnd,
  assigneeId,
  assigneeName,
  assigneeImage,
  assigneeCedula,
  assigneeGrado,
  assigneeComponente,
  assigneeUnidad,
  onOpenTask,
}: GanttTaskBarProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTask } = useUpdateTask();
  const hoverPrefetch = useTaskHoverPrefetch(task.id);
  const [dragDisplay, setDragDisplay] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const baseStart = effectiveScheduleStart ?? task.scheduleStart;
  const baseEnd = effectiveScheduleEnd ?? task.scheduleEnd;

  // Drop the drag overlay once server data matches
  useEffect(() => {
    if (!dragDisplay) return;
    const startMatches =
      differenceInCalendarDays(baseStart, dragDisplay.start) === 0;
    const endMatches = differenceInCalendarDays(baseEnd, dragDisplay.end) === 0;
    if (startMatches && endMatches) {
      setDragDisplay(null);
    }
  }, [dragDisplay, baseEnd, baseStart]);

  const displayStart = dragDisplay?.start ?? baseStart;
  const displayEnd = dragDisplay?.end ?? baseEnd;

  const trackCount = timeline.days.length;
  const { barInView, lineStart, lineEnd } = getBarGridColumns(
    displayStart,
    displayEnd,
    timeline.rangeStart,
    trackCount,
  );

  const startIsVisible =
    differenceInCalendarDays(baseStart, timeline.rangeStart) >= 0;
  const endIsVisible =
    differenceInCalendarDays(baseEnd, timeline.rangeStart) < trackCount;

  const persistDates = useCallback(
    async (nextStart: Date, nextEnd: Date): Promise<boolean> => {
      try {
        await updateTask({
          ...task,
          startDate: toIsoDay(nextStart),
          dueDate: toIsoDay(nextEnd),
        });
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:gantt.updateDatesError"),
        );
        return false;
      }
    },
    [task, updateTask, t],
  );

  const pxPerDay = Math.max(pixelsPerDay, 1e-6);
  const moveThresholdPx = isMobile
    ? MOBILE_MOVE_THRESHOLD_PX
    : CLICK_MOVE_THRESHOLD_PX;

  const handleResizeLeftPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    const startIdx = differenceInCalendarDays(
      initialStart,
      timeline.rangeStart,
    );
    const endIdx = differenceInCalendarDays(initialEnd, timeline.rangeStart);

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, endIdx));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      setDragDisplay({ start: nextStart, end: initialEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, endIdx));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      if (nextStart.getTime() === initialStart.getTime()) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(nextStart, initialEnd);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const handleResizeRightPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    const startIdx = differenceInCalendarDays(
      initialStart,
      timeline.rangeStart,
    );
    const endIdx = differenceInCalendarDays(initialEnd, timeline.rangeStart);

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextEndIdx = endIdx + deltaDays;
      nextEndIdx = Math.max(startIdx, Math.min(nextEndIdx, trackCount - 1));
      const nextEnd = timeline.days[nextEndIdx] ?? initialEnd;
      setDragDisplay({ start: initialStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextEndIdx = endIdx + deltaDays;
      nextEndIdx = Math.max(startIdx, Math.min(nextEndIdx, trackCount - 1));
      const nextEnd = timeline.days[nextEndIdx] ?? initialEnd;
      if (nextEnd.getTime() === initialEnd.getTime()) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(initialStart, nextEnd);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const handleMovePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    if (!startIsVisible || !endIsVisible) {
      onOpenTask();
      return;
    }
    const durationDays = differenceInCalendarDays(initialEnd, initialStart);
    const startIdx = differenceInCalendarDays(
      initialStart,
      timeline.rangeStart,
    );

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      const maxStart = trackCount - 1 - durationDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, maxStart));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      const nextEnd = addDays(nextStart, durationDays);
      setDragDisplay({ start: nextStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const moved = Math.abs(ev.clientX - originX);
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      const maxStart = trackCount - 1 - durationDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, maxStart));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      const nextEnd = addDays(nextStart, durationDays);

      if (moved < moveThresholdPx) {
        setDragDisplay(null);
        onOpenTask();
        return;
      }
      if (
        nextStart.getTime() === initialStart.getTime() &&
        nextEnd.getTime() === initialEnd.getTime()
      ) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(nextStart, nextEnd);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  if (!barInView || lineEnd <= lineStart) {
    return null;
  }

  const resolvedAssigneeId = assigneeId ?? task.assigneeId;
  const resolvedAssigneeName = assigneeName ?? task.assigneeName;
  const resolvedAssigneeImage = assigneeImage ?? task.assigneeImage ?? null;
  const resolvedAssigneeCedula = assigneeCedula ?? task.assigneeCedula ?? null;
  const resolvedAssigneeGrado = assigneeGrado ?? task.assigneeGrado ?? null;
  const resolvedAssigneeComponente =
    assigneeComponente ?? task.assigneeComponente ?? null;
  const resolvedAssigneeUnidad = assigneeUnidad ?? task.assigneeUnidad ?? null;
  const hasAssignee = Boolean(resolvedAssigneeId || resolvedAssigneeName);

  const colorStyle = {
    "--gantt-bar-fill": swatch.fill,
    "--gantt-bar-fill-dark": swatch.fillDark,
    "--gantt-bar-border": swatch.border,
    "--gantt-bar-on-fill": swatch.onFill,
  } as CSSProperties;

  if (isSummary) {
    const summaryStyle = {
      gridColumn: `${lineStart} / ${lineEnd}`,
      "--gantt-summary-fill": GANTT_SUMMARY_COLOR.fill,
      "--gantt-summary-fill-dark": GANTT_SUMMARY_COLOR.fillDark,
      "--gantt-summary-track": GANTT_SUMMARY_COLOR.trackBg,
    } as CSSProperties;

    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1] grid items-center"
        style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
      >
        <button
          type="button"
          style={summaryStyle}
          aria-label={t("tasks:gantt.taskAriaLabel", { title: task.title })}
          onClick={onOpenTask}
          className={cn(
            "group pointer-events-auto relative mx-0.5 flex h-9 min-w-0 cursor-pointer flex-col justify-end pb-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isCompleted && "opacity-65",
          )}
        >
          <span className="mb-1 block max-w-none whitespace-nowrap text-[11px] font-semibold leading-none text-[#356618] dark:text-[#a3e635]">
            <span className={cn(isCompleted && "line-through")}>
              {task.title}
            </span>
            <span className="ml-1.5 font-normal opacity-80">
              | {format(displayStart, "yyyy/MM/dd")} -{" "}
              {format(displayEnd, "yyyy/MM/dd")}
            </span>
          </span>
          <div className="relative h-[7px] w-full rounded-[2px] bg-[var(--gantt-summary-track)]">
            <div
              className="h-full rounded-[2px] bg-[var(--gantt-summary-fill)] transition-[width] dark:bg-[var(--gantt-summary-fill-dark)]"
              style={{
                width: `${Math.max(0, Math.min(100, progressPercent))}%`,
              }}
            />
            {startIsVisible && (
              <span
                aria-hidden="true"
                className="absolute -bottom-[3px] left-0 h-[4px] w-[3px] rounded-b-[1px] bg-[var(--gantt-summary-fill)] dark:bg-[var(--gantt-summary-fill-dark)]"
              />
            )}
            {endIsVisible && (
              <span
                aria-hidden="true"
                className="absolute -bottom-[3px] right-0 h-[4px] w-[3px] rounded-b-[1px] bg-[var(--gantt-summary-fill)] dark:bg-[var(--gantt-summary-fill-dark)]"
              />
            )}
          </div>
        </button>
      </div>
    );
  }

  if (isMilestone) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1] grid items-center"
        style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
      >
        <div
          style={{ gridColumn: `${lineStart} / ${lineEnd}`, ...colorStyle }}
          className="pointer-events-auto relative flex items-center justify-center"
        >
          <button
            type="button"
            aria-label={t("tasks:gantt.taskAriaLabel", { title: task.title })}
            {...hoverPrefetch}
            onPointerDown={handleMovePointerDown}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenTask();
              }
            }}
            className="group relative flex size-7 cursor-grab items-center justify-center touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <span
              className={cn(
                "block size-3.5 rotate-45 rounded-[2px] bg-[var(--gantt-bar-fill)] shadow-sm transition-transform group-hover:scale-110 dark:bg-[var(--gantt-bar-fill-dark)]",
                isOverdue && "ring-2 ring-destructive ring-offset-1",
                isCompleted && "opacity-60",
              )}
            />
            {isOverdue && (
              <span
                title={t("tasks:gantt.overdue")}
                className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive ring-1 ring-background"
              />
            )}
          </button>
        </div>

        {lineEnd <= trackCount && (
          <div
            aria-hidden="true"
            style={{ gridColumn: `${lineEnd} / ${trackCount + 1}` }}
            className="pointer-events-none flex min-w-0 items-center gap-1.5 overflow-visible whitespace-nowrap pl-2"
          >
            <ResponsableAvatar
              size="xs"
              userId={resolvedAssigneeId}
              name={resolvedAssigneeName}
              image={resolvedAssigneeImage}
              cedula={resolvedAssigneeCedula}
              grado={resolvedAssigneeGrado}
              componente={resolvedAssigneeComponente}
              unidad={resolvedAssigneeUnidad}
              assigned={hasAssignee}
            />
            <span className="text-[11px] text-muted-foreground/50">|</span>
            <span
              className={cn(
                "text-xs font-medium text-foreground/85",
                isCompleted && "line-through text-muted-foreground opacity-70",
              )}
            >
              {task.title}
            </span>
          </div>
        )}
      </div>
    );
  }

  const barWidthPx = (lineEnd - lineStart) * pxPerDay;
  const showResizeHandles = !isMobile || barWidthPx >= MIN_TOUCH_RESIZABLE_PX;
  const showRightAnnotation = lineEnd <= trackCount;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{
        gridTemplateColumns: timeline.gridTemplateColumns,
      }}
    >
      <div
        style={{ gridColumn: `${lineStart} / ${lineEnd}`, ...colorStyle }}
        className={cn(
          "group pointer-events-auto relative mx-0.5 flex h-7 min-w-0 items-stretch rounded-[4px] bg-[var(--gantt-bar-fill)] text-left text-xs font-medium leading-none shadow-xs transition-opacity dark:bg-[var(--gantt-bar-fill-dark)] sm:h-6",
          isCompleted && "opacity-60",
          isOverdue &&
            "ring-2 ring-destructive ring-offset-1 ring-offset-background",
        )}
      >
        {showResizeHandles && (
          <button
            type="button"
            aria-label={t("tasks:gantt.resizeStart")}
            disabled={!startIsVisible}
            onPointerDown={handleResizeLeftPointerDown}
            className={cn(
              "relative z-20 shrink-0 cursor-ew-resize touch-none rounded-l-[4px] bg-black/15 transition-opacity hover:bg-black/25",
              "w-5 sm:w-2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          />
        )}
        <button
          type="button"
          aria-label={t("tasks:gantt.taskAriaLabel", { title: task.title })}
          className="relative z-10 flex min-w-0 flex-1 cursor-grab touch-manipulation items-center overflow-hidden px-1.5 text-left active:cursor-grabbing"
          {...hoverPrefetch}
          onPointerDown={handleMovePointerDown}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenTask();
            }
          }}
        >
          <span
            className={cn(
              "relative z-10 block truncate text-[11px] font-medium",
              showRightAnnotation && "sr-only",
              isCompleted && "line-through",
            )}
            style={showRightAnnotation ? undefined : { color: swatch.onFill }}
          >
            {task.title}
          </span>
        </button>
        {showResizeHandles && (
          <button
            type="button"
            aria-label={t("tasks:gantt.resizeDue")}
            disabled={!endIsVisible}
            onPointerDown={handleResizeRightPointerDown}
            className={cn(
              "relative z-20 shrink-0 cursor-ew-resize touch-none rounded-r-[4px] bg-black/15 transition-opacity hover:bg-black/25",
              "w-5 sm:w-2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          />
        )}
        {isOverdue && (
          <span
            title={t("tasks:gantt.overdue")}
            className="pointer-events-none absolute -right-1 -top-1 z-30 size-2.5 rounded-full bg-destructive ring-2 ring-background"
          />
        )}
      </div>

      {showRightAnnotation && (
        <div
          aria-hidden="true"
          style={{ gridColumn: `${lineEnd} / ${trackCount + 1}` }}
          className="pointer-events-none flex min-w-0 items-center gap-1.5 overflow-visible whitespace-nowrap pl-2"
        >
          <ResponsableAvatar
            size="xs"
            userId={resolvedAssigneeId}
            name={resolvedAssigneeName}
            image={resolvedAssigneeImage}
            cedula={resolvedAssigneeCedula}
            grado={resolvedAssigneeGrado}
            componente={resolvedAssigneeComponente}
            unidad={resolvedAssigneeUnidad}
            assigned={hasAssignee}
          />
          <span className="text-[11px] text-muted-foreground/50">|</span>
          <span
            className={cn(
              "text-xs font-medium text-foreground/85",
              isCompleted && "line-through text-muted-foreground opacity-70",
            )}
          >
            {task.title}
          </span>
        </div>
      )}
    </div>
  );
}

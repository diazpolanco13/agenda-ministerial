import { differenceInCalendarDays } from "date-fns";
import { useId, useMemo } from "react";
import type { GanttRelation, GanttRow } from "./gantt-hierarchy";

type GanttDependencyArrowsProps = {
  rows: GanttRow[];
  relations: GanttRelation[];
  rangeStart: Date;
  dayCount: number;
  pixelsPerDay: number;
  rowHeightPx?: number;
};

type ArrowSegment = {
  id: string;
  d: string;
  variant: "amber" | "slate";
};

const DEFAULT_ROW_HEIGHT_PX = 44;

/**
 * Dibuja conectores ortogonales SVG para dependencias `blocks` entre tareas
 * visibles en el Gantt (fin de la tarea origen → inicio de la tarea destino).
 */
export function GanttDependencyArrows({
  rows,
  relations,
  rangeStart,
  dayCount,
  pixelsPerDay,
  rowHeightPx = DEFAULT_ROW_HEIGHT_PX,
}: GanttDependencyArrowsProps) {
  const markerBaseId = useId();
  const amberMarkerId = `${markerBaseId}-amber`;
  const slateMarkerId = `${markerBaseId}-slate`;

  const totalWidth = Math.max(1, dayCount * pixelsPerDay);
  const totalHeight = Math.max(1, rows.length * rowHeightPx);

  const arrows = useMemo<ArrowSegment[]>(() => {
    if (rows.length === 0 || relations.length === 0 || pixelsPerDay <= 0) {
      return [];
    }

    const rowIndexById = new Map<string, number>();
    rows.forEach((row, index) => {
      rowIndexById.set(row.task.id, index);
    });

    const segments: ArrowSegment[] = [];
    for (const rel of relations) {
      if (rel.relationType !== "blocks") continue;
      const sourceIdx = rowIndexById.get(rel.sourceTaskId);
      const targetIdx = rowIndexById.get(rel.targetTaskId);
      if (
        sourceIdx === undefined ||
        targetIdx === undefined ||
        sourceIdx === targetIdx
      ) {
        continue;
      }

      const sourceRow = rows[sourceIdx];
      const targetRow = rows[targetIdx];

      const sourceStartDays = differenceInCalendarDays(
        sourceRow.scheduleStart,
        rangeStart,
      );
      const sourceEndDays =
        differenceInCalendarDays(sourceRow.scheduleEnd, rangeStart) + 1;
      const targetStartDays = differenceInCalendarDays(
        targetRow.scheduleStart,
        rangeStart,
      );

      if (
        (sourceEndDays < 0 && targetStartDays < 0) ||
        (sourceStartDays > dayCount && targetStartDays > dayCount)
      ) {
        continue;
      }

      const rawX1 = sourceRow.isMilestone
        ? (sourceStartDays + 0.5) * pixelsPerDay + 9
        : sourceEndDays * pixelsPerDay - 2;
      const rawX2 = targetRow.isMilestone
        ? (targetStartDays + 0.5) * pixelsPerDay - 10
        : targetStartDays * pixelsPerDay + 2;

      const x1 = Math.max(2, Math.min(totalWidth - 2, rawX1));
      const x2 = Math.max(2, Math.min(totalWidth - 2, rawX2));
      const y1 = sourceIdx * rowHeightPx + rowHeightPx / 2;
      const y2 = targetIdx * rowHeightPx + rowHeightPx / 2;

      let d: string;
      if (x2 >= x1 + 12) {
        const elbowX = x1 + Math.min(12, (x2 - x1) / 2);
        d = `M ${x1} ${y1} L ${elbowX} ${y1} L ${elbowX} ${y2} L ${x2} ${y2}`;
      } else {
        const exitX = Math.min(totalWidth - 4, x1 + 10);
        const entryX = Math.max(4, x2 - 12);
        const midY = y1 + (y2 > y1 ? rowHeightPx * 0.48 : -rowHeightPx * 0.48);
        d = `M ${x1} ${y1} L ${exitX} ${y1} L ${exitX} ${midY} L ${entryX} ${midY} L ${entryX} ${y2} L ${x2} ${y2}`;
      }

      segments.push({
        id: rel.id,
        d,
        variant: sourceRow.isCompleted ? "slate" : "amber",
      });
    }

    return segments;
  }, [
    dayCount,
    pixelsPerDay,
    rangeStart,
    relations,
    rowHeightPx,
    rows,
    totalWidth,
  ]);

  if (arrows.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      data-testid="gantt-dependency-arrows"
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
    >
      <defs>
        <marker
          id={amberMarkerId}
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="M 0 1 L 7 4 L 0 7 z"
            className="fill-amber-600/85 dark:fill-amber-400/85"
          />
        </marker>
        <marker
          id={slateMarkerId}
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="M 0 1 L 7 4 L 0 7 z"
            className="fill-slate-500/75 dark:fill-slate-400/75"
          />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <path
          key={arrow.id}
          d={arrow.d}
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          markerEnd={`url(#${arrow.variant === "amber" ? amberMarkerId : slateMarkerId})`}
          className={
            arrow.variant === "amber"
              ? "stroke-amber-600/80 dark:stroke-amber-400/80"
              : "stroke-slate-500/70 dark:stroke-slate-400/70"
          }
        />
      ))}
    </svg>
  );
}

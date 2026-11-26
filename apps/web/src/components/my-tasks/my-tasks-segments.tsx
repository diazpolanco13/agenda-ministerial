import { cn } from "@/lib/cn";
import type { MyTasksSegment, SegmentCounts } from "./my-tasks-filters";

const SEGMENTS: ReadonlyArray<{
  id: MyTasksSegment;
  label: string;
}> = [
  { id: "all", label: "Activas" },
  { id: "overdue", label: "Vencidas" },
  { id: "today", label: "Hoy" },
  { id: "thisWeek", label: "Esta semana" },
  { id: "upcoming", label: "Próximas" },
  { id: "noDueDate", label: "Sin fecha" },
  { id: "completedRecent", label: "Completadas recientes" },
];

type MyTasksSegmentsProps = {
  value: MyTasksSegment;
  counts: SegmentCounts;
  onChange: (segment: MyTasksSegment) => void;
};

export function MyTasksSegments({
  value,
  counts,
  onChange,
}: MyTasksSegmentsProps) {
  return (
    <div
      role="tablist"
      aria-label="Segmentos de tareas"
      className="flex items-center gap-1 overflow-x-auto border-border/60 border-b px-4 py-2 sm:px-5"
    >
      {SEGMENTS.map((segment) => {
        const active = value === segment.id;
        const count = counts[segment.id] ?? 0;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(segment.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary/40 bg-primary text-primary-foreground"
                : segment.id === "overdue" && count > 0
                  ? "border-destructive/30 bg-destructive/5 text-destructive-foreground hover:bg-destructive/10"
                  : "border-border/70 bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{segment.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[11px] tabular-nums",
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

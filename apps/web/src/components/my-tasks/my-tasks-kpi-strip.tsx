import { AlertTriangle, CalendarCheck2, Clock, TrendingUp } from "lucide-react";
import type { MyTasksKpis } from "@/fetchers/task/get-assigned-tasks";
import { cn } from "@/lib/cn";
import type { MyTasksSegment } from "./my-tasks-filters";

type MyTasksKpiStripProps = {
  kpis?: MyTasksKpis;
  activeSegment: MyTasksSegment;
  onSelectSegment: (segment: MyTasksSegment) => void;
};

export function MyTasksKpiStrip({
  kpis,
  activeSegment,
  onSelectSegment,
}: MyTasksKpiStripProps) {
  const onTimeLabel =
    kpis?.onTimeRate30d != null ? `${kpis.onTimeRate30d}%` : "—";
  const overdue = kpis?.overdueCount ?? 0;
  const dueToday = kpis?.dueTodayCount ?? 0;
  const completedWeek = kpis?.completedThisWeekCount ?? 0;

  return (
    <div
      aria-label="Indicadores personales"
      className="grid grid-cols-2 gap-2 border-border/70 border-b bg-muted/20 px-4 py-2.5 sm:grid-cols-4 sm:px-5"
    >
      <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">
            A tiempo (30d)
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {onTimeLabel}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          onSelectSegment(activeSegment === "overdue" ? "all" : "overdue")
        }
        className={cn(
          "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          activeSegment === "overdue"
            ? "border-destructive/50 bg-destructive/5"
            : "border-border/70 bg-background hover:bg-accent/40",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            overdue > 0
              ? "bg-destructive/15 text-destructive-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <AlertTriangle className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">Vencidas</p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              overdue > 0 ? "text-destructive-foreground" : "text-foreground",
            )}
          >
            {overdue}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() =>
          onSelectSegment(activeSegment === "today" ? "all" : "today")
        }
        className={cn(
          "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          activeSegment === "today"
            ? "border-primary/50 bg-primary/5"
            : "border-border/70 bg-background hover:bg-accent/40",
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-400">
          <Clock className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">Para hoy</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {dueToday}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() =>
          onSelectSegment(
            activeSegment === "completedRecent" ? "all" : "completedRecent",
          )
        }
        className={cn(
          "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          activeSegment === "completedRecent"
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-border/70 bg-background hover:bg-accent/40",
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CalendarCheck2 className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">
            Completadas (7d)
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {completedWeek}
          </p>
        </div>
      </button>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutiveAgendaHoyItem } from "@/fetchers/executive";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import { formatCaracasTime } from "./rank-format";

type AgendaTodayCardProps = {
  workspaceId: string;
  items?: ExecutiveAgendaHoyItem[];
  isLoading: boolean;
  isError: boolean;
};

export function AgendaTodayCard({
  workspaceId,
  items,
  isLoading,
  isError,
}: AgendaTodayCardProps) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/80 bg-card">
      <div className="flex items-center justify-between gap-3 border-border/70 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-semibold text-[15px] text-foreground">
            Agenda de hoy
          </h2>
          {items && items.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground tabular-nums">
              {items.length}
            </span>
          ) : null}
        </div>
        <Link
          to="/dashboard/workspace/$workspaceId/my-tasks"
          params={{ workspaceId }}
          className="shrink-0 font-medium text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Mis tareas
        </Link>
      </div>

      {isLoading && !items ? (
        <div className="flex flex-col divide-y divide-border/50 px-4 py-1 sm:px-5">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 py-3">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError && !items ? (
        <p
          role="alert"
          className="px-4 py-6 text-muted-foreground text-sm sm:px-5"
        >
          No se pudo cargar la agenda de hoy.
        </p>
      ) : !items?.length ? (
        <div className="flex items-center gap-3 px-4 py-6 text-muted-foreground sm:px-5">
          <CalendarCheck2
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground/70"
          />
          <p className="text-sm">Sin actividades programadas para hoy.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((item) => {
            const ticketCode =
              item.number == null
                ? item.projectSlug
                : `${item.projectSlug}-${item.number}`;
            const timeLabel =
              formatCaracasTime(item.dueDate) ??
              formatCaracasTime(item.startDate);

            return (
              <li key={item.id}>
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: item.projectId,
                    taskId: item.id,
                  }}
                  className="flex min-w-0 items-center gap-2.5 px-4 py-2.5 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:px-5"
                >
                  <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
                    {getPriorityIcon(item.priority)}
                  </span>

                  <span
                    className="shrink-0"
                    title={item.statusName ?? item.status}
                  >
                    {item.completada ? (
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      getColumnIcon(item.status, false)
                    )}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                    <span className="hidden shrink-0 font-medium text-muted-foreground text-xs sm:inline">
                      {ticketCode}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 truncate text-sm",
                        item.completada
                          ? "text-muted-foreground line-through"
                          : "font-medium text-foreground",
                      )}
                    >
                      {item.title}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.esOrden ? (
                      <span className="hidden rounded border border-[#556b2f]/30 bg-[#556b2f]/10 px-1.5 py-0.5 font-semibold text-[10px] text-[#3f5122] tracking-wide sm:inline-flex dark:border-[#7fa646]/35 dark:bg-[#7fa646]/15 dark:text-[#b4d67c]">
                        ORDEN
                      </span>
                    ) : null}

                    <span className="hidden max-w-28 truncate text-muted-foreground text-xs md:inline">
                      {item.projectName}
                    </span>

                    {item.responsable ? (
                      <ResponsableAvatar
                        userId={item.responsable.userId}
                        name={item.responsable.name}
                        image={item.responsable.fotoUrl}
                        cedula={item.responsable.cedula}
                        grado={item.responsable.grado}
                        componente={item.responsable.componente}
                        unidad={item.responsable.unidad}
                        size="xs"
                        showHoverCard
                      />
                    ) : null}

                    <span className="w-14 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                      {timeLabel ?? "Hoy"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

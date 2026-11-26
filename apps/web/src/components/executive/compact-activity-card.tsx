import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutiveActividadCompactaItem } from "@/fetchers/executive";
import { formatCaracasActivityDay } from "./rank-format";

type CompactActivityCardProps = {
  workspaceId: string;
  items?: ExecutiveActividadCompactaItem[];
  isLoading: boolean;
  isError: boolean;
};

export function CompactActivityCard({
  workspaceId,
  items,
  isLoading,
  isError,
}: CompactActivityCardProps) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/80 bg-card">
      <div className="flex items-center justify-between gap-3 border-border/70 border-b px-4 py-3 sm:px-5">
        <h2 className="truncate font-semibold text-[15px] text-foreground">
          Actividad
        </h2>
        <span className="shrink-0 text-muted-foreground text-xs">
          Últimos 14 días
        </span>
      </div>

      {isLoading && !items ? (
        <div className="flex flex-col gap-3.5 p-4 sm:p-5">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-start gap-2.5">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : isError && !items ? (
        <p
          role="alert"
          className="px-4 py-6 text-muted-foreground text-sm sm:px-5"
        >
          No se pudo cargar la actividad reciente.
        </p>
      ) : !items?.length ? (
        <div className="flex items-center gap-3 px-4 py-6 text-muted-foreground sm:px-5">
          <Activity
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground/70"
          />
          <p className="text-sm">Sin movimientos recientes en el despacho.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((item) => {
            const ticketCode =
              item.ultimaTarea.number == null
                ? item.ultimaTarea.projectSlug
                : `${item.ultimaTarea.projectSlug}-${item.ultimaTarea.number}`;

            return (
              <li
                key={item.id}
                className="flex min-w-0 items-start gap-2.5 px-4 py-3 sm:px-5"
              >
                <ResponsableAvatar
                  name={item.actorNombre}
                  image={item.actorFotoUrl}
                  cedula={item.actorCedula}
                  grado={item.actorGrado}
                  size="sm"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[13px] text-foreground leading-snug">
                    {item.resumen}
                  </p>
                  <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                    <Link
                      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                      params={{
                        workspaceId,
                        projectId: item.ultimaTarea.projectId,
                        taskId: item.ultimaTarea.id,
                      }}
                      className="min-w-0 truncate transition-colors hover:text-foreground"
                    >
                      <span className="font-medium">{ticketCode}</span>{" "}
                      {item.ultimaTarea.title}
                    </Link>
                    <span aria-hidden="true">·</span>
                    <time
                      dateTime={item.ultimaHora}
                      className="shrink-0 whitespace-nowrap tabular-nums"
                    >
                      {formatCaracasActivityDay(item.dia, item.ultimaHora)}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

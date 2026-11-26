import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutiveOrdenReciente } from "@/fetchers/executive";
import { cn } from "@/lib/cn";
import { componentLogo, rankInsignia } from "@/lib/military-assets";
import { getPriorityIcon } from "@/lib/priority";
import {
  abbreviateMilitaryRank,
  formatCaracasDueStatus,
  stripRankPrefix,
} from "./rank-format";

type RecentOrdersCardProps = {
  workspaceId: string;
  items?: ExecutiveOrdenReciente[];
  isLoading: boolean;
  isError: boolean;
};

const DUE_TONE_CLASSES: Record<
  ReturnType<typeof formatCaracasDueStatus>["tone"],
  { text: string; dot: string }
> = {
  overdue: {
    text: "font-medium text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  today: {
    text: "font-medium text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  upcoming: {
    text: "text-muted-foreground",
    dot: "bg-[#213368]/60 dark:bg-[#4f72c4]/80",
  },
  completed: {
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  none: {
    text: "text-muted-foreground/80",
    dot: "bg-muted-foreground/35",
  },
};

export function RecentOrdersCard({
  workspaceId,
  items,
  isLoading,
  isError,
}: RecentOrdersCardProps) {
  const hasExplicitOrders = items?.some((item) => item.esOrden) ?? false;

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/80 bg-card">
      <div className="flex items-center justify-between gap-3 border-border/70 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-semibold text-[15px] text-foreground">
            Órdenes recientes del Ministro
          </h2>
          {items && items.length > 0 && !hasExplicitOrders ? (
            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">
              Recientes del despacho
            </span>
          ) : null}
        </div>
        <Link
          to="/dashboard/workspace/$workspaceId/projects"
          params={{ workspaceId }}
          className="shrink-0 font-medium text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Proyectos
        </Link>
      </div>

      {isLoading && !items ? (
        <div className="flex flex-col divide-y divide-border/50 px-4 py-1 sm:px-5">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3 py-3.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : isError && !items ? (
        <p
          role="alert"
          className="px-4 py-6 text-muted-foreground text-sm sm:px-5"
        >
          No se pudieron cargar las órdenes recientes.
        </p>
      ) : !items?.length ? (
        <div className="flex items-center gap-3 px-4 py-8 text-muted-foreground sm:px-5">
          <ClipboardList
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground/70"
          />
          <p className="text-sm">
            Aún no hay órdenes ni instrucciones registradas en este despacho.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((item) => {
            const due = formatCaracasDueStatus(item.dueDate, item.completada);
            const tone = DUE_TONE_CLASSES[due.tone];
            const resp = item.responsable;
            const insigniaSrc =
              resp?.insignia ??
              (resp?.grado
                ? rankInsignia(resp.grado, resp.componente, resp.unidad)?.src
                : null) ??
              null;
            const compLogo = resp?.componente
              ? componentLogo(resp.componente)
              : null;
            const shortRank = abbreviateMilitaryRank(resp?.grado);
            const cleanRespName = resp ? stripRankPrefix(resp.name) : "";
            const ticketCode =
              item.number == null
                ? item.projectSlug
                : `${item.projectSlug}-${item.number}`;

            return (
              <li key={item.id}>
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: item.projectId,
                    taskId: item.id,
                  }}
                  className="flex min-w-0 items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 sm:items-center sm:px-5"
                >
                  <div className="pt-0.5 sm:pt-0">
                    <ResponsableAvatar
                      assigned={Boolean(resp)}
                      userId={resp?.userId}
                      name={resp?.name}
                      image={resp?.fotoUrl}
                      cedula={resp?.cedula}
                      grado={resp?.grado}
                      componente={resp?.componente}
                      unidad={resp?.unidad}
                      size="md"
                      showHoverCard
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex shrink-0 items-center [&_svg]:size-3.5">
                        {getPriorityIcon(item.priority)}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          item.completada
                            ? "text-muted-foreground line-through"
                            : "font-medium text-foreground",
                        )}
                      >
                        {item.title}
                      </span>
                      {item.esOrden ? (
                        <span className="hidden shrink-0 rounded border border-[#556b2f]/30 bg-[#556b2f]/10 px-1.5 py-0.5 font-semibold text-[10px] text-[#3f5122] tracking-wide sm:inline-flex dark:border-[#7fa646]/35 dark:bg-[#7fa646]/15 dark:text-[#b4d67c]">
                          ORDEN
                        </span>
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
                      {resp ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          {insigniaSrc ? (
                            <img
                              src={insigniaSrc}
                              alt={resp.grado ?? "Grado"}
                              className="h-3 w-auto shrink-0 object-contain"
                            />
                          ) : null}
                          {compLogo ? (
                            <img
                              src={compLogo.src}
                              alt={compLogo.code}
                              className="size-3.5 shrink-0 object-contain"
                            />
                          ) : null}
                          <span className="truncate text-foreground/85">
                            {shortRank
                              ? `${shortRank} ${cleanRespName}`
                              : cleanRespName}
                          </span>
                        </span>
                      ) : (
                        <span>Sin responsable asignado</span>
                      )}

                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.projectName}</span>
                      <span className="hidden text-muted-foreground/70 md:inline">
                        ({ticketCode})
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:pt-0">
                    <span
                      aria-hidden="true"
                      className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
                    />
                    <span
                      className={cn(
                        "whitespace-nowrap text-xs tabular-nums",
                        tone.text,
                      )}
                    >
                      {due.label}
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

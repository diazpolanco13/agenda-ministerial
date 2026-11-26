import { Users } from "lucide-react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutiveTopResponsable } from "@/fetchers/executive";
import { abbreviateMilitaryRank, stripRankPrefix } from "./rank-format";

type TopResponsablesCardProps = {
  items?: ExecutiveTopResponsable[];
  isLoading: boolean;
  isError: boolean;
};

export function TopResponsablesCard({
  items,
  isLoading,
  isError,
}: TopResponsablesCardProps) {
  const maxOpen =
    items?.reduce(
      (max, item) => (item.abiertas > max ? item.abiertas : max),
      1,
    ) ?? 1;

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/80 bg-card">
      <div className="flex items-center justify-between gap-3 border-border/70 border-b px-4 py-3 sm:px-5">
        <h2 className="truncate font-semibold text-[15px] text-foreground">
          Responsables con más pendientes
        </h2>
        <span className="shrink-0 text-muted-foreground text-xs">Top 5</span>
      </div>

      {isLoading && !items ? (
        <div className="flex flex-col gap-3.5 p-4 sm:p-5">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 w-10" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : isError && !items ? (
        <p
          role="alert"
          className="px-4 py-6 text-muted-foreground text-sm sm:px-5"
        >
          No se pudo cargar la carga por responsable.
        </p>
      ) : !items?.length ? (
        <div className="flex items-center gap-3 px-4 py-6 text-muted-foreground sm:px-5">
          <Users
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground/70"
          />
          <p className="text-sm">Sin tareas abiertas asignadas.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {items.map((person) => {
            const totalPct = Math.max(
              6,
              Math.round((person.abiertas / maxOpen) * 100),
            );
            const overduePct =
              person.abiertas > 0
                ? Math.round((person.vencidas / person.abiertas) * totalPct)
                : 0;
            const rank = abbreviateMilitaryRank(person.grado);
            const cleanName = stripRankPrefix(person.name);

            return (
              <li
                key={person.userId}
                className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <ResponsableAvatar
                    userId={person.userId}
                    name={person.name}
                    image={person.fotoUrl}
                    cedula={person.cedula}
                    grado={person.grado}
                    componente={person.componente}
                    unidad={person.unidad}
                    size="sm"
                    showHoverCard
                  />

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {rank ? `${rank} ${cleanName}` : cleanName}
                    </span>
                    {person.unidad || person.componente ? (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {person.unidad ?? person.componente}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                    {person.vencidas > 0 ? (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-medium text-[11px] text-red-600 dark:text-red-400">
                        {person.vencidas} venc.
                      </span>
                    ) : null}
                    <span className="font-semibold text-foreground text-sm">
                      {person.abiertas}
                    </span>
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-[#213368]/80 dark:bg-[#4f72c4]"
                    style={{ width: `${totalPct}%` }}
                  />
                  {overduePct > 0 ? (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-red-500"
                      style={{ width: `${overduePct}%` }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

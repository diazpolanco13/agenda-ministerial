import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutiveKpis } from "@/fetchers/executive";
import { cn } from "@/lib/cn";

type KpiStripProps = {
  kpis?: ExecutiveKpis;
  isLoading: boolean;
};

type KpiCardItem = {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  dotClass: string;
  surfaceClass: string;
  valueClass?: string;
  spanTwoMobile?: boolean;
};

export function KpiStrip({ kpis, isLoading }: KpiStripProps) {
  if (isLoading && !kpis) {
    return (
      <section
        aria-label="Indicadores de gestión"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className={cn(
              "rounded-xl border border-border/80 bg-card p-3.5 sm:p-4",
              item === 5 && "col-span-2 lg:col-span-1",
            )}
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </section>
    );
  }

  const data = kpis ?? {
    vencidas: 0,
    vencenHoy: 0,
    vencenSemana: 0,
    ordenesPendientes: 0,
    cumplimientoATiempoPct: null,
    cumplimientoEnPlazo: 0,
    cumplimientoBase: 0,
    totalAbiertas: 0,
    totalCompletadas: 0,
  };

  const items: KpiCardItem[] = [
    {
      id: "vencidas",
      label: "Vencidas",
      value: String(data.vencidas),
      sublabel: data.vencidas > 0 ? "Requieren atención" : "Sin retrasos",
      dotClass: data.vencidas > 0 ? "bg-red-500" : "bg-muted-foreground/40",
      surfaceClass:
        data.vencidas > 0
          ? "border-red-500/30 bg-red-500/[0.03] dark:bg-red-500/[0.05]"
          : "border-border/80 bg-card",
      valueClass:
        data.vencidas > 0 ? "text-red-600 dark:text-red-400" : undefined,
    },
    {
      id: "vencen-hoy",
      label: "Vencen hoy",
      value: String(data.vencenHoy),
      sublabel: data.vencenHoy > 0 ? "Cierre jornada" : "Despacho al día",
      dotClass: data.vencenHoy > 0 ? "bg-amber-500" : "bg-muted-foreground/40",
      surfaceClass:
        data.vencenHoy > 0
          ? "border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-500/[0.05]"
          : "border-border/80 bg-card",
      valueClass:
        data.vencenHoy > 0 ? "text-amber-700 dark:text-amber-400" : undefined,
    },
    {
      id: "esta-semana",
      label: "Esta semana",
      value: String(data.vencenSemana),
      sublabel: "Próximos 7 días",
      dotClass: "bg-[#213368] dark:bg-[#4f72c4]",
      surfaceClass: "border-border/80 bg-card",
    },
    {
      id: "ordenes-pendientes",
      label: "Órdenes pendientes",
      value: String(data.ordenesPendientes),
      sublabel: `${data.totalAbiertas} tareas abiertas`,
      dotClass: "bg-[#556b2f] dark:bg-[#7fa646]",
      surfaceClass: "border-border/80 bg-card",
    },
    {
      id: "cumplimiento",
      label: "Cumplimiento",
      value:
        data.cumplimientoATiempoPct !== null
          ? `${data.cumplimientoATiempoPct}%`
          : "—",
      sublabel:
        data.cumplimientoBase > 0
          ? `${data.cumplimientoEnPlazo} de ${data.cumplimientoBase} en plazo`
          : `${data.totalCompletadas} finalizadas`,
      dotClass: "bg-emerald-500",
      surfaceClass: "border-border/80 bg-card",
      valueClass:
        data.cumplimientoATiempoPct !== null &&
        data.cumplimientoATiempoPct >= 80
          ? "text-emerald-700 dark:text-emerald-400"
          : undefined,
      spanTwoMobile: true,
    },
  ];

  return (
    <section
      aria-label="Indicadores de gestión"
      className="grid grid-cols-2 gap-3 lg:grid-cols-5"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex min-w-0 flex-col justify-between rounded-xl border p-3.5 transition-colors sm:p-4",
            item.surfaceClass,
            item.spanTwoMobile && "col-span-2 lg:col-span-1",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-muted-foreground text-xs">
              {item.label}
            </span>
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", item.dotClass)}
            />
          </div>
          <p
            className={cn(
              "mt-2 font-semibold text-2xl text-foreground tracking-tight tabular-nums sm:text-[26px]",
              item.valueClass,
            )}
          >
            {item.value}
          </p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
            {item.sublabel}
          </p>
        </div>
      ))}
    </section>
  );
}

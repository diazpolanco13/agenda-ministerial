import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Search, UserSearch } from "lucide-react";
import { useState } from "react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Badge } from "@/components/ui/badge";
import {
  buscarPersonalInteligenteSigefanb,
  type SigefanbPersonalItem,
} from "@/fetchers/sigefanb";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/cn";
import { HttpError } from "@/lib/http-error";
import { maskCedula, rankInsignia } from "@/lib/military-assets";

type SigefanbPersonSearchProps = {
  onSelect: (item: SigefanbPersonalItem) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

type ComponentFilterValue = "ALL" | "EJB" | "ARB" | "AMB" | "GNB" | "MIL";

const COMPONENT_FILTERS: readonly {
  value: ComponentFilterValue;
  label: string;
}[] = [
  { value: "ALL", label: "Todos" },
  { value: "EJB", label: "EJB" },
  { value: "ARB", label: "ARB" },
  { value: "AMB", label: "AMB" },
  { value: "GNB", label: "GNB" },
  { value: "MIL", label: "MIL" },
];

const MIN_QUERY_LENGTH = 3;

function formatSearchError(error: unknown): string {
  if (error instanceof HttpError && error.status === 503) {
    return "El servicio SIGEFANB no está disponible en este momento.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "No se pudo consultar el directorio SIGEFANB.";
}

export function SigefanbPersonSearch({
  onSelect,
  disabled = false,
  autoFocus = true,
}: SigefanbPersonSearchProps) {
  const [query, setQuery] = useState("");
  const [componenteFilter, setComponenteFilter] =
    useState<ComponentFilterValue>("ALL");

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);

  const isWaitingDebounce =
    trimmedQuery.length >= MIN_QUERY_LENGTH && trimmedQuery !== debouncedQuery;
  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;
  const activeComponente =
    componenteFilter === "ALL" ? undefined : componenteFilter;

  const {
    data: results = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "sigefanb-personal-smart-search",
      debouncedQuery,
      activeComponente ?? "ALL",
    ],
    queryFn: () =>
      buscarPersonalInteligenteSigefanb({
        q: debouncedQuery,
        componente: activeComponente,
      }),
    enabled: canSearch,
    staleTime: 60_000,
    retry: false,
  });

  const showLoading = isWaitingDebounce || (canSearch && isLoading);

  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center gap-2 border-border/80 border-b px-3">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="search"
          autoFocus={autoFocus}
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar personal en SIGEFANB"
          placeholder="Nombre, grado, apodo o cédula (mín. 3 car.)..."
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
      </div>

      <div
        role="group"
        aria-label="Filtrar por componente FANB"
        className="flex flex-wrap items-center gap-1 border-border/60 border-b bg-muted/30 px-2 py-1.5"
      >
        {COMPONENT_FILTERS.map((filter) => {
          const isActive = componenteFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              disabled={disabled}
              aria-pressed={isActive}
              onClick={() => setComponenteFilter(filter.value)}
              className={cn(
                "rounded px-1.5 py-0.5 font-medium text-[11px] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {trimmedQuery.length < MIN_QUERY_LENGTH ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground">
          <UserSearch className="size-5 opacity-70" />
          <p className="text-xs">
            Escribe al menos 3 caracteres (nombre, apodo, grado o cédula) para
            buscar en SIGEFANB.
          </p>
        </div>
      ) : showLoading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Buscando en SIGEFANB...</span>
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 px-3 py-5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{formatSearchError(error)}</span>
        </div>
      ) : results.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No se encontró personal para «{debouncedQuery}»
          {activeComponente ? ` en ${activeComponente}` : ""}.
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto p-1">
          {results.map((item) => {
            const insigniaSrc =
              item.insignia ??
              rankInsignia(item.grado, item.componente, item.unidad)?.src ??
              null;
            const matchPercent = Math.round(item.score * 100);

            return (
              <button
                key={item.cedula}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(item)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors outline-none",
                  "hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                <ResponsableAvatar
                  size="md"
                  name={item.nombreCompleto}
                  image={item.fotoUrl}
                  cedula={item.cedula}
                  nacionalidad={item.nacionalidad}
                  grado={item.grado}
                  componente={item.componente}
                  unidad={item.unidad}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {insigniaSrc ? (
                      <img
                        src={insigniaSrc}
                        alt={item.grado}
                        className="h-3.5 w-auto shrink-0 object-contain"
                      />
                    ) : null}
                    <span className="truncate font-medium text-[11px] text-primary">
                      {item.grado}
                    </span>
                    {item.componente ? (
                      <Badge
                        variant="secondary"
                        size="sm"
                        className="ml-auto shrink-0"
                      >
                        {item.componente}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate font-medium text-[13px] text-foreground">
                    {item.nombreCompleto}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {item.unidad ? `${item.unidad} · ` : ""}
                    {maskCedula(item.cedula, item.nacionalidad)}
                  </p>
                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-muted-foreground/85">
                    <span className="truncate">{item.motivo}</span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {matchPercent}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Search, UserSearch } from "lucide-react";
import { useState } from "react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Badge } from "@/components/ui/badge";
import {
  buscarPersonalSigefanb,
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
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);

  const isWaitingDebounce =
    trimmedQuery.length >= MIN_QUERY_LENGTH && trimmedQuery !== debouncedQuery;
  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const {
    data: results = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["sigefanb-personal-search", debouncedQuery],
    queryFn: () => buscarPersonalSigefanb(debouncedQuery),
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
          placeholder="Buscar por cédula o nombre (mín. 3 caracteres)..."
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
      </div>

      {trimmedQuery.length < MIN_QUERY_LENGTH ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center text-muted-foreground">
          <UserSearch className="size-5 opacity-70" />
          <p className="text-xs">
            Ingresa al menos 3 caracteres de la cédula o nombre para buscar en
            SIGEFANB.
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
          No se encontró personal para «{debouncedQuery}».
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto p-1">
          {results.map((item) => {
            const insigniaSrc =
              item.insignia ??
              rankInsignia(item.grado, item.componente, item.unidad)?.src ??
              null;

            return (
              <button
                key={item.cedula}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors outline-none",
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
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

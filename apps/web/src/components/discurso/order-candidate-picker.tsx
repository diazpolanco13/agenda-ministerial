import { Check, Search, Sparkles, UserX } from "lucide-react";
import { useState } from "react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { SigefanbPersonSearch } from "@/components/sigefanb/sigefanb-person-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  DiscursoCandidatoResponsable,
  DiscursoOrdenBorrador,
} from "@/fetchers/discurso";
import type { SigefanbPersonalItem } from "@/fetchers/sigefanb";
import { cn } from "@/lib/cn";

type OrderCandidatePickerProps = {
  orden: DiscursoOrdenBorrador;
  disabled?: boolean;
  onChange: (patch: Partial<DiscursoOrdenBorrador>) => void;
};

function toCandidate(item: SigefanbPersonalItem): DiscursoCandidatoResponsable {
  return {
    ...item,
    componente:
      item.componente === "EJB" ||
      item.componente === "ARB" ||
      item.componente === "AMB" ||
      item.componente === "GNB" ||
      item.componente === "MIL"
        ? item.componente
        : null,
    score: 1,
    motivo: "Selección manual",
  };
}

export function OrderCandidatePicker({
  orden,
  disabled = false,
  onChange,
}: OrderCandidatePickerProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const selectedCandidate =
    orden.responsableCedula != null
      ? (orden.candidatos.find((c) => c.cedula === orden.responsableCedula) ??
        null)
      : null;

  const selectCandidate = (
    candidate: DiscursoCandidatoResponsable,
    modo: "auto" | "manual",
  ) => {
    const exists = orden.candidatos.some((c) => c.cedula === candidate.cedula);
    const nextCandidatos = exists
      ? orden.candidatos
      : [candidate, ...orden.candidatos].slice(0, 4);

    onChange({
      asignacionModo: modo,
      responsableCedula: candidate.cedula,
      responsableUserId: null,
      candidatos: nextCandidatos,
    });
  };

  const clearResponsible = () => {
    onChange({
      asignacionModo: "sin_responsable",
      responsableCedula: null,
      responsableUserId: null,
    });
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {selectedCandidate ? (
            <>
              <ResponsableAvatar
                size="sm"
                name={selectedCandidate.nombreCompleto}
                image={selectedCandidate.fotoUrl}
                cedula={selectedCandidate.cedula}
                nacionalidad={selectedCandidate.nacionalidad}
                grado={selectedCandidate.grado}
                componente={selectedCandidate.componente}
                unidad={selectedCandidate.unidad}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium text-xs text-foreground">
                    {selectedCandidate.grado} {selectedCandidate.nombreCompleto}
                  </span>
                  {orden.asignacionModo === "auto" ? (
                    <Badge
                      variant="outline"
                      size="sm"
                      className="border-[#4B5D3A]/40 bg-[#4B5D3A]/10 text-[#3B4B2D] dark:text-[#A9C28E]"
                    >
                      <Sparkles className="size-2.5" />
                      Auto
                    </Badge>
                  ) : (
                    <Badge variant="secondary" size="sm">
                      Manual
                    </Badge>
                  )}
                </div>
                {selectedCandidate.unidad ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selectedCandidate.unidad}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ResponsableAvatar assigned={false} size="sm" />
              <span>Sin responsable asignado</span>
              {orden.responsableMencionado ? (
                <span className="hidden truncate text-[11px] text-muted-foreground/80 sm:inline">
                  · Mención: {orden.responsableMencionado}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={disabled}
              >
                <Search className="size-3" />
                Buscar en SIGEFANB
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(340px,calc(100vw-2rem))] p-0"
            >
              <SigefanbPersonSearch
                disabled={disabled}
                onSelect={(item) => {
                  selectCandidate(toCandidate(item), "manual");
                  setSearchOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>

          {selectedCandidate ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled}
              onClick={clearResponsible}
              className="text-muted-foreground"
            >
              <UserX className="size-3" />
              Sin responsable
            </Button>
          ) : null}
        </div>
      </div>

      {orden.candidatos.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {orden.candidatos.slice(0, 3).map((candidate) => {
            const isSelected = orden.responsableCedula === candidate.cedula;
            return (
              <button
                key={candidate.cedula}
                type="button"
                disabled={disabled}
                onClick={() => selectCandidate(candidate, "manual")}
                className={cn(
                  "flex max-w-full min-w-0 items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors",
                  isSelected
                    ? "border-[#4B5D3A]/60 bg-[#4B5D3A]/10 text-foreground"
                    : "border-border/80 bg-background hover:bg-accent/50",
                )}
              >
                <ResponsableAvatar
                  size="xs"
                  name={candidate.nombreCompleto}
                  image={candidate.fotoUrl}
                  cedula={candidate.cedula}
                  nacionalidad={candidate.nacionalidad}
                  grado={candidate.grado}
                  componente={candidate.componente}
                  unidad={candidate.unidad}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-medium text-[11px] text-foreground">
                      {candidate.grado ? `${candidate.grado} ` : ""}
                      {candidate.nombreCompleto}
                    </span>
                    <span className="shrink-0 rounded bg-muted px-1 py-0.2 font-mono text-[10px] text-muted-foreground">
                      {Math.round(candidate.score * 100)}%
                    </span>
                    {isSelected ? (
                      <Check className="size-3 shrink-0 text-[#4B5D3A]" />
                    ) : null}
                  </div>
                  {candidate.unidad ? (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {candidate.unidad}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

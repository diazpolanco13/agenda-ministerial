import { useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExecutiveUsuario } from "@/fetchers/executive";
import { componentLogo } from "@/lib/military-assets";
import {
  abbreviateMilitaryRank,
  formatCaracasLongDate,
  getCaracasGreeting,
  stripRankPrefix,
} from "./rank-format";

type CommandHeaderProps = {
  workspaceId: string;
  usuario?: ExecutiveUsuario;
  isLoading: boolean;
  canCreateTasks: boolean;
  needsProjectFirst: boolean;
  onCreateTask: () => void;
};

function buildGreetingName(usuario: ExecutiveUsuario): string {
  const cleanName = stripRankPrefix(usuario.name);
  const tokens = cleanName.split(/\s+/).filter(Boolean);
  const shortPerson =
    tokens.length <= 2
      ? cleanName
      : `${tokens[0]} ${tokens[tokens.length - 2]}`;
  const rank =
    usuario.gradoCorto ?? abbreviateMilitaryRank(usuario.grado) ?? null;

  if (rank && shortPerson) return `${rank} ${shortPerson}`;
  if (shortPerson) return shortPerson;
  return usuario.name;
}

export function CommandHeader({
  workspaceId,
  usuario,
  isLoading,
  canCreateTasks,
  needsProjectFirst,
  onCreateTask,
}: CommandHeaderProps) {
  const navigate = useNavigate();
  const greeting = getCaracasGreeting();
  const rawDateLabel = formatCaracasLongDate();
  const dateLabel =
    rawDateLabel.charAt(0).toLocaleUpperCase("es-VE") + rawDateLabel.slice(1);
  const compLogo = usuario?.componente
    ? componentLogo(usuario.componente)
    : null;
  const discursoUrl = `/dashboard/workspace/${workspaceId}/discurso`;

  const titleText = usuario
    ? `${greeting}, ${buildGreetingName(usuario)}`
    : greeting;

  return (
    <header className="flex flex-col gap-4 border-border/80 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          <span>{dateLabel}</span>
          {usuario?.unidad || compLogo ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {compLogo ? (
                  <img
                    src={compLogo.src}
                    alt={compLogo.name}
                    className="size-3.5 shrink-0 object-contain"
                  />
                ) : null}
                <span className="truncate">
                  {usuario?.unidad ?? compLogo?.name}
                </span>
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          {usuario?.insignia ? (
            <img
              src={usuario.insignia}
              alt={usuario.grado ?? "Insignia"}
              className="h-5 w-auto shrink-0 object-contain sm:h-6"
            />
          ) : null}
          {isLoading && !usuario ? (
            <Skeleton className="h-8 w-64 sm:w-80" />
          ) : (
            <h1 className="min-w-0 font-semibold text-xl leading-snug text-foreground tracking-tight sm:truncate sm:text-[28px]">
              {titleText}
            </h1>
          )}
        </div>
      </div>

      {canCreateTasks ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-border/80"
            onClick={() => navigate({ to: discursoUrl })}
          >
            <FileText />
            <span>Desde discurso</span>
          </Button>
          <Button size="sm" onClick={onCreateTask}>
            <Plus />
            <span>{needsProjectFirst ? "Nuevo proyecto" : "Nueva tarea"}</span>
          </Button>
        </div>
      ) : null}
    </header>
  );
}

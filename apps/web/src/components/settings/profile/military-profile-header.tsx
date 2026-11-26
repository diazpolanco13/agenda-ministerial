import { ShieldCheckIcon } from "lucide-react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  componentLogo,
  deriveMilitaryCategory,
  formatGradoCorto,
  maskCedulaDotted,
  rankInsignia,
} from "@/lib/military-assets";
import type { MilitarProfile } from "@/types/user";
import {
  DEMO_MILITAR_PREVIEW,
  resolveInstitutionalRoleLabel,
} from "./military-profile-helpers";

type MilitaryProfileHeaderProps = {
  user:
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        role?: string | null;
      }
    | null
    | undefined;
  militar: MilitarProfile | null;
  isDemo?: boolean;
  isLoading?: boolean;
};

/**
 * Cabecera institucional minimalista de la Ficha Militar del usuario.
 */
export function MilitaryProfileHeader({
  user,
  militar,
  isDemo = false,
  isLoading = false,
}: MilitaryProfileHeaderProps) {
  const roleLabel = resolveInstitutionalRoleLabel(user?.role);

  const effectiveRank =
    militar?.grado ?? (isDemo ? DEMO_MILITAR_PREVIEW.grado : null);
  const effectiveComponent =
    militar?.componente ?? (isDemo ? DEMO_MILITAR_PREVIEW.componente : null);
  const effectiveUnit =
    militar?.unidad ?? (isDemo ? DEMO_MILITAR_PREVIEW.unidad : null);

  const insignia = effectiveRank
    ? (rankInsignia(effectiveRank, effectiveComponent, effectiveUnit) ??
      (militar?.insignia
        ? {
            name: effectiveRank,
            src: militar.insignia,
            shape: "horizontal" as const,
          }
        : null))
    : null;

  const compLogo = effectiveComponent
    ? componentLogo(effectiveComponent)
    : null;
  const category = deriveMilitaryCategory(effectiveRank);
  const shortRank = formatGradoCorto(effectiveRank);
  const maskedCedula = militar
    ? maskCedulaDotted(militar.cedula, militar.nacionalidad)
    : isDemo
      ? `${maskCedulaDotted(DEMO_MILITAR_PREVIEW.cedula, DEMO_MILITAR_PREVIEW.nacionalidad)} (DEMO)`
      : null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="size-20 shrink-0 animate-pulse rounded-full bg-muted sm:size-24" />
          <div className="flex-1 space-y-2.5">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted/80" />
            <div className="h-4 w-56 max-w-full animate-pulse rounded bg-muted/60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Resumen de Ficha Militar"
      className="rounded-xl border border-border/80 bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <ResponsableAvatar
          userId={user?.id}
          name={user?.name}
          image={user?.image}
          cedula={militar?.cedula ?? null}
          nacionalidad={militar?.nacionalidad ?? null}
          grado={effectiveRank}
          componente={effectiveComponent}
          unidad={effectiveUnit}
          size="lg"
          className="size-20 text-xl sm:size-24 sm:text-2xl"
        />

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {insignia ? (
              <img
                src={insignia.src}
                alt={insignia.name}
                className={cn(
                  "shrink-0 object-contain",
                  insignia.shape === "vertical" ? "h-6 w-auto" : "h-4 w-auto",
                )}
              />
            ) : null}

            {effectiveRank ? (
              <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                {shortRank && shortRank !== effectiveRank
                  ? `${shortRank} · ${effectiveRank}`
                  : effectiveRank}
              </span>
            ) : null}

            {isDemo ? (
              <Badge variant="warning">DEMO</Badge>
            ) : militar ? (
              militar.pendiente ? (
                <Badge variant="warning">Pendiente de primer ingreso</Badge>
              ) : (
                <Badge variant="success">Activo</Badge>
              )
            ) : (
              <Badge variant="secondary">Sin cédula vinculada</Badge>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {user?.name || "Usuario institucional"}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {category ? (
                <span className="font-medium text-foreground/85">
                  {category}
                </span>
              ) : null}

              <Badge variant="outline" className="gap-1">
                <ShieldCheckIcon className="size-3" aria-hidden="true" />
                {roleLabel}
              </Badge>

              {maskedCedula ? (
                <span className="font-mono text-foreground/80">
                  {maskedCedula}
                </span>
              ) : user?.email ? (
                <span className="truncate">{user.email}</span>
              ) : null}
            </div>
          </div>

          {compLogo || effectiveComponent || effectiveUnit ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
              {compLogo || effectiveComponent ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
                  {compLogo ? (
                    <img
                      src={compLogo.src}
                      alt={compLogo.name}
                      className="size-4 shrink-0 object-contain"
                    />
                  ) : null}
                  <span>{compLogo?.name ?? effectiveComponent}</span>
                </span>
              ) : null}
              {effectiveUnit ? (
                <span className="min-w-0 truncate text-muted-foreground">
                  {effectiveUnit}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

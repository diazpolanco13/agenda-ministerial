import {
  INSTITUTIONAL_ROLE_LABELS,
  isInstitutionalRole,
} from "@kaneo/permissions";
import { LockIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCurrentUser,
  useSyncSigefanbProfile,
} from "@/hooks/queries/user/use-current-user";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { componentLogo, maskCedula, rankInsignia } from "@/lib/military-assets";

function resolveRoleLabel(role: string | null | undefined): string {
  if (!role) return "Usuario";
  const primary = role.split(",")[0]?.trim() ?? role;
  if (isInstitutionalRole(primary)) {
    return INSTITUTIONAL_ROLE_LABELS[primary];
  }
  return primary === "user" ? "Usuario" : primary;
}

/**
 * Ficha militar institucional de solo lectura sincronizada con SIGEFANB.
 */
export function SigefanbProfileCard() {
  const { data: currentUser, isLoading } = useCurrentUser();
  const syncMutation = useSyncSigefanbProfile();

  const militar = currentUser?.militar ?? null;
  const roleLabel = resolveRoleLabel(currentUser?.role);

  const insignia = militar
    ? (rankInsignia(militar.grado, militar.componente, militar.unidad) ??
      (militar.insignia
        ? {
            name: militar.grado ?? "Insignia",
            src: militar.insignia,
            shape: "horizontal" as const,
          }
        : null))
    : null;
  const compLogo = militar?.componente
    ? componentLogo(militar.componente)
    : null;

  return (
    <SettingsSection
      title="Ficha institucional SIGEFANB"
      description="Datos militares oficiales de solo lectura vinculados desde SIGEFANB."
      action={
        militar ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            <RefreshCwIcon
              className={cn(
                "size-3.5",
                syncMutation.isPending && "animate-spin",
              )}
              aria-hidden="true"
            />
            {syncMutation.isPending
              ? "Sincronizando…"
              : "Sincronizar con SIGEFANB"}
          </Button>
        ) : null
      }
    >
      <SettingsCard>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Cargando ficha institucional…
          </div>
        ) : !militar ? (
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Sin cédula SIGEFANB vinculada
                </span>
                <Badge variant="outline">{roleLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta cuenta accede con correo electrónico institucional y no
                tiene un expediente militar asociado.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
              <ResponsableAvatar
                userId={currentUser?.id}
                name={currentUser?.name}
                image={currentUser?.image}
                cedula={militar.cedula}
                nacionalidad={militar.nacionalidad}
                grado={militar.grado}
                componente={militar.componente}
                unidad={militar.unidad}
                size="lg"
                className="size-16 text-lg"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {insignia ? (
                    <img
                      src={insignia.src}
                      alt={insignia.name}
                      className={cn(
                        "shrink-0 object-contain",
                        insignia.shape === "vertical"
                          ? "h-5 w-auto"
                          : "h-3.5 w-auto",
                      )}
                    />
                  ) : null}
                  <span className="text-sm font-semibold text-foreground">
                    {currentUser?.name}
                  </span>
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheckIcon className="size-3" aria-hidden="true" />
                    {roleLabel}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="gap-1 text-[11px] text-muted-foreground"
                  >
                    <LockIcon className="size-2.5" aria-hidden="true" />
                    Solo lectura
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {militar.grado ? (
                    <span className="font-medium text-primary">
                      {militar.grado}
                    </span>
                  ) : null}
                  <span className="font-mono">
                    Cédula: {maskCedula(militar.cedula, militar.nacionalidad)}
                  </span>
                  {compLogo || militar.componente ? (
                    <span className="inline-flex items-center gap-1.5">
                      {compLogo ? (
                        <img
                          src={compLogo.src}
                          alt={compLogo.name}
                          className="size-4 shrink-0 object-contain"
                        />
                      ) : null}
                      <span>{compLogo?.name ?? militar.componente}</span>
                    </span>
                  ) : null}
                </div>

                {militar.unidad ? (
                  <p className="text-xs text-muted-foreground">
                    Unidad:{" "}
                    <span className="text-foreground">{militar.unidad}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 bg-muted/20 px-4 py-3 text-xs sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Grado (solo lectura)</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {militar.grado ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  Componente (solo lectura)
                </p>
                <p className="mt-0.5 font-medium text-foreground">
                  {compLogo?.name ?? militar.componente ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Última sincronización</p>
                <p className="mt-0.5 font-medium text-foreground tabular-nums">
                  {militar.sincronizadoEn
                    ? formatDateTime(militar.sincronizadoEn)
                    : "Sin sincronizar"}
                </p>
              </div>
            </div>
          </>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}

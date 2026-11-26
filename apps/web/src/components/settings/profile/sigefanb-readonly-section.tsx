import { Link } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  IdCardIcon,
  LockIcon,
  RefreshCwIcon,
  UserCheckIcon,
} from "lucide-react";
import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { SigefanbPersonSearch } from "@/components/sigefanb/sigefanb-person-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SigefanbPersonalItem } from "@/fetchers/sigefanb";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import { useSyncSigefanbProfile } from "@/hooks/queries/user/use-current-user";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
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
  hasAdminUserRole,
} from "./military-profile-helpers";

type SigefanbReadonlySectionProps = {
  militar: MilitarProfile | null;
  userRole?: string | null;
  isDemo?: boolean;
  isLoading?: boolean;
};

function ReadonlyField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          "text-sm font-medium text-foreground",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Sección oficial de datos SIGEFANB en modo de solo lectura.
 */
export function SigefanbReadonlySection({
  militar,
  userRole,
  isDemo = false,
  isLoading = false,
}: SigefanbReadonlySectionProps) {
  const syncMutation = useSyncSigefanbProfile();
  const { can } = useAdminAccess();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] =
    useState<SigefanbPersonalItem | null>(null);

  const canAdminLink =
    can("users:update") || hasAdminUserRole(userRole) || can("users:create");

  const compLogo = militar?.componente
    ? componentLogo(militar.componente)
    : null;
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

  const demoCompLogo = componentLogo(DEMO_MILITAR_PREVIEW.componente);
  const demoInsignia = rankInsignia(
    DEMO_MILITAR_PREVIEW.grado,
    DEMO_MILITAR_PREVIEW.componente,
    DEMO_MILITAR_PREVIEW.unidad,
  );

  return (
    <SettingsSection
      title="Datos SIGEFANB"
      description="Información oficial de solo lectura sincronizada desde el expediente SIGEFANB."
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
      <SettingsCard className="border-border/80">
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Cargando datos militares de SIGEFANB…
          </div>
        ) : militar ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <LockIcon className="size-3.5" aria-hidden="true" />
                <span>Campos oficiales protegidos (solo lectura)</span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                Última sincronización:{" "}
                <strong className="font-medium text-foreground">
                  {militar.sincronizadoEn
                    ? formatDateTime(militar.sincronizadoEn)
                    : "Sin sincronizar"}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="divide-y divide-border">
                <ReadonlyField
                  label="Grado"
                  value={
                    <span className="inline-flex items-center gap-2">
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
                      <span>{militar.grado ?? "—"}</span>
                      {militar.grado &&
                      formatGradoCorto(militar.grado) !== militar.grado ? (
                        <Badge variant="secondary" size="sm">
                          {formatGradoCorto(militar.grado)}
                        </Badge>
                      ) : null}
                    </span>
                  }
                />
                <ReadonlyField
                  label="Categoría / Jerarquía"
                  value={deriveMilitaryCategory(militar.grado) ?? "—"}
                />
                <ReadonlyField
                  label="Cédula de identidad"
                  mono
                  value={
                    maskCedulaDotted(militar.cedula, militar.nacionalidad) ||
                    "—"
                  }
                />
              </div>

              <div className="divide-y divide-border">
                <ReadonlyField
                  label="Componente"
                  value={
                    compLogo || militar.componente ? (
                      <span className="inline-flex items-center gap-2">
                        {compLogo ? (
                          <img
                            src={compLogo.src}
                            alt={compLogo.name}
                            className="size-4 shrink-0 object-contain"
                          />
                        ) : null}
                        <span>{compLogo?.name ?? militar.componente}</span>
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <ReadonlyField
                  label="Unidad / Dependencia"
                  value={militar.unidad ?? "—"}
                />
                <ReadonlyField
                  label="Estado del expediente"
                  value={
                    militar.pendiente ? (
                      <Badge variant="warning">
                        Pendiente de primer ingreso
                      </Badge>
                    ) : (
                      <Badge variant="success">Activo</Badge>
                    )
                  }
                />
              </div>
            </div>
          </>
        ) : isDemo ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-warning/10 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-warning-foreground">
                <Badge variant="warning">DEMO</Badge>
                <span>
                  Ficha demostrativa para cuenta QA/pruebas (sin cédula real en
                  SIGEFANB).
                </span>
              </div>
              <span className="text-muted-foreground">
                Última sincronización: Modo DEMO
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="divide-y divide-border">
                <ReadonlyField
                  label="Grado (DEMO)"
                  value={
                    <span className="inline-flex items-center gap-2">
                      {demoInsignia ? (
                        <img
                          src={demoInsignia.src}
                          alt={demoInsignia.name}
                          className="h-3.5 w-auto shrink-0 object-contain"
                        />
                      ) : null}
                      <span>{DEMO_MILITAR_PREVIEW.grado}</span>
                      <Badge variant="secondary" size="sm">
                        {formatGradoCorto(DEMO_MILITAR_PREVIEW.grado)}
                      </Badge>
                    </span>
                  }
                />
                <ReadonlyField
                  label="Categoría / Jerarquía (DEMO)"
                  value={
                    deriveMilitaryCategory(DEMO_MILITAR_PREVIEW.grado) ?? "—"
                  }
                />
                <ReadonlyField
                  label="Cédula de identidad (DEMO)"
                  mono
                  value={`${maskCedulaDotted(DEMO_MILITAR_PREVIEW.cedula, DEMO_MILITAR_PREVIEW.nacionalidad)} (DEMO)`}
                />
              </div>

              <div className="divide-y divide-border">
                <ReadonlyField
                  label="Componente (DEMO)"
                  value={
                    <span className="inline-flex items-center gap-2">
                      {demoCompLogo ? (
                        <img
                          src={demoCompLogo.src}
                          alt={demoCompLogo.name}
                          className="size-4 shrink-0 object-contain"
                        />
                      ) : null}
                      <span>
                        {demoCompLogo?.name ?? DEMO_MILITAR_PREVIEW.componente}
                      </span>
                    </span>
                  }
                />
                <ReadonlyField
                  label="Unidad / Dependencia (DEMO)"
                  value={DEMO_MILITAR_PREVIEW.unidad}
                />
                <ReadonlyField
                  label="Estado del expediente"
                  value={<Badge variant="warning">DEMO</Badge>}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground">
                <IdCardIcon className="size-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Sin cédula SIGEFANB vinculada
                </p>
                <p className="text-xs text-muted-foreground">
                  {canAdminLink
                    ? "Esta cuenta aún no tiene un expediente militar asociado. Puedes consultar el directorio SIGEFANB o gestionar la vinculación en Administración de Usuarios."
                    : "Esta cuenta aún no tiene un expediente militar asociado. Solicita la vinculación de tu cédula al Administrador o a la Secretaría del Despacho."}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canAdminLink ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setSelectedPerson(null);
                      setLinkDialogOpen(true);
                    }}
                  >
                    Vincular cédula
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<Link to="/dashboard/settings/admin/users" />}
                  >
                    Gestión de usuarios
                    <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <Badge variant="outline" className="gap-1.5 py-1">
                  <AlertCircleIcon className="size-3.5" aria-hidden="true" />
                  Solicitar al Administrador o Secretaría
                </Badge>
              )}
            </div>
          </div>
        )}
      </SettingsCard>

      {canAdminLink ? (
        <Dialog
          open={linkDialogOpen}
          onOpenChange={(open) => {
            setLinkDialogOpen(open);
            if (!open) setSelectedPerson(null);
          }}
        >
          <DialogPopup className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Vincular cédula desde SIGEFANB</DialogTitle>
              <DialogDescription>
                Consulta el directorio SIGEFANB para verificar los datos
                militares y gestiona la cuenta institucional en Usuarios.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-border/80">
                <SigefanbPersonSearch onSelect={setSelectedPerson} />
              </div>

              {selectedPerson ? (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <UserCheckIcon
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <span>{selectedPerson.nombreCompleto}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {selectedPerson.grado} ·{" "}
                    {maskCedulaDotted(
                      selectedPerson.cedula,
                      selectedPerson.nacionalidad,
                    )}
                    {selectedPerson.unidad ? ` · ${selectedPerson.unidad}` : ""}
                  </p>
                </div>
              ) : null}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cerrar
              </DialogClose>
              <Button
                type="button"
                render={<Link to="/dashboard/settings/admin/users" />}
              >
                Ir a Gestión de Usuarios
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      ) : null}
    </SettingsSection>
  );
}

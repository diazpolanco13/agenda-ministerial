import {
  BellIcon,
  BellOffIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  QrCodeIcon,
  RefreshCwIcon,
  SendIcon,
  SmartphoneIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type {
  NtfyEventPreferences,
  NtfyOneTimeCredentials,
} from "@/fetchers/ntfy";
import {
  useActivateNtfy,
  useDeactivateNtfy,
  useNtfyStatus,
  useRegenerateNtfy,
  useSendNtfyTest,
  useUpdateNtfyPreferences,
} from "@/hooks/queries/ntfy/use-ntfy";
import { toast } from "@/lib/toast";

const EVENT_ROWS: Array<{
  key: keyof NtfyEventPreferences;
  label: string;
  description: string;
}> = [
  {
    key: "taskAssigned",
    label: "Tarea asignada a mí",
    description: "Cuando te asignen una nueva tarea o acuerdo.",
  },
  {
    key: "mentionComment",
    label: "Menciones y comentarios",
    description: "Cuando te mencionen (@) o comenten en una tarea asignada.",
  },
  {
    key: "dueTomorrow",
    label: "Vence mañana",
    description: "Aviso anticipado el día previo al vencimiento.",
  },
  {
    key: "dueToday",
    label: "Vence hoy",
    description: "Recordatorio el mismo día de la fecha límite.",
  },
  {
    key: "overdue",
    label: "Tarea vencida (una vez)",
    description: "Alerta única cuando una tarea abierta supera su plazo.",
  },
  {
    key: "ministerOrder",
    label: "Orden del Ministro (desde discurso)",
    description:
      "Cuando se apruebe una orden presidencial o ministerial asignada a ti.",
  },
  {
    key: "eventEscalation",
    label: "Escalamientos de órdenes",
    description:
      "Alertas cuando una orden ministerial esté próxima a vencer o vencida.",
  },
  {
    key: "eventDailyBrief",
    label: "Parte diario 06:30",
    description:
      "Resumen matutino automático con tus órdenes, vencimientos y agenda del día.",
  },
];

function CopyInlineButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={() => void handleCopy()}
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-600" aria-hidden="true" />
      ) : (
        <CopyIcon className="size-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}

/**
 * Suscripción móvil institucional vía ntfy (Fase 6): provisión de tema privado,
 * usuario de solo lectura, código QR y preferencias por tipo de evento.
 */
export function NtfyNotificationsSection() {
  const { data: status, isLoading } = useNtfyStatus();
  const activateMutation = useActivateNtfy();
  const regenerateMutation = useRegenerateNtfy();
  const deactivateMutation = useDeactivateNtfy();
  const testMutation = useSendNtfyTest();
  const prefsMutation = useUpdateNtfyPreferences();

  const [oneTimeCredentials, setOneTimeCredentials] =
    useState<NtfyOneTimeCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  const qrTarget =
    oneTimeCredentials?.appUri ??
    status?.appUri ??
    status?.subscribeUrl ??
    null;

  useEffect(() => {
    if (!status?.enabled || !qrTarget) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(qrTarget, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#18181b",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [status?.enabled, qrTarget]);

  const handleActivate = async () => {
    try {
      const res = await activateMutation.mutateAsync();
      setOneTimeCredentials(res.credentials);
      setShowPassword(false);
      toast.success("Notificaciones móviles activadas");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron activar las notificaciones móviles",
      );
    }
  };

  const handleRegenerate = async () => {
    try {
      const res = await regenerateMutation.mutateAsync();
      setOneTimeCredentials(res.credentials);
      setShowPassword(false);
      setConfirmRegenerateOpen(false);
      toast.success("Credenciales ntfy regeneradas");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron regenerar las credenciales",
      );
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateMutation.mutateAsync();
      setOneTimeCredentials(null);
      setShowPassword(false);
      setConfirmDeactivateOpen(false);
      toast.success("Notificaciones móviles desactivadas");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron desactivar las notificaciones",
      );
    }
  };

  const handleSendTest = async () => {
    try {
      await testMutation.mutateAsync();
      toast.success("Notificación de prueba enviada a tu canal ntfy");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la notificación de prueba",
      );
    }
  };

  const handlePreferenceChange = async (
    key: keyof NtfyEventPreferences,
    value: boolean,
  ) => {
    try {
      await prefsMutation.mutateAsync({ [key]: value });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la preferencia",
      );
    }
  };

  const isBusy =
    activateMutation.isPending ||
    regenerateMutation.isPending ||
    deactivateMutation.isPending;

  const isActive = Boolean(status?.enabled);
  const publicUrl =
    oneTimeCredentials?.serverUrl ??
    status?.publicUrl ??
    "https://ntfy.mppd.dev";
  const topic = oneTimeCredentials?.topic ?? status?.topic ?? null;
  const username = oneTimeCredentials?.username ?? status?.username ?? null;
  const subscribeUrl =
    oneTimeCredentials?.subscribeUrl ?? status?.subscribeUrl ?? null;

  return (
    <SettingsSection
      title="Notificaciones móviles"
      description="Alertas push institucionales en tiempo real vía ntfy para asignaciones, menciones, plazos y órdenes del Ministro."
    >
      <SettingsCard className="border-border/80">
        <SettingsRow
          stack
          icon={
            isActive ? (
              <BellIcon
                className="size-4 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <BellOffIcon className="size-4" aria-hidden="true" />
            )
          }
          title="Suscripción móvil ntfy"
          badge={
            isActive ? (
              <Badge variant="secondary">Activa</Badge>
            ) : (
              <Badge variant="outline">Inactiva</Badge>
            )
          }
          description={
            isActive
              ? "Tu cuenta tiene un tema privado y un usuario de solo lectura en el servidor institucional."
              : "Activa tu canal privado para recibir notificaciones en tu teléfono mediante la app ntfy."
          }
        >
          {!isActive ? (
            <Button
              type="button"
              size="sm"
              disabled={
                isLoading || isBusy || status?.configuredOnServer === false
              }
              onClick={() => void handleActivate()}
            >
              <SmartphoneIcon className="size-3.5" aria-hidden="true" />
              {activateMutation.isPending ? "Activando..." : "Activar"}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy || testMutation.isPending}
                onClick={() => void handleSendTest()}
              >
                <SendIcon className="size-3.5" aria-hidden="true" />
                {testMutation.isPending ? "Enviando..." : "Enviar prueba"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => setConfirmRegenerateOpen(true)}
              >
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                Regenerar credenciales
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => setConfirmDeactivateOpen(true)}
              >
                Desactivar
              </Button>
            </div>
          )}
        </SettingsRow>

        {status?.configuredOnServer === false && (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            El servidor ntfy no está configurado en las variables de entorno de
            esta instancia.
          </div>
        )}

        {isActive && topic && (
          <div className="grid gap-5 px-4 py-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Código QR para suscribirse en ntfy"
                  className="size-44 rounded bg-white p-1.5"
                />
              ) : (
                <div className="flex size-44 items-center justify-center rounded bg-muted text-muted-foreground">
                  <QrCodeIcon className="size-8" aria-hidden="true" />
                </div>
              )}
              <span className="text-center text-[11px] text-muted-foreground">
                Escanea con la app ntfy
              </span>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cómo vincular tu teléfono (3 pasos)
                </p>
                <ol className="space-y-1.5 text-xs text-foreground/90">
                  <li>
                    <span className="font-semibold">1.</span> Instala la
                    aplicación <strong>ntfy</strong> en tu teléfono (iOS o
                    Android).
                  </li>
                  <li>
                    <span className="font-semibold">2.</span> En{" "}
                    <em>Configuración → Usuarios por defecto / Servidores</em>,
                    agrega el servidor{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      {publicUrl}
                    </code>{" "}
                    con tu usuario y contraseña de abajo.
                  </li>
                  <li>
                    <span className="font-semibold">3.</span> Suscríbete al tema
                    escaneando el código QR o agregando el tema privado indicado
                    abajo.
                  </li>
                </ol>
              </div>

              <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Servidor</span>
                  <div className="flex min-w-0 items-center gap-1">
                    <code className="truncate font-mono text-[11px] text-foreground">
                      {publicUrl}
                    </code>
                    <CopyInlineButton value={publicUrl} label="Servidor" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Tema privado</span>
                  <div className="flex min-w-0 items-center gap-1">
                    <code className="truncate font-mono text-[11px] text-foreground">
                      {topic}
                    </code>
                    <CopyInlineButton value={topic} label="Tema" />
                  </div>
                </div>

                {subscribeUrl && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">URL directa</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <code className="truncate font-mono text-[11px] text-foreground">
                        {subscribeUrl}
                      </code>
                      <CopyInlineButton
                        value={subscribeUrl}
                        label="URL de suscripción"
                      />
                    </div>
                  </div>
                )}

                {username && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Usuario</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <code className="truncate font-mono text-[11px] text-foreground">
                        {username}
                      </code>
                      <CopyInlineButton value={username} label="Usuario" />
                    </div>
                  </div>
                )}

                {oneTimeCredentials && (
                  <div className="mt-1 space-y-1.5 border-t border-border/70 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <KeyRoundIcon className="size-3.5" aria-hidden="true" />
                        Contraseña (solo esta vez)
                      </span>
                      <div className="flex items-center gap-1">
                        <code
                          data-testid="ntfy-onetime-password"
                          className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                        >
                          {showPassword
                            ? oneTimeCredentials.password
                            : "••••••••••••••••"}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword
                              ? "Ocultar contraseña"
                              : "Mostrar contraseña"
                          }
                          title={
                            showPassword
                              ? "Ocultar contraseña"
                              : "Mostrar contraseña"
                          }
                        >
                          {showPassword ? (
                            <EyeOffIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <EyeIcon className="size-3.5" aria-hidden="true" />
                          )}
                        </Button>
                        <CopyInlineButton
                          value={oneTimeCredentials.password}
                          label="Contraseña"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Guarda esta contraseña ahora: por seguridad no volverá a
                      mostrarse al recargar la página. Si la pierdes, usa
                      «Regenerar credenciales».
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="divide-y divide-border/70 border-t border-border/70">
          <div className="px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Eventos que notifican al teléfono
            </p>
          </div>
          {EVENT_ROWS.map((item) => {
            const checked = status?.preferences[item.key] ?? true;
            return (
              <SettingsRow
                key={item.key}
                title={item.label}
                description={item.description}
              >
                <Switch
                  checked={checked}
                  disabled={isLoading || prefsMutation.isPending}
                  aria-label={item.label}
                  onCheckedChange={(next) =>
                    void handlePreferenceChange(item.key, next)
                  }
                />
              </SettingsRow>
            );
          })}
        </div>
      </SettingsCard>

      <AlertDialog
        open={confirmRegenerateOpen}
        onOpenChange={setConfirmRegenerateOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerar credenciales ntfy</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará un tema privado nuevo y una contraseña nueva. El tema y
              las credenciales anteriores dejarán de funcionar de inmediato en
              tus dispositivos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              Cancelar
            </AlertDialogClose>
            <Button
              type="button"
              size="sm"
              disabled={regenerateMutation.isPending}
              onClick={() => void handleRegenerate()}
            >
              {regenerateMutation.isPending ? "Regenerando..." : "Regenerar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeactivateOpen}
        onOpenChange={setConfirmDeactivateOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desactivar notificaciones móviles
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se revocará tu acceso en el servidor ntfy y dejarás de recibir
              notificaciones push en tu teléfono hasta que vuelvas a activarlas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              Cancelar
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deactivateMutation.isPending}
              onClick={() => void handleDeactivate()}
            >
              {deactivateMutation.isPending ? "Desactivando..." : "Desactivar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}

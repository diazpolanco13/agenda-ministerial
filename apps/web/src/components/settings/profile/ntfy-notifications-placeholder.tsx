import { BellOffIcon } from "lucide-react";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/**
 * Espacio reservado para la suscripción móvil institucional vía ntfy (Fase 6).
 */
export function NtfyNotificationsPlaceholder() {
  return (
    <SettingsSection
      title="Notificaciones móviles (ntfy)"
      description="Alertas push institucionales en tiempo real para acuerdos, plazos y convocatorias del despacho."
    >
      <SettingsCard className="opacity-80">
        <SettingsRow
          icon={<BellOffIcon className="size-4" aria-hidden="true" />}
          title="Suscripción móvil del despacho"
          badge={<Badge variant="secondary">Próximamente — Fase 6</Badge>}
          description="En la Fase 6 podrás vincular la aplicación móvil ntfy del ministerio para recibir avisos inmediatos de nuevas asignaciones y vencimientos."
        >
          <Switch
            disabled
            checked={false}
            aria-label="Notificaciones móviles (ntfy)"
          />
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

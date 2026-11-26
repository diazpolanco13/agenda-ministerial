import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, BellIcon, ClockIcon } from "lucide-react";
import { useState } from "react";
import { ThemePicker } from "@/components/account/theme-picker";
import { LanguageRow } from "@/components/settings/preferences/language-row";
import { NtfyNotificationsPlaceholder } from "@/components/settings/profile/ntfy-notifications-placeholder";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserPreferencesStore } from "@/store/user-preferences";

export const AGENDA_TIMEZONE_STORAGE_KEY = "agenda.timezone";
export const DEFAULT_AGENDA_TIMEZONE = "America/Caracas";

const AGENDA_TIMEZONES = [
  { value: "America/Caracas", label: "America/Caracas (UTC-4)" },
  { value: "America/Bogota", label: "America/Bogota (UTC-5)" },
  { value: "America/New_York", label: "America/New_York (UTC-5/-4)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (UTC+1/+2)" },
  { value: "UTC", label: "UTC (UTC+0)" },
] as const;

function readSavedTimezone(): string {
  try {
    const saved = window.localStorage.getItem(AGENDA_TIMEZONE_STORAGE_KEY);
    if (
      saved &&
      AGENDA_TIMEZONES.some((timezone) => timezone.value === saved)
    ) {
      return saved;
    }
  } catch {
    return DEFAULT_AGENDA_TIMEZONE;
  }
  return DEFAULT_AGENDA_TIMEZONE;
}

/**
 * Preferencias personales exclusivas de AGENDA (idioma, tema, zona horaria y avisos).
 */
export function AgendaPreferencesSection() {
  const theme = useUserPreferencesStore((state) => state.theme);
  const setTheme = useUserPreferencesStore((state) => state.setTheme);
  const [timezone, setTimezone] = useState<string>(readSavedTimezone);

  const selectedTimezoneLabel =
    AGENDA_TIMEZONES.find((item) => item.value === timezone)?.label ??
    "America/Caracas (UTC-4)";

  const handleTimezoneChange = (nextTimezone: string | null) => {
    if (!nextTimezone) return;
    setTimezone(nextTimezone);
    try {
      window.localStorage.setItem(AGENDA_TIMEZONE_STORAGE_KEY, nextTimezone);
    } catch {
      return;
    }
  };

  return (
    <>
      <SettingsSection
        title="Preferencias de AGENDA"
        description="Ajustes personales de la plataforma. No modifican tu ficha oficial en SIGEFANB."
      >
        <SettingsCard className="border-border/80">
          <LanguageRow />

          <SettingsRow
            stack
            icon={<ClockIcon className="size-4" aria-hidden="true" />}
            title="Zona horaria"
            description="Referencia horaria para actividades, reuniones y vencimientos de acuerdos."
          >
            <Select value={timezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger
                size="sm"
                className="sm:w-56"
                aria-label="Zona horaria"
              >
                <SelectValue>{selectedTimezoneLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AGENDA_TIMEZONES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <div className="space-y-3 px-4 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Tema</p>
              <p className="text-xs text-muted-foreground">
                Apariencia visual de AGENDA en este dispositivo.
              </p>
            </div>
            <ThemePicker value={theme} onChange={setTheme} />
          </div>

          <SettingsRow
            stack
            icon={<BellIcon className="size-4" aria-hidden="true" />}
            title="Notificaciones"
            description="Configura recordatorios de plazos, menciones y canales institucionales."
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link to="/dashboard/settings/account/notifications" />}
            >
              Configurar notificaciones
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <NtfyNotificationsPlaceholder />
    </>
  );
}

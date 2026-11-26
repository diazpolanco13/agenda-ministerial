import { Eye, Sparkles, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PreferenceSwitchRow } from "@/components/settings/preferences/preference-switch-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Badge } from "@/components/ui/badge";
import { useUpdateUiPreferences } from "@/hooks/queries/user/use-ui-preferences";
import {
  FONT_SCALE_OPTIONS,
  type FontScalePreset,
  type ReduceMotionPreference,
} from "@/lib/accessibility";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";

const REDUCE_MOTION_OPTIONS: ReadonlyArray<{
  value: ReduceMotionPreference;
  labelKey: string;
  fallback: string;
}> = [
  {
    value: "system",
    labelKey: "settings:preferencesPage.accessibility.motionSystem",
    fallback: "Sistema",
  },
  {
    value: "always",
    labelKey: "settings:preferencesPage.accessibility.motionAlways",
    fallback: "Siempre",
  },
  {
    value: "never",
    labelKey: "settings:preferencesPage.accessibility.motionNever",
    fallback: "Desactivado",
  },
];

export function AccessibilitySection() {
  const { t } = useTranslation();
  const fontScale = useUserPreferencesStore((state) => state.fontScale);
  const setFontScale = useUserPreferencesStore((state) => state.setFontScale);
  const highContrast = useUserPreferencesStore((state) => state.highContrast);
  const setHighContrast = useUserPreferencesStore(
    (state) => state.setHighContrast,
  );
  const reduceMotion = useUserPreferencesStore((state) => state.reduceMotion);
  const setReduceMotion = useUserPreferencesStore(
    (state) => state.setReduceMotion,
  );
  const { mutate: saveRemote } = useUpdateUiPreferences();

  const persistRemote = (
    patch: Partial<{
      fontScale: FontScalePreset;
      highContrast: boolean;
      reduceMotion: ReduceMotionPreference;
    }>,
  ) => {
    saveRemote(patch, {
      onError: () => {
        toast.error(
          t("settings:preferencesPage.accessibility.saveError", {
            defaultValue:
              "Se aplicó localmente, pero no se pudo sincronizar con el servidor.",
          }),
        );
      },
    });
  };

  return (
    <SettingsSection
      title={t("settings:preferencesPage.accessibility.title", {
        defaultValue: "Accesibilidad y lectura",
      })}
    >
      <SettingsCard>
        <SettingsRow
          stack
          icon={<Type className="size-4" />}
          title={t("settings:preferencesPage.accessibility.fontSizeTitle", {
            defaultValue: "Tamaño de texto",
          })}
          description={t(
            "settings:preferencesPage.accessibility.fontSizeDescription",
            {
              defaultValue:
                "Ajusta la escala tipográfica de toda la aplicación sin romper el diseño.",
            },
          )}
        >
          <div
            role="radiogroup"
            aria-label={t(
              "settings:preferencesPage.accessibility.fontSizeTitle",
              { defaultValue: "Tamaño de texto" },
            )}
            className="flex flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1"
          >
            {FONT_SCALE_OPTIONS.map((option) => {
              const selected = fontScale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`font-scale-${option.value}`}
                  onClick={() => {
                    setFontScale(option.value);
                    persistRemote({ fontScale: option.value });
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-background text-foreground shadow-xs border border-border/70"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(option.labelKey, { defaultValue: option.fallbackLabel })}
                </button>
              );
            })}
          </div>
        </SettingsRow>

        <div className="border-border/60 border-t bg-muted/20 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3.5 py-2.5">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {t("settings:preferencesPage.accessibility.previewTitle", {
                  defaultValue: "Vista previa: Reunión de Estado Mayor",
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "settings:preferencesPage.accessibility.previewDescription",
                  {
                    defaultValue:
                      "Texto secundario, etiquetas e indicadores se escalan proporcionalmente.",
                  },
                )}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {FONT_SCALE_OPTIONS.find((o) => o.value === fontScale)?.approxPx ??
                "17px"}
            </Badge>
          </div>
        </div>

        <PreferenceSwitchRow
          title={
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5 text-muted-foreground" />
              {t("settings:preferencesPage.accessibility.highContrastTitle", {
                defaultValue: "Alto contraste",
              })}
            </span>
          }
          description={t(
            "settings:preferencesPage.accessibility.highContrastDescription",
            {
              defaultValue:
                "Refuerza bordes, textos secundarios y foco visible en modo claro y oscuro.",
            },
          )}
          checked={highContrast}
          onCheckedChange={(checked) => {
            setHighContrast(checked);
            persistRemote({ highContrast: checked });
          }}
        />

        <SettingsRow
          stack
          icon={<Sparkles className="size-4" />}
          title={t("settings:preferencesPage.accessibility.reduceMotionTitle", {
            defaultValue: "Reducir movimiento",
          })}
          description={t(
            "settings:preferencesPage.accessibility.reduceMotionDescription",
            {
              defaultValue:
                "Desactiva transiciones y animaciones. En «Sistema» respeta la preferencia de tu equipo.",
            },
          )}
        >
          <div
            role="radiogroup"
            aria-label={t(
              "settings:preferencesPage.accessibility.reduceMotionTitle",
              { defaultValue: "Reducir movimiento" },
            )}
            className="flex flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1"
          >
            {REDUCE_MOTION_OPTIONS.map((option) => {
              const selected = reduceMotion === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`reduce-motion-${option.value}`}
                  onClick={() => {
                    setReduceMotion(option.value);
                    persistRemote({ reduceMotion: option.value });
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-background text-foreground shadow-xs border border-border/70"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(option.labelKey, { defaultValue: option.fallback })}
                </button>
              );
            })}
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}

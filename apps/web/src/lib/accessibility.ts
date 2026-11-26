export type FontScalePreset = "normal" | "large" | "xlarge" | "xxlarge";
export type ReduceMotionPreference = "system" | "always" | "never";

export type AccessibilityPreferences = {
  fontScale: FontScalePreset;
  highContrast: boolean;
  reduceMotion: ReduceMotionPreference;
};

export const ACCESSIBILITY_STORAGE_KEY = "agenda-accessibility";

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  fontScale: "normal",
  highContrast: false,
  reduceMotion: "system",
};

export const FONT_SCALE_FACTORS: Record<FontScalePreset, number> = {
  normal: 1.0625,
  large: 1.125,
  xlarge: 1.25,
  xxlarge: 1.375,
};

export const FONT_SCALE_OPTIONS: ReadonlyArray<{
  value: FontScalePreset;
  factor: number;
  labelKey: string;
  fallbackLabel: string;
  approxPx: string;
}> = [
  {
    value: "normal",
    factor: 1.0625,
    labelKey: "settings:preferencesPage.accessibility.scaleNormal",
    fallbackLabel: "Normal",
    approxPx: "17px",
  },
  {
    value: "large",
    factor: 1.125,
    labelKey: "settings:preferencesPage.accessibility.scaleLarge",
    fallbackLabel: "Grande",
    approxPx: "18px",
  },
  {
    value: "xlarge",
    factor: 1.25,
    labelKey: "settings:preferencesPage.accessibility.scaleXLarge",
    fallbackLabel: "Muy grande",
    approxPx: "20px",
  },
  {
    value: "xxlarge",
    factor: 1.375,
    labelKey: "settings:preferencesPage.accessibility.scaleExtra",
    fallbackLabel: "Extra",
    approxPx: "22px",
  },
];

export function isValidFontScale(value: unknown): value is FontScalePreset {
  return (
    value === "normal" ||
    value === "large" ||
    value === "xlarge" ||
    value === "xxlarge"
  );
}

export function isValidReduceMotion(
  value: unknown,
): value is ReduceMotionPreference {
  return value === "system" || value === "always" || value === "never";
}

export function getFontScaleFactor(preset: FontScalePreset): number {
  return FONT_SCALE_FACTORS[preset] ?? FONT_SCALE_FACTORS.normal;
}

export function isEffectiveReducedMotion(
  reduceMotion: ReduceMotionPreference,
): boolean {
  if (reduceMotion === "always") return true;
  if (reduceMotion === "never") return false;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readAccessibilityLocal(): AccessibilityPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESSIBILITY_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return {
      fontScale: isValidFontScale(parsed.fontScale)
        ? parsed.fontScale
        : DEFAULT_ACCESSIBILITY_PREFERENCES.fontScale,
      highContrast: Boolean(parsed.highContrast),
      reduceMotion: isValidReduceMotion(parsed.reduceMotion)
        ? parsed.reduceMotion
        : DEFAULT_ACCESSIBILITY_PREFERENCES.reduceMotion,
    };
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
}

export function persistAccessibilityLocal(
  prefs: AccessibilityPreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEY,
      JSON.stringify(prefs),
    );
  } catch {
    // Ignore storage quota or private browsing errors.
  }
}

export function applyAccessibilityToDocument(
  prefs: AccessibilityPreferences,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const factor = getFontScaleFactor(prefs.fontScale);
  root.style.setProperty("--agenda-font-scale", String(factor));
  root.dataset.fontScale = prefs.fontScale;
  root.classList.toggle("high-contrast", prefs.highContrast);
  root.classList.toggle(
    "reduce-motion",
    isEffectiveReducedMotion(prefs.reduceMotion),
  );
}

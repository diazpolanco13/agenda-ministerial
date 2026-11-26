import { eq } from "drizzle-orm";
import db from "../../database";
import { userUiPreferenceTable } from "../../database/schema";

export type UiFontScale = "normal" | "large" | "xlarge" | "xxlarge";
export type UiReduceMotion = "system" | "always" | "never";

export type UiPreferences = {
  fontScale: UiFontScale;
  highContrast: boolean;
  reduceMotion: UiReduceMotion;
};

const VALID_FONT_SCALES = new Set<UiFontScale>([
  "normal",
  "large",
  "xlarge",
  "xxlarge",
]);
const VALID_REDUCE_MOTION = new Set<UiReduceMotion>([
  "system",
  "always",
  "never",
]);

function normalizeFontScale(value: string | null | undefined): UiFontScale {
  return value && VALID_FONT_SCALES.has(value as UiFontScale)
    ? (value as UiFontScale)
    : "normal";
}

function normalizeReduceMotion(
  value: string | null | undefined,
): UiReduceMotion {
  return value && VALID_REDUCE_MOTION.has(value as UiReduceMotion)
    ? (value as UiReduceMotion)
    : "system";
}

export async function getUiPreferences(userId: string): Promise<UiPreferences> {
  const [row] = await db
    .select({
      fontScale: userUiPreferenceTable.fontScale,
      highContrast: userUiPreferenceTable.highContrast,
      reduceMotion: userUiPreferenceTable.reduceMotion,
    })
    .from(userUiPreferenceTable)
    .where(eq(userUiPreferenceTable.userId, userId))
    .limit(1);

  return {
    fontScale: normalizeFontScale(row?.fontScale),
    highContrast: Boolean(row?.highContrast ?? false),
    reduceMotion: normalizeReduceMotion(row?.reduceMotion),
  };
}

export async function updateUiPreferences(
  userId: string,
  input: Partial<UiPreferences>,
): Promise<UiPreferences> {
  const current = await getUiPreferences(userId);
  const next: UiPreferences = {
    fontScale: input.fontScale
      ? normalizeFontScale(input.fontScale)
      : current.fontScale,
    highContrast:
      typeof input.highContrast === "boolean"
        ? input.highContrast
        : current.highContrast,
    reduceMotion: input.reduceMotion
      ? normalizeReduceMotion(input.reduceMotion)
      : current.reduceMotion,
  };

  await db
    .insert(userUiPreferenceTable)
    .values({
      userId,
      fontScale: next.fontScale,
      highContrast: next.highContrast,
      reduceMotion: next.reduceMotion,
    })
    .onConflictDoUpdate({
      target: userUiPreferenceTable.userId,
      set: {
        fontScale: next.fontScale,
        highContrast: next.highContrast,
        reduceMotion: next.reduceMotion,
      },
    });

  return next;
}

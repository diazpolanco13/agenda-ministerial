import { describe, expect, it } from "vite-plus/test";
import {
  FONT_SCALE_FACTORS,
  getFontScaleFactor,
  isValidFontScale,
  isValidReduceMotion,
} from "./accessibility";

describe("accessibility helpers", () => {
  it("uses 1.0625 as default normal base factor (~17px)", () => {
    expect(FONT_SCALE_FACTORS.normal).toBe(1.0625);
    expect(getFontScaleFactor("normal")).toBe(1.0625);
    expect(getFontScaleFactor("xxlarge")).toBe(1.375);
  });

  it("validates fontScale and reduceMotion values", () => {
    expect(isValidFontScale("xlarge")).toBe(true);
    expect(isValidFontScale("giant")).toBe(false);
    expect(isValidReduceMotion("system")).toBe(true);
    expect(isValidReduceMotion("always")).toBe(true);
    expect(isValidReduceMotion("invalid")).toBe(false);
  });
});

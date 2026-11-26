import { describe, expect, it } from "vite-plus/test";
import {
  abbreviateMilitaryRank,
  deriveMilitaryCategory,
  formatGradoCorto,
  maskCedula,
  maskCedulaDotted,
} from "./military-assets";

describe("abbreviateMilitaryRank", () => {
  it("abbreviates Venezuelan FANB officer and enlisted ranks", () => {
    expect(abbreviateMilitaryRank("General de División")).toBe("G/D");
    expect(abbreviateMilitaryRank("General de Brigada")).toBe("G/B");
    expect(abbreviateMilitaryRank("Mayor General")).toBe("M/G");
    expect(abbreviateMilitaryRank("Coronel")).toBe("Cnel.");
    expect(abbreviateMilitaryRank("Teniente Coronel")).toBe("Tcnel.");
    expect(abbreviateMilitaryRank("Capitán de Navío")).toBe("C/N");
    expect(abbreviateMilitaryRank("Sargento Mayor de Primera")).toBe("S/M1");
  });

  it("preserves already abbreviated or unknown ranks and returns null for empty", () => {
    expect(abbreviateMilitaryRank("Cnel.")).toBe("Cnel.");
    expect(abbreviateMilitaryRank("Asimilado")).toBe("Asimilado");
    expect(abbreviateMilitaryRank("")).toBeNull();
    expect(abbreviateMilitaryRank(null)).toBeNull();
  });
});

describe("deriveMilitaryCategory", () => {
  it("derives FANB categories accurately across all rank tiers", () => {
    expect(deriveMilitaryCategory("General en Jefe")).toBe("Oficial General");
    expect(deriveMilitaryCategory("General de Brigada")).toBe(
      "Oficial General",
    );
    expect(deriveMilitaryCategory("Vicealmirante")).toBe("Oficial Almirante");
    expect(deriveMilitaryCategory("Almirante")).toBe("Oficial Almirante");
    expect(deriveMilitaryCategory("Coronel")).toBe("Oficial Superior");
    expect(deriveMilitaryCategory("Capitán de Fragata")).toBe(
      "Oficial Superior",
    );
    expect(deriveMilitaryCategory("Capitán")).toBe("Oficial Subalterno");
    expect(deriveMilitaryCategory("Primer Teniente")).toBe(
      "Oficial Subalterno",
    );
    expect(deriveMilitaryCategory("Teniente de Navío")).toBe(
      "Oficial Subalterno",
    );
    expect(deriveMilitaryCategory("Sargento Mayor de Primera")).toBe(
      "Tropa Profesional",
    );
    expect(deriveMilitaryCategory("Alférez Mayor")).toBe("Cadete / Alumno");
    expect(deriveMilitaryCategory("Cadete de Tercer Año")).toBe(
      "Cadete / Alumno",
    );
    expect(deriveMilitaryCategory("Cabo Primero")).toBe("Tropa Alistada");
    expect(deriveMilitaryCategory("Distinguido")).toBe("Tropa Alistada");
    expect(deriveMilitaryCategory("")).toBeNull();
    expect(deriveMilitaryCategory(null)).toBeNull();
  });
});

describe("formatGradoCorto", () => {
  it("formats institutional short abbreviations", () => {
    expect(formatGradoCorto("General en Jefe")).toBe("G/J");
    expect(formatGradoCorto("Mayor General")).toBe("M/G");
    expect(formatGradoCorto("General de División")).toBe("G/D");
    expect(formatGradoCorto("General de Brigada")).toBe("G/B");
    expect(formatGradoCorto("Almirante en Jefe")).toBe("A/J");
    expect(formatGradoCorto("Almirante")).toBe("Alm.");
    expect(formatGradoCorto("Vicealmirante")).toBe("V/A");
    expect(formatGradoCorto("Contralmirante")).toBe("C/A");
    expect(formatGradoCorto("Coronel")).toBe("Cnel.");
    expect(formatGradoCorto("Teniente Coronel")).toBe("Tcnel.");
    expect(formatGradoCorto("Mayor")).toBe("May.");
    expect(formatGradoCorto("Capitán")).toBe("Cap.");
    expect(formatGradoCorto("Primer Teniente")).toBe("1T");
    expect(formatGradoCorto("Teniente")).toBe("Tte.");
    expect(formatGradoCorto("Capitán de Navío")).toBe("C/N");
    expect(formatGradoCorto("Capitán de Fragata")).toBe("C/F");
    expect(formatGradoCorto("Capitán de Corbeta")).toBe("C/C");
    expect(formatGradoCorto("Teniente de Navío")).toBe("T/N");
    expect(formatGradoCorto("Teniente de Fragata")).toBe("T/F");
    expect(formatGradoCorto("Teniente de Corbeta")).toBe("T/C");
    expect(formatGradoCorto("Sargento Supervisor")).toBe("S/S");
    expect(formatGradoCorto("Sargento Ayudante")).toBe("S/A");
    expect(formatGradoCorto("Sargento Mayor de Primera")).toBe("S/M 1ra");
    expect(formatGradoCorto("")).toBe("");
    expect(formatGradoCorto(null)).toBe("");
  });
});

describe("maskCedula", () => {
  it("masks cedula digits keeping the last 4", () => {
    expect(maskCedula("12345678", "V")).toBe("V-••••5678");
    expect(maskCedula("987654", "E")).toBe("E-••••7654");
    expect(maskCedula("", "V")).toBe("");
  });
});

describe("maskCedulaDotted", () => {
  it("formats masked cedulas with dotted thousands groups", () => {
    expect(maskCedulaDotted("12345678", "V")).toBe("V-12.***.678");
    expect(maskCedulaDotted("8765432", "V")).toBe("V-8.***.432");
    expect(maskCedulaDotted("987654", "E")).toBe("E-***.654");
    expect(maskCedulaDotted("00000000", "V")).toBe("V-00.***.000");
    expect(maskCedulaDotted("", "V")).toBe("");
    expect(maskCedulaDotted(null)).toBe("");
  });
});

import { describe, expect, it } from "vite-plus/test";
import {
  componentLogo,
  deriveComponent,
  formatGrado,
  formatNombreCompleto,
  maskCedula,
  normalizeCedulaInput,
  rankInsignia,
} from "./military-assets";

describe("deriveComponent", () => {
  it("identifies all five FANB components from names or codes", () => {
    expect(deriveComponent("EJERCITO")).toBe("EJB");
    expect(deriveComponent("Ejército Bolivariano")).toBe("EJB");
    expect(deriveComponent("EJB Oficiales")).toBe("EJB");

    expect(deriveComponent("ARMADA")).toBe("ARB");
    expect(deriveComponent("Armada Bolivariana")).toBe("ARB");
    expect(deriveComponent("ARB")).toBe("ARB");

    expect(deriveComponent("AVIACIÓN MILITAR")).toBe("AMB");
    expect(deriveComponent("AMB")).toBe("AMB");

    expect(deriveComponent("GUARDIA NACIONAL BOLIVARIANA")).toBe("GNB");
    expect(deriveComponent("GNB")).toBe("GNB");

    expect(deriveComponent("MILICIA BOLIVARIANA")).toBe("MIL");
    expect(deriveComponent("MIL")).toBe("MIL");
  });

  it("returns null for non-component or empty values", () => {
    expect(deriveComponent(null)).toBeNull();
    expect(deriveComponent(undefined)).toBeNull();
    expect(deriveComponent("")).toBeNull();
    expect(deriveComponent("PERSONAL CIVIL")).toBeNull();
  });
});

describe("componentLogo", () => {
  it("returns institutional and component logos", () => {
    expect(componentLogo("EJB")).toEqual({
      code: "EJB",
      name: "Ejército Bolivariano",
      src: "/marca/ejercito.png",
    });
    expect(componentLogo("Armada Bolivariana")).toEqual({
      code: "ARB",
      name: "Armada Bolivariana",
      src: "/marca/armada.png",
    });
    expect(componentLogo("gnb")?.src).toBe("/marca/guardia-nacional.png");
    expect(componentLogo("ceofanb")?.code).toBe("CEOFANB");
    expect(componentLogo("mppd")?.code).toBe("MPPD");
    expect(componentLogo("desconocido")).toBeNull();
  });
});

describe("rankInsignia", () => {
  it("resolves officer, NCO, and troop rank insignias", () => {
    expect(rankInsignia("GENERAL DE DIVISION", "EJB")).toEqual({
      name: "General de División",
      src: "/insignias/ejercito/general_de_division@2x.png",
      shape: "horizontal",
    });
    expect(rankInsignia("CAPITAN DE NAVIO", "EJB")).toEqual({
      name: "Capitán de Navío",
      src: "/insignias/armada/capitan_de_navio@2x.png",
      shape: "horizontal",
    });
    expect(rankInsignia("SARGENTO MAYOR DE 1RA", "GNB")).toEqual({
      name: "Sargento Mayor de Primera",
      src: "/insignias/guardia_nacional/sargento_mayor_de_primera@2x.png",
      shape: "horizontal",
    });
    expect(rankInsignia("DISTINGUIDO", "EJB")).toEqual({
      name: "Distinguido",
      src: "/insignias/ejercito/distinguido_marco@2x.png",
      shape: "vertical",
    });
    expect(rankInsignia("INFANTE DISTINGUIDO", "ARB")).toEqual({
      name: "Infante Distinguido",
      src: "/insignias/armada/distinguido@2x.png",
      shape: "vertical",
    });
  });

  it("resolves academy cadet insignias based on unit and component", () => {
    expect(
      rankInsignia("CADETE 2DO ANO", "EJB", "Academia Militar de Medicina"),
    ).toEqual({
      name: "Cadete de 2º año",
      src: "/insignias/academias/ammed/cadete_2_ano@2x.png",
      shape: "vertical",
    });
    expect(
      rankInsignia("PRIMER BRIGADIER", "ARB", "Academia Militar de la Armada"),
    ).toEqual({
      name: "Brigadier Primero",
      src: "/insignias/academias/amarb/brigadier_primero@2x.png",
      shape: "vertical",
    });
  });

  it("returns null for empty or unknown cargos", () => {
    expect(rankInsignia(null)).toBeNull();
    expect(rankInsignia("")).toBeNull();
    expect(rankInsignia("ANALISTA DE SISTEMAS")).toBeNull();
  });
});

describe("formatGrado", () => {
  it("formats recognized ranks and strips SIGEFIRRHH prefixes", () => {
    expect(formatGrado("A CAPITAN", "EJB")).toBe("Capitán");
    expect(formatGrado("01 GENERAL DIVISION", "EJB")).toBe(
      "General de División",
    );
    expect(formatGrado("CORONEL TIEMPO PARCIAL", "AMB")).toBe("Coronel");
  });

  it("falls back to Spanish title case for non-rank cargos", () => {
    expect(formatGrado("A MEDICO DE LA UNIDAD")).toBe("Medico de la Unidad");
    expect(formatGrado(null)).toBe("");
    expect(formatGrado("   ")).toBe("");
  });
});

describe("formatNombreCompleto", () => {
  it("joins non-empty parts and applies Spanish title case", () => {
    expect(formatNombreCompleto(["CARLOS", "ALBERTO", "DIAZ", "POLANCO"])).toBe(
      "Carlos Alberto Diaz Polanco",
    );
    expect(formatNombreCompleto(["MARIA", null, "DE LA CRUZ", undefined])).toBe(
      "Maria de la Cruz",
    );
    expect(formatNombreCompleto([null, "", "  "])).toBe("");
  });
});

describe("normalizeCedulaInput", () => {
  it("normalizes valid Venezuelan and foreign cedula formats", () => {
    expect(normalizeCedulaInput("12345678")).toBe("12345678");
    expect(normalizeCedulaInput("V-12.345.678")).toBe("12345678");
    expect(normalizeCedulaInput("e 00123456")).toBe("123456");
    expect(normalizeCedulaInput("v12345")).toBe("12345");
  });

  it("rejects invalid, out-of-range, or too short cedulas", () => {
    expect(normalizeCedulaInput("1234")).toBeNull();
    expect(normalizeCedulaInput("00000")).toBeNull();
    expect(normalizeCedulaInput("2147483648")).toBeNull();
    expect(normalizeCedulaInput("abc12345")).toBeNull();
    expect(normalizeCedulaInput("")).toBeNull();
  });
});

describe("maskCedula", () => {
  it("masks digits leaving only the last four visible", () => {
    expect(maskCedula("12345678")).toBe("V-••••5678");
    expect(maskCedula("12345678", "E")).toBe("E-••••5678");
    expect(maskCedula("1234")).toBe("V-1234");
    expect(maskCedula(null)).toBe("");
    expect(maskCedula("")).toBe("");
  });
});

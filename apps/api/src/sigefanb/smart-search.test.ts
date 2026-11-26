import { describe, expect, it } from "vite-plus/test";
import type { SigefanbPersonalItem } from "./personal-query";
import {
  expandNicknameVariants,
  levenshteinDistance,
  normalizeText,
  parseSmartQuery,
  scoreCandidate,
  trigramSimilarity,
} from "./smart-search";

function makeCandidate(
  overrides: Partial<SigefanbPersonalItem> = {},
): SigefanbPersonalItem {
  return {
    cedula: "12345678",
    nacionalidad: "V",
    nombreCompleto: "Carlos Alberto Díaz Polanco",
    grado: "General de División",
    componente: "EJB",
    unidad: "Comando General del Ejército",
    sexo: "M",
    insignia: "/insignias/ejercito/general_de_division@2x.png",
    fotoUrl: "/api/sigefanb/foto/12345678",
    ...overrides,
  };
}

describe("normalizeText", () => {
  it("removes accents, uppercases, and collapses punctuation", () => {
    expect(normalizeText("José María Pérez-Ñúñez")).toBe(
      "JOSE MARIA PEREZ NUNEZ",
    );
    expect(normalizeText("  G/D   Ángel   de   la   Cruz  ")).toBe(
      "G D ANGEL DE LA CRUZ",
    );
    expect(normalizeText("Cnel. (EJB) Raúl")).toBe("CNEL EJB RAUL");
  });
});

describe("expandNicknameVariants", () => {
  it("expands Venezuelan nicknames bidirectionally", () => {
    expect(expandNicknameVariants("José")).toEqual(["JOSE", "PEPE", "CHEO"]);
    expect(expandNicknameVariants("Cheo")).toEqual(["CHEO", "JOSE", "PEPE"]);
    expect(expandNicknameVariants("Pancho")).toEqual([
      "PANCHO",
      "FRANCISCO",
      "PACO",
    ]);
    expect(expandNicknameVariants("Chucho")).toEqual([
      "CHUCHO",
      "JESUS",
      "CHUO",
    ]);
    expect(expandNicknameVariants("Toño")).toEqual(["TONO", "ANTONIO", "TONY"]);
    expect(expandNicknameVariants("Beto")).toEqual([
      "BETO",
      "ALBERTO",
      "ROBERTO",
      "ROBERT",
    ]);
    expect(expandNicknameVariants("Paty")).toEqual(["PATY", "PATRICIA"]);
    expect(expandNicknameVariants("Tere")).toEqual(["TERE", "TERESA"]);
  });

  it("returns only the normalized token when there is no nickname entry", () => {
    expect(expandNicknameVariants("González")).toEqual(["GONZALEZ"]);
    expect(expandNicknameVariants("   ")).toEqual([]);
  });
});

describe("levenshteinDistance and trigramSimilarity", () => {
  it("computes exact edit distances", () => {
    expect(levenshteinDistance("GONZALEZ", "GONZALEZ")).toBe(0);
    expect(levenshteinDistance("GONZALES", "GONZALEZ")).toBe(1);
    expect(levenshteinDistance("RODRIGES", "RODRIGUEZ")).toBe(2);
    expect(levenshteinDistance("", "ABC")).toBe(3);
  });

  it("computes high trigram similarity for accented or slightly misspelled surnames", () => {
    expect(trigramSimilarity("González", "GONZALEZ")).toBe(1);
    expect(trigramSimilarity("GONZALES", "GONZALEZ")).toBeGreaterThan(0.72);
    expect(trigramSimilarity("CARLOS", "MIGUEL")).toBeLessThan(0.3);
  });
});

describe("parseSmartQuery", () => {
  it("detects cedula queries directly", () => {
    const parsed = parseSmartQuery("V-12.345.678");
    expect(parsed.cedula).toBe("12345678");
    expect(parsed.nameTokens).toEqual([]);
  });

  it("extracts natural language rank, component, stopwords, and nicknames", () => {
    const parsed = parseSmartQuery("el general Pérez de la Aviación");
    expect(parsed.cedula).toBeNull();
    expect(parsed.grado).toEqual({
      canonical: null,
      family: "general",
      matchedText: "GENERAL",
    });
    expect(parsed.componente).toBe("AMB");
    expect(parsed.nameTokens).toEqual(["PEREZ"]);
    expect(parsed.expandedTokens).toEqual([["PEREZ"]]);
  });

  it("recognizes military rank abbreviations and naval/troop ranks", () => {
    expect(parseSmartQuery("G/D Cheo González GNB")).toMatchObject({
      grado: { canonical: "GENERAL DE DIVISION", family: "general" },
      componente: "GNB",
      nameTokens: ["CHEO", "GONZALEZ"],
      expandedTokens: [["CHEO", "JOSE", "PEPE"], ["GONZALEZ"]],
    });

    expect(parseSmartQuery("cnel. perez ejb").grado?.canonical).toBe("CORONEL");
    expect(parseSmartQuery("tcnel lopez").grado?.canonical).toBe(
      "TENIENTE CORONEL",
    );
    expect(parseSmartQuery("1t silva").grado?.canonical).toBe(
      "PRIMER TENIENTE",
    );
    expect(parseSmartQuery("va martinez naval")).toMatchObject({
      grado: { canonical: "VICEALMIRANTE", family: "almirante" },
      componente: "ARB",
      nameTokens: ["MARTINEZ"],
    });
    expect(parseSmartQuery("sm1 rivas milicia")).toMatchObject({
      grado: {
        canonical: "SARGENTO MAYOR DE PRIMERA",
        family: "sargento",
      },
      componente: "MIL",
      nameTokens: ["RIVAS"],
    });
  });

  it("lets explicit grado and componente parameters override inferred hints", () => {
    const parsed = parseSmartQuery("Coronel Pérez", "GD", "ARB");
    expect(parsed.grado?.canonical).toBe("GENERAL DE DIVISION");
    expect(parsed.componente).toBe("ARB");
    expect(parsed.nameTokens).toEqual(["PEREZ"]);
  });
});

describe("scoreCandidate", () => {
  it("gives score 1 for exact cedula match", () => {
    const candidate = makeCandidate({ cedula: "15234567" });
    const parsed = parseSmartQuery("V-15.234.567");
    expect(scoreCandidate(candidate, parsed)).toEqual({
      score: 1,
      motivo: "cédula exacta",
    });
  });

  it("scores free token order and partial surnames accurately", () => {
    const candidate = makeCandidate({
      nombreCompleto: "José Gregorio Rodríguez Pérez",
      grado: "Coronel",
      componente: "EJB",
    });

    const normalOrder = scoreCandidate(
      candidate,
      parseSmartQuery("José Rodríguez"),
      { surnameStartIndex: 2 },
    );
    const reversedOrder = scoreCandidate(
      candidate,
      parseSmartQuery("Rodríguez José"),
      { surnameStartIndex: 2 },
    );
    expect(normalOrder.score).toBe(reversedOrder.score);
    expect(normalOrder.score).toBeGreaterThan(0.75);
    expect(normalOrder.motivo).toBe("nombre y apellido exactos");
  });

  it("matches Venezuelan nicknames and reports nickname reason", () => {
    const candidate = makeCandidate({
      nombreCompleto: "José Gregorio Pérez",
      grado: "Coronel",
      componente: "AMB",
    });

    const result = scoreCandidate(candidate, parseSmartQuery("Cheo Pérez"), {
      surnameStartIndex: 2,
    });
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.motivo).toBe("nombre por apodo + apellido exacto");
  });

  it("handles orthographic typos via trigram / Levenshtein similarity", () => {
    const candidate = makeCandidate({
      nombreCompleto: "Luis Eduardo González Martínez",
      grado: "General de División",
      componente: "GNB",
    });

    const typoResult = scoreCandidate(
      candidate,
      parseSmartQuery("GD Gonzáles GNB"),
      { surnameStartIndex: 2 },
    );
    expect(typoResult.score).toBeGreaterThan(0.7);
    expect(typoResult.motivo).toBe(
      "similitud ortográfica + grado + componente",
    );
  });

  it("ranks exact rank + component above family rank and above contradiction", () => {
    const exactMatch = makeCandidate({
      cedula: "1",
      nombreCompleto: "Rafael Antonio Pérez",
      grado: "General de División",
      componente: "AMB",
    });
    const familyMatch = makeCandidate({
      cedula: "2",
      nombreCompleto: "Rafael Antonio Pérez",
      grado: "General de Brigada",
      componente: "AMB",
    });
    const rankMismatch = makeCandidate({
      cedula: "3",
      nombreCompleto: "Rafael Antonio Pérez",
      grado: "Sargento Primero",
      componente: "EJB",
    });

    const parsed = parseSmartQuery("GD Rafa Pérez Aviación");
    const s1 = scoreCandidate(exactMatch, parsed, { surnameStartIndex: 2 });
    const s2 = scoreCandidate(familyMatch, parsed, { surnameStartIndex: 2 });
    const s3 = scoreCandidate(rankMismatch, parsed, { surnameStartIndex: 2 });

    expect(s1.score).toBeGreaterThan(s2.score);
    expect(s2.score).toBeGreaterThan(s3.score);
    expect(s1.motivo).toContain("grado");
    expect(s1.motivo).toContain("componente");
  });

  it("weighs surname match slightly higher than given-name-only match", () => {
    const surnameCandidate = makeCandidate({
      nombreCompleto: "Pedro Pablo Mendoza",
    });
    const givenNameCandidate = makeCandidate({
      nombreCompleto: "Mendoza José Silva",
    });

    const parsed = parseSmartQuery("Mendoza");
    const sSurname = scoreCandidate(surnameCandidate, parsed, {
      surnameStartIndex: 2,
    });
    const sGiven = scoreCandidate(givenNameCandidate, parsed, {
      surnameStartIndex: 1,
    });

    expect(sSurname.score).toBeGreaterThan(sGiven.score);
  });

  it("drops unrelated candidates below threshold", () => {
    const unrelated = makeCandidate({
      nombreCompleto: "María Teresa Bolívar",
      grado: "Teniente",
      componente: "ARB",
    });
    const parsed = parseSmartQuery("GD Carlos Mendoza EJB");
    const result = scoreCandidate(unrelated, parsed, { surnameStartIndex: 2 });
    expect(result.score).toBeLessThan(0.35);
  });
});

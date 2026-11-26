// Portado desde SIGEFANB (solo lectura) y adaptado a AGENDA.
// Emblemas de insignias en /insignias/* y escudos de componentes en /marca/*.

export type RankInsignia = {
  name: string;
  src: string;
  shape: "horizontal" | "vertical";
};

export type FanbComponentCode = "EJB" | "ARB" | "AMB" | "GNB" | "MIL";

const patterns: [RegExp, string, string, RankInsignia["shape"]][] = [
  [/^GENERAL EN JEFE$/, "general_en_jefe", "General en Jefe", "horizontal"],
  [/^MAYOR GENERAL$/, "mayor_general", "Mayor General", "horizontal"],
  [
    /^GENERAL DE DIVISION$/,
    "general_de_division",
    "General de División",
    "horizontal",
  ],
  [
    /^GENERAL DE BRIGADA$/,
    "general_de_brigada",
    "General de Brigada",
    "horizontal",
  ],
  [
    /^ALMIRANTE EN JEFE$/,
    "almirante_en_jefe",
    "Almirante en Jefe",
    "horizontal",
  ],
  [/^VICEALMIRANTE$/, "vicealmirante", "Vicealmirante", "horizontal"],
  [/^CONTRALMIRANTE$/, "contralmirante", "Contralmirante", "horizontal"],
  [/^ALMIRANTE$/, "almirante", "Almirante", "horizontal"],
  [
    /^CAPITAN DE NAVIO$/,
    "capitan_de_navio",
    "Capitán de Navío",
    "horizontal",
  ],
  [
    /^CAPITAN DE FRAGATA$/,
    "capitan_de_fragata",
    "Capitán de Fragata",
    "horizontal",
  ],
  [
    /^CAPITAN DE CORBETA$/,
    "capitan_de_corbeta",
    "Capitán de Corbeta",
    "horizontal",
  ],
  [
    /^TENIENTE DE NAVIO$/,
    "teniente_de_navio",
    "Teniente de Navío",
    "horizontal",
  ],
  [
    /^TENIENTE DE FRAGATA$/,
    "teniente_de_fragata",
    "Teniente de Fragata",
    "horizontal",
  ],
  [
    /^TENIENTE DE CORBETA$/,
    "teniente_de_corbeta",
    "Teniente de Corbeta",
    "horizontal",
  ],
  [/^TENIENTE CORONEL$/, "teniente_coronel", "Teniente Coronel", "horizontal"],
  [/^CORONEL$/, "coronel", "Coronel", "horizontal"],
  [/^PRIMER TENIENTE$/, "primer_teniente", "Primer Teniente", "horizontal"],
  [/^TENIENTE$/, "teniente", "Teniente", "horizontal"],
  [/^CAPITAN$/, "capitan", "Capitán", "horizontal"],
  [
    /^SARGENTO SUPERVISOR$/,
    "sargento_supervisor",
    "Sargento Supervisor",
    "horizontal",
  ],
  [
    /^SARGENTO AYUDANTE$/,
    "sargento_ayudante",
    "Sargento Ayudante",
    "horizontal",
  ],
  [
    /^SARGENTO MAYOR DE (1RA|1ERA|PRIMERA)$/,
    "sargento_mayor_de_primera",
    "Sargento Mayor de Primera",
    "horizontal",
  ],
  [
    /^SARGENTO MAYOR DE (2DA|SEGUNDA)$/,
    "sargento_mayor_de_segunda",
    "Sargento Mayor de Segunda",
    "horizontal",
  ],
  [
    /^SARGENTO MAYOR DE (3RA|TERCERA)$/,
    "sargento_mayor_de_tercera",
    "Sargento Mayor de Tercera",
    "horizontal",
  ],
  [
    /^SARGENTO (PRIMERO|1RO|DE PRIMERA)$/,
    "sargento_primero",
    "Sargento Primero",
    "horizontal",
  ],
  [
    /^SARGENTO (SEGUNDO|2DO|DE SEGUNDA)$/,
    "sargento_segundo",
    "Sargento Segundo",
    "horizontal",
  ],
  [/^CABO (PRIMERO|1RO)$/, "cabo_primero", "Cabo Primero", "vertical"],
  [/^CABO (SEGUNDO|2DO)$/, "cabo_segundo", "Cabo Segundo", "vertical"],
  [/^MAYOR$/, "mayor", "Mayor", "horizontal"],
  [
    /^INFANTE DISTINGUIDO$/,
    "distinguido_naval",
    "Infante Distinguido",
    "vertical",
  ],
  [
    /^MARINERO DISTINGUIDO$/,
    "distinguido_naval",
    "Marinero Distinguido",
    "vertical",
  ],
  [
    /^POLICIA NAVAL DISTINGUIDO$/,
    "distinguido_naval",
    "Policía Naval Distinguido",
    "vertical",
  ],
  [/^DISTINGUIDO$/, "distinguido", "Distinguido", "vertical"],
  [/^INFANTE DE MARINA$/, "marinero", "Infante de Marina", "vertical"],
  [/^POLICIA NAVAL$/, "marinero", "Policía Naval", "vertical"],
  [/^MARINERO$/, "marinero", "Marinero", "vertical"],
];

const naval = new Set([
  "almirante_en_jefe",
  "almirante",
  "vicealmirante",
  "contralmirante",
  "capitan_de_navio",
  "capitan_de_fragata",
  "capitan_de_corbeta",
  "teniente_de_navio",
  "teniente_de_fragata",
  "teniente_de_corbeta",
  "distinguido_naval",
  "marinero",
]);

function componentKey(
  value: unknown,
): "ejercito" | "armada" | "aviacion" | "gnb" | "milicia" | null {
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (
    text === "ejercito" ||
    text === "armada" ||
    text === "aviacion" ||
    text === "gnb" ||
    text === "milicia"
  ) {
    return text;
  }
  if (text === "mil" || text.includes("milicia")) return "milicia";
  if (/\bejb\b/.test(text) || text.includes("ejercito")) return "ejercito";
  if (/\barb\b/.test(text) || text.includes("armada")) return "armada";
  if (/\bamb\b/.test(text) || text.includes("aviaci")) return "aviacion";
  if (/\bgnb\b/.test(text) || text.includes("guardia")) return "gnb";
  return null;
}

const componentLogos = {
  ejercito: {
    code: "EJB" as const,
    name: "Ejército Bolivariano",
    src: "/marca/ejercito.png",
  },
  armada: {
    code: "ARB" as const,
    name: "Armada Bolivariana",
    src: "/marca/armada.png",
  },
  aviacion: {
    code: "AMB" as const,
    name: "Aviación Militar Bolivariana",
    src: "/marca/aviacion.png",
  },
  gnb: {
    code: "GNB" as const,
    name: "Guardia Nacional Bolivariana",
    src: "/marca/guardia-nacional.png",
  },
  milicia: {
    code: "MIL" as const,
    name: "Milicia Bolivariana",
    src: "/marca/milicia.png",
  },
} as const;

const ceofanbLogo = {
  code: "CEOFANB" as const,
  name: "Comando Estratégico Operacional de la FANB",
  src: "/marca/ceofanb.png",
} as const;

const mppdLogo = {
  code: "MPPD" as const,
  name: "Ministerio del Poder Popular para la Defensa",
  src: "/marca/mppd.png",
} as const;

export function componentLogo(value: unknown) {
  if (value === "ceofanb") return ceofanbLogo;
  if (value === "mppd") return mppdLogo;
  const key = componentKey(value);
  return key ? componentLogos[key] : null;
}

export function deriveComponent(
  tipoPersonalNombre: string | null | undefined,
): FanbComponentCode | null {
  const key = componentKey(tipoPersonalNombre);
  return key ? componentLogos[key].code : null;
}

function folderFor(component: ReturnType<typeof componentKey>, id: string) {
  if (naval.has(id)) return "armada";
  if (component === "aviacion") return "aviacion";
  if (component === "gnb") return "guardia_nacional";
  if (component === "armada") return "armada";
  return "ejercito";
}

export function restoreRankDe(text: string): string {
  return text
    .replace(
      /\b(GENERAL|CAPITAN|TENIENTE|ALFEREZ) (DIVISION|BRIGADA|NAVIO|FRAGATA|CORBETA)\b/g,
      "$1 DE $2",
    )
    .replace(
      /\bSARGENTO MAYOR (PRIMERA|SEGUNDA|TERCERA)\b/g,
      "SARGENTO MAYOR DE $1",
    );
}

function normalizeCargo(cargo: string) {
  const text = cargo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return restoreRankDe(
    text
      .replace(/^[A-Z] /, "")
      .replace(/^\d{1,2} /, "")
      .replace(/ (?:TIEMPO PARCIAL|TP)$/, ""),
  );
}

type Academy = "ameb" | "amgnb" | "atmb" | "amab" | "amarb" | "ammed";

const cadetPatterns: [RegExp, string, string, RankInsignia["shape"]][] = [
  [
    /^ALUMNOS? BRIGADIER MAYOR$/,
    "brigadier_mayor",
    "Alumno Brigadier Mayor",
    "vertical",
  ],
  [
    /^ALUMNOS? (?:PRIMER BRIGADIER|BRIGADIER PRIMERO)$/,
    "primer_brigadier",
    "Alumno Primer Brigadier",
    "vertical",
  ],
  [
    /^ALUMNOS? SEGUNDO BRIGADIER$/,
    "segundo_brigadier",
    "Alumno Segundo Brigadier",
    "vertical",
  ],
  [/^ALUMNOS? SUB ?BRIGADIER$/, "brigadier", "Alumno Sub-Brigadier", "vertical"],
  [/^ALUMNOS? BRIGADIER$/, "segundo_brigadier", "Alumno Brigadier", "vertical"],
  [
    /^ALUMNOS? (?:DISTIN?GUIDO|DIST) (?:DE )?(?:SEGUNDO|2DO|2)(?: ANO)?$/,
    "distinguido_2_ano",
    "Alumno Distinguido",
    "vertical",
  ],
  [
    /^ALUMNOS? (?:DISTIN?GUIDO|DIST)(?: (?:DE )?(?:PRIMER|1ER|1RO|1)(?: ANO)?)?$/,
    "distinguido_1_ano",
    "Alumno Distinguido",
    "vertical",
  ],
  [
    /^ALUMNOS? (?:DE )?(?:TERCER|TERCERO|3ER|3RO|3)(?: ANO)?$/,
    "cadete_3_ano",
    "Alumno de 3er año",
    "vertical",
  ],
  [
    /^ALUMNOS? (?:DE )?(?:SEGUNDO|2DO|2)(?: ANO)?$/,
    "cadete_2_ano",
    "Alumno de 2º año",
    "vertical",
  ],
  [
    /^ALUMNOS? (?:DE )?(?:PRIMER|1ER|1RO|1)(?: ANO)?$/,
    "cadete_1_ano",
    "Alumno de 1er año",
    "vertical",
  ],
  [
    /^ASPIRANTE A ALUMNOS?(?: PARA TROPA PROFESIONAL)?$/,
    "cadete_1_ano",
    "Aspirante a Alumno",
    "vertical",
  ],
  [/^ALUMNOS?$/, "cadete_1_ano", "Alumno", "vertical"],
  [/^ALFEREZ MAYOR$/, "alferez_mayor", "Alférez Mayor", "horizontal"],
  [/^ALFEREZ AUXILIAR$/, "alferez_auxiliar", "Alférez Auxiliar", "horizontal"],
  [/^ALFEREZ$/, "alferez", "Alférez", "horizontal"],
  [
    /^GUARDIA ?MARINA MAYOR$/,
    "guardiamarina_mayor",
    "Guardiamarina Mayor",
    "vertical",
  ],
  [
    /^GUARDIA ?MARINA AUXILIAR$/,
    "guardiamarina_auxiliar",
    "Guardiamarina Auxiliar",
    "vertical",
  ],
  [/^GUARDIA ?MARINA$/, "guardiamarina", "Guardiamarina", "vertical"],
  [/^BRIGADIER MAYOR$/, "brigadier_mayor", "Brigadier Mayor", "vertical"],
  [
    /^(?:PRIMER BRIGADIER|BRIGADIER PRIMERO)$/,
    "primer_brigadier",
    "Primer Brigadier",
    "vertical",
  ],
  [/^SEGUNDO BRIGADIER$/, "segundo_brigadier", "Segundo Brigadier", "vertical"],
  [/^SUB ?BRIGADIER$/, "brigadier", "Sub-Brigadier", "vertical"],
  [/^BRIGADIER$/, "segundo_brigadier", "Brigadier", "vertical"],
  [
    /^(?:CADETE DISTINGUIDO (?:DE )?(?:SEGUNDO|2DO|2)(?: ANO)?|CDD ?2)$/,
    "distinguido_2_ano",
    "Cadete Distinguido de 2º año",
    "vertical",
  ],
  [
    /^(?:CADETE DISTINGUIDO (?:DE )?(?:PRIMER|1ER|1RO|1)(?: ANO)?|CDD ?1)$/,
    "distinguido_1_ano",
    "Cadete Distinguido de 1er año",
    "vertical",
  ],
  [
    /^CADETE (?:DE )?(?:SEXTO|6TO|6)(?: ANO)?$/,
    "cadete_6_ano",
    "Cadete de 6º año",
    "vertical",
  ],
  [
    /^CADETE (?:DE )?(?:QUINTO|5TO|5)(?: ANO)?$/,
    "cadete_5_ano",
    "Cadete de 5º año",
    "vertical",
  ],
  [
    /^CADETE (?:DE )?(?:CUARTO|4TO|4)(?: ANO)?$/,
    "cadete_4_ano",
    "Cadete de 4º año",
    "vertical",
  ],
  [
    /^CADETE (?:DE )?(?:TERCER|TERCERO|3ER|3RO|3)(?: ANO)?$/,
    "cadete_3_ano",
    "Cadete de 3er año",
    "vertical",
  ],
  [
    /^CADETE (?:DE )?(?:SEGUNDO|2DO|2)(?: ANO)?$/,
    "cadete_2_ano",
    "Cadete de 2º año",
    "vertical",
  ],
  [
    /^CADETE (?:DE )?(?:PRIMER|1ER|1RO|1)(?: ANO)?$/,
    "cadete_1_ano",
    "Cadete de 1er año",
    "vertical",
  ],
  [/^ASPIRANTE A CADETE$/, "cadete_1_ano", "Aspirante a Cadete", "vertical"],
  [/^CADETE$/, "cadete_1_ano", "Cadete", "vertical"],
];

const academyFiles: Record<Academy, readonly string[]> = {
  ameb: [
    "alferez_mayor",
    "alferez_auxiliar",
    "alferez",
    "brigadier_mayor",
    "primer_brigadier",
    "segundo_brigadier",
    "brigadier",
    "distinguido_marco",
    "cadete_4_ano",
    "cadete_3_ano",
    "cadete_2_ano",
    "cadete_1_ano",
  ],
  amgnb: [
    "alferez_mayor",
    "alferez_auxiliar",
    "alferez",
    "brigadier_mayor",
    "primer_brigadier",
    "segundo_brigadier",
    "brigadier",
    "distinguido_marco",
    "cadete_4_ano",
    "cadete_3_ano",
    "cadete_2_ano",
    "cadete_1_ano",
  ],
  atmb: [
    "alferez_mayor",
    "alferez_auxiliar",
    "alferez",
    "brigadier_mayor",
    "primer_brigadier",
    "segundo_brigadier",
    "brigadier",
    "distinguido_marco",
    "cadete_4_ano",
    "cadete_3_ano",
    "cadete_2_ano",
    "cadete_1_ano",
  ],
  amab: [
    "alferez_mayor",
    "alferez_auxiliar",
    "alferez",
    "brigadier_mayor",
    "primer_brigadier",
    "segundo_brigadier",
    "brigadier",
    "distinguido_2_ano",
    "distinguido_1_ano",
    "cadete_4_ano",
    "cadete_3_ano",
    "cadete_2_ano",
    "cadete_1_ano",
  ],
  amarb: [
    "guardiamarina_mayor",
    "guardiamarina_auxiliar",
    "guardiamarina",
    "brigadier_mayor",
    "brigadier_primero",
    "segundo_brigadier",
    "brigadier",
    "distinguido_2_ano",
    "distinguido_1_ano",
    "cadete_3_ano",
    "cadete_2_ano",
    "cadete_1_ano",
  ],
  ammed: [
    "alferez_mayor",
    "alferez_auxiliar",
    "alferez",
    "brigadier_mayor",
    "primer_brigadier",
    "segundo_brigadier",
    "brigadier",
    "distinguido",
    "cadete_6_ano",
    "cadete_5_ano",
    "cadete_4_ano",
    "cadete_3_ano",
    "cadete_2_ano",
    "cadete_1_ano",
  ],
};

function foldUnit(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

function academyFromUnit(unit: unknown): Academy | null {
  const text = foldUnit(unit);
  if (!text.trim()) return null;
  if (
    text.includes("TECNIC") ||
    text.includes("COMUNICACIONES Y ELECTRONICA")
  ) {
    return "atmb";
  }
  if (text.includes("MEDICINA") || text.includes("CIENCIAS DE LA SALUD")) {
    return "ammed";
  }
  if (text.includes("AVIACION")) return "amab";
  if (text.includes("NAVAL") || text.includes("ARMADA")) return "amarb";
  if (text.includes("GUARDIA NACIONAL") || text.includes("GNB")) return "amgnb";
  if (text.includes("EJERCITO")) return "ameb";
  return null;
}

function academyFromComponent(component: unknown): Academy | null {
  const key = componentKey(component);
  if (key === "ejercito") return "ameb";
  if (key === "gnb") return "amgnb";
  if (key === "aviacion") return "amab";
  if (key === "armada") return "amarb";
  return null;
}

function cadetFile(academy: Academy, id: string) {
  let file = id;
  if (file === "primer_brigadier" && academy === "amarb") {
    file = "brigadier_primero";
  }
  if (
    (file === "distinguido_1_ano" || file === "distinguido_2_ano") &&
    academy !== "amab" &&
    academy !== "amarb"
  ) {
    file = academy === "ammed" ? "distinguido" : "distinguido_marco";
  }
  return academyFiles[academy].includes(file) ? file : null;
}

function cadetInsignia(
  text: string,
  component: unknown,
  unit: unknown,
): RankInsignia | null | undefined {
  const found = cadetPatterns.find(([pattern]) => pattern.test(text));
  if (!found) return undefined;
  const [, id, name, shape] = found;
  let academy =
    academyFromUnit(unit) ?? academyFromComponent(component) ?? "ameb";
  if (id === "cadete_5_ano" || id === "cadete_6_ano") academy = "ammed";
  if (
    id.startsWith("alferez") &&
    (academy === "ammed" || academy === "amarb")
  ) {
    const stars = academyFromComponent(component);
    academy = stars && stars !== "amarb" ? stars : "ameb";
  }
  if (id.startsWith("guardiamarina") && !cadetFile(academy, id)) {
    academy = "amarb";
  }
  let file = cadetFile(academy, id);
  if (!file) {
    academy = id === "cadete_4_ano" && academy === "amarb" ? "ammed" : "ameb";
    file = cadetFile(academy, id);
  }
  if (!file) return null;
  const nombre =
    academy === "amarb" && name === "Primer Brigadier"
      ? "Brigadier Primero"
      : name;
  return {
    name: nombre,
    src: `/insignias/academias/${academy}/${file}@2x.png`,
    shape,
  };
}

export function rankInsignia(
  cargo: unknown,
  component?: unknown,
  unit?: unknown,
): RankInsignia | null {
  if (cargo == null || String(cargo).trim() === "") return null;
  const text = normalizeCargo(String(cargo));
  const cadet = cadetInsignia(text, component, unit);
  if (cadet !== undefined) return cadet;
  const found = patterns.find(([pattern]) => pattern.test(text));
  if (!found) return null;
  const [, id, name, shape] = found;
  const folder = folderFor(componentKey(component), id);
  const file =
    id === "distinguido_naval"
      ? "distinguido@2x.png"
      : id === "distinguido" && folder !== "armada"
        ? "distinguido_marco@2x.png"
        : `${id}@2x.png`;
  return { name, src: `/insignias/${folder}/${file}`, shape };
}

const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "y", "en"]);

function toSpanishTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es-VE");
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("es-VE") + lower.slice(1);
    })
    .join(" ");
}

export function formatGrado(
  descripcionCargo: string | null | undefined,
  componente?: string | null,
  unidad?: string | null,
): string {
  const raw = descripcionCargo?.trim() ?? "";
  if (!raw) return "";
  const insignia = rankInsignia(raw, componente, unidad);
  if (insignia) return insignia.name;
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/^[A-Za-z]\s+/, "")
    .replace(/^\d{1,2}\s+/, "")
    .trim();
  return toSpanishTitleCase(cleaned);
}

export function formatNombreCompleto(
  parts: (string | null | undefined)[],
): string {
  const joined = parts
    .map((p) => p?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return toSpanishTitleCase(joined);
}

export function normalizeCedulaInput(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(/\./g, "");
  const match = cleaned.match(/^(?:[VvEe]-?)?(\d{5,10})$/);
  const digits = match?.[1];
  if (!digits) return null;
  const num = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(num) || num <= 0 || num > 2_147_483_647) {
    return null;
  }
  return String(num);
}

export function maskCedula(
  cedula: string | null | undefined,
  nacionalidad?: string | null,
): string {
  const digits = cedula?.trim() ?? "";
  if (!digits) return "";
  const prefix = nacionalidad === "E" ? "E-" : "V-";
  if (digits.length <= 4) return `${prefix}${digits}`;
  return `${prefix}••••${digits.slice(-4)}`;
}

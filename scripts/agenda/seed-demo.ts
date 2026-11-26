import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const QA_CREDENTIAL_PATH =
  "/home/diazpolanco13/proyectos/agenda/QA-CREDENCIAL.txt";
const QA_EMAIL = "qa.noche@agenda.local";
const QA_NAME = "Cnel. Roberto QA (Verificación)";
const OWNER_EXISTING_EMAIL = "diazpolanco13@gmail.com";
const WORKSPACE_SLUG = "despacho-ministro-demo";
const WORKSPACE_NAME = "Despacho del Ministro (demo)";

const rootRequire = createRequire(
  new URL("../../package.json", import.meta.url),
);
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);

const { config: loadEnv } = rootRequire("dotenv-mono") as {
  config: (options?: { cwd?: string }) => void;
};
loadEnv({ cwd: REPO_ROOT });

const bcrypt = apiRequire("bcryptjs") as {
  hash: (data: string, saltOrRounds: number) => Promise<string>;
};
const { and, eq, inArray, or } = apiRequire("drizzle-orm") as {
  and: (...conditions: unknown[]) => unknown;
  eq: (column: unknown, value: unknown) => unknown;
  inArray: (column: unknown, values: unknown[]) => unknown;
  or: (...conditions: unknown[]) => unknown;
};

import db, {
  getDatabasePool,
  schema,
} from "../../apps/api/src/database/index.js";
import {
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
} from "../../packages/permissions/src/index.js";

type ColumnSlug = "to-do" | "in-progress" | "in-review" | "done";
type TaskPriority = "no-priority" | "low" | "medium" | "high" | "urgent";

interface DemoAssigneeDef {
  email: string;
  name: string;
}

interface TaskDef {
  number: number;
  title: string;
  description: string;
  status: ColumnSlug;
  priority: TaskPriority;
  assigneeEmail: string;
  startDate: string;
  dueDate: string;
  position: number;
}

interface RelationDef {
  sourceNumber: number;
  targetNumber: number;
  relationType: "subtask" | "blocks";
}

interface ProjectDef {
  slug: string;
  name: string;
  icon: string;
  description: string;
  position: number;
  tasks: TaskDef[];
  relations: RelationDef[];
}

const STANDARD_COLUMNS: ReadonlyArray<{
  slug: ColumnSlug;
  name: string;
  position: number;
  isFinal: boolean;
}> = [
  { slug: "to-do", name: "Por hacer", position: 0, isFinal: false },
  { slug: "in-progress", name: "En progreso", position: 1, isFinal: false },
  { slug: "in-review", name: "En revisión", position: 2, isFinal: false },
  { slug: "done", name: "Completado", position: 3, isFinal: true },
];

const DEMO_ASSIGNEES: ReadonlyArray<DemoAssigneeDef> = [
  { email: "gd.mendoza@demo.agenda.local", name: "G/D Carlos A. Mendoza R." },
  { email: "gb.castillo@demo.agenda.local", name: "G/B Elena V. Castillo M." },
  { email: "cnel.herrera@demo.agenda.local", name: "Cnel. José L. Herrera P." },
  { email: "cn.delgado@demo.agenda.local", name: "C/N María F. Delgado S." },
  { email: "tcnel.rojas@demo.agenda.local", name: "Tcnel. Andrés E. Rojas V." },
  {
    email: "may.quintero@demo.agenda.local",
    name: "May. Sofía I. Quintero G.",
  },
];

const PROJECTS: ReadonlyArray<ProjectDef> = [
  {
    slug: "PML",
    name: "Plan de Modernización Logística",
    icon: "Shield",
    description:
      "Modernización integral de flota terrestre, almacenes críticos y trazabilidad logística en SIGEFANB.",
    position: 0,
    tasks: [
      {
        number: 1,
        title: "Fase 1: Diagnóstico de Flota y Almacenes",
        description:
          "Consolidación del estado real de unidades de transporte y depósitos estratégicos.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2026-11-02",
        dueDate: "2026-12-10",
        position: 0,
      },
      {
        number: 2,
        title: "Levantamiento de parque automotor operativo",
        description:
          "Inventario técnico de vehículos tácticos y administrativos por región militar.",
        status: "done",
        priority: "high",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2026-11-02",
        dueDate: "2026-11-10",
        position: 1,
      },
      {
        number: 3,
        title: "Auditoría de almacenes centrales de intendencia",
        description:
          "Verificación física de existencias, capacidad instalada y condiciones de resguardo.",
        status: "done",
        priority: "medium",
        assigneeEmail: "tcnel.rojas@demo.agenda.local",
        startDate: "2026-11-05",
        dueDate: "2026-11-14",
        position: 2,
      },
      {
        number: 4,
        title: "Informe de brechas de repuestos críticos",
        description:
          "Identificación de componentes de alta rotación con déficit en unidades operativas.",
        status: "in-progress",
        priority: "urgent",
        assigneeEmail: "may.quintero@demo.agenda.local",
        startDate: "2026-11-12",
        dueDate: "2026-11-20",
        position: 3,
      },
      {
        number: 5,
        title: "Hito: Aprobación del diagnóstico logístico",
        description:
          "Validación ministerial de la línea base para la fase de adquisiciones.",
        status: "done",
        priority: "high",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2026-11-18",
        dueDate: "2026-11-18",
        position: 4,
      },
      {
        number: 6,
        title: "Fase 2: Adquisición e Inventario Crítico",
        description:
          "Gestión de procura, certificación presupuestaria y recepción de lotes prioritarios.",
        status: "in-progress",
        priority: "urgent",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2026-11-15",
        dueDate: "2027-01-25",
        position: 5,
      },
      {
        number: 7,
        title: "Consolidación de requerimientos prioritarios de repuestos",
        description:
          "Especificaciones técnicas definitivas para procura inmediata de flota crítica.",
        status: "in-progress",
        priority: "urgent",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2026-11-14",
        dueDate: "2026-11-22",
        position: 6,
      },
      {
        number: 8,
        title: "Evaluación técnica de proveedores nacionales y aliados",
        description:
          "Revisión de capacidad de suministro, tiempos de entrega y garantías técnicas.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "cn.delgado@demo.agenda.local",
        startDate: "2026-12-01",
        dueDate: "2026-12-18",
        position: 7,
      },
      {
        number: 9,
        title: "Certificación presupuestaria de lotes críticos",
        description:
          "Disponibilidad financiera y aval administrativo ante la Dirección de Planificación.",
        status: "in-review",
        priority: "high",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2026-12-08",
        dueDate: "2026-12-23",
        position: 8,
      },
      {
        number: 10,
        title: "Emisión de órdenes de compra y cronograma de entrega",
        description:
          "Formalización contractual y seguimiento de despachos hacia depósitos centrales.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "tcnel.rojas@demo.agenda.local",
        startDate: "2026-12-26",
        dueDate: "2027-01-15",
        position: 9,
      },
      {
        number: 11,
        title: "Hito: Recepción del primer lote estratégico",
        description:
          "Acta de recepción conforme e ingreso inicial al inventario centralizado.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2027-01-25",
        dueDate: "2027-01-25",
        position: 10,
      },
      {
        number: 12,
        title: "Fase 3: Integración Tecnológica SIGEFANB",
        description:
          "Enlace operativo del catálogo logístico y trazabilidad en tiempo real dentro de SIGEFANB.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "cn.delgado@demo.agenda.local",
        startDate: "2027-01-05",
        dueDate: "2027-02-28",
        position: 11,
      },
      {
        number: 13,
        title: "Homologación de catálogos de almacén con SIGEFANB",
        description:
          "Estandarización de códigos de bienes, repuestos y unidades administrativas.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "may.quintero@demo.agenda.local",
        startDate: "2027-01-05",
        dueDate: "2027-01-22",
        position: 12,
      },
      {
        number: 14,
        title: "Integración de trazabilidad por código único de unidad",
        description:
          "Seguimiento de asignaciones y movimientos de inventario por unidad receptora.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "cn.delgado@demo.agenda.local",
        startDate: "2027-01-25",
        dueDate: "2027-02-10",
        position: 13,
      },
      {
        number: 15,
        title: "Pruebas piloto en comando logístico central",
        description:
          "Validación de flujos de despacho, recepción y alertas de stock mínimo.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "tcnel.rojas@demo.agenda.local",
        startDate: "2027-02-11",
        dueDate: "2027-02-22",
        position: 14,
      },
      {
        number: 16,
        title: "Capacitación de operadores logísticos regionales",
        description:
          "Jornadas prácticas de operación del módulo logístico en las REDI.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "may.quintero@demo.agenda.local",
        startDate: "2027-02-18",
        dueDate: "2027-02-28",
        position: 15,
      },
      {
        number: 17,
        title: "Fase 4: Despliegue Operacional y Cierre",
        description:
          "Puesta en marcha nacional, auditoría final y entrega ejecutiva del plan.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2027-02-15",
        dueDate: "2027-03-26",
        position: 16,
      },
      {
        number: 18,
        title: "Despliegue gradual en regiones estratégicas",
        description:
          "Activación escalonada de procedimientos y tableros en todas las ZODI.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2027-02-15",
        dueDate: "2027-03-10",
        position: 17,
      },
      {
        number: 19,
        title: "Auditoría de control interno post-despliegue",
        description:
          "Verificación de cumplimiento normativo y conciliación de inventarios.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2027-03-11",
        dueDate: "2027-03-22",
        position: 18,
      },
      {
        number: 20,
        title: "Hito: Cierre y entrega al Despacho del Ministro",
        description:
          "Presentación de resultados finales e indicadores de disponibilidad operativa.",
        status: "to-do",
        priority: "urgent",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2027-03-26",
        dueDate: "2027-03-26",
        position: 19,
      },
    ],
    relations: [
      { sourceNumber: 1, targetNumber: 2, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 3, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 4, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 5, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 7, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 8, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 9, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 10, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 11, relationType: "subtask" },
      { sourceNumber: 12, targetNumber: 13, relationType: "subtask" },
      { sourceNumber: 12, targetNumber: 14, relationType: "subtask" },
      { sourceNumber: 12, targetNumber: 15, relationType: "subtask" },
      { sourceNumber: 12, targetNumber: 16, relationType: "subtask" },
      { sourceNumber: 17, targetNumber: 18, relationType: "subtask" },
      { sourceNumber: 17, targetNumber: 19, relationType: "subtask" },
      { sourceNumber: 17, targetNumber: 20, relationType: "subtask" },
      { sourceNumber: 2, targetNumber: 4, relationType: "blocks" },
      { sourceNumber: 4, targetNumber: 5, relationType: "blocks" },
      { sourceNumber: 7, targetNumber: 8, relationType: "blocks" },
      { sourceNumber: 8, targetNumber: 9, relationType: "blocks" },
      { sourceNumber: 9, targetNumber: 10, relationType: "blocks" },
      { sourceNumber: 10, targetNumber: 11, relationType: "blocks" },
      { sourceNumber: 13, targetNumber: 14, relationType: "blocks" },
      { sourceNumber: 14, targetNumber: 15, relationType: "blocks" },
      { sourceNumber: 15, targetNumber: 16, relationType: "blocks" },
      { sourceNumber: 18, targetNumber: 19, relationType: "blocks" },
      { sourceNumber: 19, targetNumber: 20, relationType: "blocks" },
    ],
  },
  {
    slug: "CDS",
    name: "Consejo de Defensa – Seguimiento",
    icon: "Target",
    description:
      "Control de acuerdos, directivas de seguridad y compromisos estratégicos emanados del Consejo de Defensa.",
    position: 1,
    tasks: [
      {
        number: 1,
        title: "Acuerdos de Seguridad y Alistamiento",
        description:
          "Ejecución de directivas prioritarias de resguardo territorial y comunicaciones.",
        status: "in-progress",
        priority: "urgent",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2026-11-04",
        dueDate: "2026-12-20",
        position: 0,
      },
      {
        number: 2,
        title: "Directiva de resguardo de infraestructura energética",
        description:
          "Despliegue preventivo y puntos de control en instalaciones críticas.",
        status: "done",
        priority: "urgent",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2026-11-04",
        dueDate: "2026-11-12",
        position: 1,
      },
      {
        number: 3,
        title: "Actualización de protocolos de respuesta rápida",
        description:
          "Revisión conjunta de tiempos de activación y cadenas de mando.",
        status: "in-progress",
        priority: "urgent",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2026-11-10",
        dueDate: "2026-11-19",
        position: 2,
      },
      {
        number: 4,
        title: "Matriz de coordinación interinstitucional regional",
        description:
          "Alineación de enlaces civiles y militares por entidad federal.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "cn.delgado@demo.agenda.local",
        startDate: "2026-11-12",
        dueDate: "2026-11-23",
        position: 3,
      },
      {
        number: 5,
        title: "Verificación de comunicaciones cifradas de mando",
        description:
          "Pruebas de redundancia y enlaces satelitales entre comandos superiores.",
        status: "in-review",
        priority: "high",
        assigneeEmail: "tcnel.rojas@demo.agenda.local",
        startDate: "2026-12-01",
        dueDate: "2026-12-18",
        position: 4,
      },
      {
        number: 6,
        title: "Seguimiento de Acuerdos Trimestrales",
        description:
          "Consolidación de actas, balance anual 2026 y agenda de apertura 2027.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2026-11-10",
        dueDate: "2027-01-30",
        position: 5,
      },
      {
        number: 7,
        title: "Acta consolidada de sesión ordinaria noviembre",
        description:
          "Minuta firmada con responsables, plazos y acuerdos aprobados.",
        status: "done",
        priority: "medium",
        assigneeEmail: "may.quintero@demo.agenda.local",
        startDate: "2026-11-10",
        dueDate: "2026-11-16",
        position: 6,
      },
      {
        number: 8,
        title: "Balance de cumplimiento de metas 2026",
        description:
          "Evaluación porcentual de acuerdos cerrados y compromisos en curso.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2026-12-10",
        dueDate: "2026-12-29",
        position: 7,
      },
      {
        number: 9,
        title: "Agenda ejecutiva primer consejo 2027",
        description:
          "Preparación de puntos de cuenta, informes de inteligencia y prioridades Q1.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2027-01-08",
        dueDate: "2027-01-28",
        position: 8,
      },
    ],
    relations: [
      { sourceNumber: 1, targetNumber: 2, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 3, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 4, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 5, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 7, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 8, relationType: "subtask" },
      { sourceNumber: 6, targetNumber: 9, relationType: "subtask" },
      { sourceNumber: 2, targetNumber: 3, relationType: "blocks" },
      { sourceNumber: 3, targetNumber: 5, relationType: "blocks" },
      { sourceNumber: 7, targetNumber: 8, relationType: "blocks" },
      { sourceNumber: 8, targetNumber: 9, relationType: "blocks" },
    ],
  },
  {
    slug: "VUQ",
    name: "Visitas a Unidades Q1",
    icon: "MapPin",
    description:
      "Cronograma de inspecciones ministeriales y revistas de apresto operacional en REDI y ZODI.",
    position: 2,
    tasks: [
      {
        number: 1,
        title: "Inspecciones REDI Occidente y Los Andes",
        description:
          "Gira de supervisión operativa y logística en el eje occidental.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2027-01-12",
        dueDate: "2027-02-14",
        position: 0,
      },
      {
        number: 2,
        title: "Revista de apresto operacional ZODI Zulia",
        description:
          "Verificación de dotación, entrenamiento y alistamiento de brigadas.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2027-01-12",
        dueDate: "2027-01-22",
        position: 1,
      },
      {
        number: 3,
        title: "Inspección logística y sanitaria ZODI Táchira",
        description:
          "Supervisión de abastecimiento, parque automotor y red de sanidad militar.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "tcnel.rojas@demo.agenda.local",
        startDate: "2027-01-26",
        dueDate: "2027-02-05",
        position: 2,
      },
      {
        number: 4,
        title: "Hito: Informe consolidado eje occidental",
        description:
          "Entrega de hallazgos y recomendaciones de inspección al Despacho.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2027-02-14",
        dueDate: "2027-02-14",
        position: 3,
      },
      {
        number: 5,
        title: "Inspecciones REDI Central y Guayana",
        description:
          "Visitas de comando a unidades navales, aeronáuticas y guarniciones del sur.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2027-02-18",
        dueDate: "2027-03-20",
        position: 4,
      },
      {
        number: 6,
        title: "Supervisión de unidades navales y aeronáuticas centrales",
        description:
          "Inspección de mantenimiento mayor y disponibilidad de plataformas.",
        status: "to-do",
        priority: "high",
        assigneeEmail: "cn.delgado@demo.agenda.local",
        startDate: "2027-02-18",
        dueDate: "2027-03-04",
        position: 5,
      },
      {
        number: 7,
        title: "Evaluación territorial ZODI Bolívar",
        description:
          "Revisión de despliegue fronterizo, apoyo logístico y bienestar del personal.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "may.quintero@demo.agenda.local",
        startDate: "2027-03-08",
        dueDate: "2027-03-20",
        position: 6,
      },
    ],
    relations: [
      { sourceNumber: 1, targetNumber: 2, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 3, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 4, relationType: "subtask" },
      { sourceNumber: 5, targetNumber: 6, relationType: "subtask" },
      { sourceNumber: 5, targetNumber: 7, relationType: "subtask" },
      { sourceNumber: 2, targetNumber: 3, relationType: "blocks" },
      { sourceNumber: 3, targetNumber: 4, relationType: "blocks" },
      { sourceNumber: 6, targetNumber: 7, relationType: "blocks" },
    ],
  },
  {
    slug: "RP27",
    name: "Revisión Presupuestaria 2027",
    icon: "Landmark",
    description:
      "Formulación, priorización de inversiones y aprobación ministerial del presupuesto sectorial 2027.",
    position: 3,
    tasks: [
      {
        number: 1,
        title: "Formulación y Ajuste de Partidas 2027",
        description:
          "Consolidación técnica, jurídica y financiera de créditos presupuestarios.",
        status: "in-progress",
        priority: "high",
        assigneeEmail: "cn.delgado@demo.agenda.local",
        startDate: "2026-12-01",
        dueDate: "2027-02-18",
        position: 0,
      },
      {
        number: 2,
        title: "Revisión de techos presupuestarios por componente",
        description:
          "Análisis comparativo de requerimientos de funcionamiento por componente.",
        status: "in-review",
        priority: "high",
        assigneeEmail: "cnel.herrera@demo.agenda.local",
        startDate: "2026-12-01",
        dueDate: "2026-12-16",
        position: 1,
      },
      {
        number: 3,
        title: "Priorización de proyectos de inversión estratégica",
        description:
          "Ordenamiento de proyectos plurianuales según impacto operativo.",
        status: "to-do",
        priority: "urgent",
        assigneeEmail: "gd.mendoza@demo.agenda.local",
        startDate: "2026-12-17",
        dueDate: "2027-01-15",
        position: 2,
      },
      {
        number: 4,
        title: "Validación jurídica y contable de asignaciones",
        description:
          "Conformidad legal de partidas y clasificación programática definitiva.",
        status: "to-do",
        priority: "medium",
        assigneeEmail: "may.quintero@demo.agenda.local",
        startDate: "2027-01-18",
        dueDate: "2027-02-05",
        position: 3,
      },
      {
        number: 5,
        title: "Hito: Aprobación ministerial del presupuesto 2027",
        description:
          "Firma del punto de cuenta definitivo y remisión institucional.",
        status: "to-do",
        priority: "urgent",
        assigneeEmail: "gb.castillo@demo.agenda.local",
        startDate: "2027-02-18",
        dueDate: "2027-02-18",
        position: 4,
      },
    ],
    relations: [
      { sourceNumber: 1, targetNumber: 2, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 3, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 4, relationType: "subtask" },
      { sourceNumber: 1, targetNumber: 5, relationType: "subtask" },
      { sourceNumber: 2, targetNumber: 3, relationType: "blocks" },
      { sourceNumber: 3, targetNumber: 4, relationType: "blocks" },
      { sourceNumber: 4, targetNumber: 5, relationType: "blocks" },
    ],
  },
];

function parseDateUtc(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function readOrCreateQaPassword(): string {
  if (fs.existsSync(QA_CREDENTIAL_PATH)) {
    const raw = fs.readFileSync(QA_CREDENTIAL_PATH, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const pwLine = lines.find((l) => l.startsWith("password="));
    const existingPassword = pwLine
      ? pwLine.slice("password=".length).trim()
      : lines.length === 1 && !lines[0].includes("=")
        ? lines[0]
        : "";
    if (existingPassword.length >= 12) {
      fs.writeFileSync(
        QA_CREDENTIAL_PATH,
        `email=${QA_EMAIL}\npassword=${existingPassword}\n`,
        { mode: 0o600 },
      );
      fs.chmodSync(QA_CREDENTIAL_PATH, 0o600);
      return existingPassword;
    }
  }

  const generated = crypto.randomBytes(24).toString("base64url");
  fs.mkdirSync(path.dirname(QA_CREDENTIAL_PATH), { recursive: true });
  fs.writeFileSync(
    QA_CREDENTIAL_PATH,
    `email=${QA_EMAIL}\npassword=${generated}\n`,
    { mode: 0o600 },
  );
  fs.chmodSync(QA_CREDENTIAL_PATH, 0o600);
  return generated;
}

async function upsertUser(params: {
  email: string;
  name: string;
  locale: string;
  role: string;
}): Promise<{ id: string; created: boolean }> {
  const [existing] = (await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, params.email))
    .limit(1)) as Array<{ id: string }>;

  if (existing) {
    await db
      .update(schema.userTable)
      .set({
        name: params.name,
        emailVerified: true,
        image: null,
        locale: params.locale,
        role: params.role,
        emailVerificationRequired: false,
      })
      .where(eq(schema.userTable.id, existing.id));
    return { id: existing.id, created: false };
  }

  const [inserted] = (await db
    .insert(schema.userTable)
    .values({
      email: params.email,
      name: params.name,
      emailVerified: true,
      image: null,
      locale: params.locale,
      role: params.role,
      emailVerificationRequired: false,
    })
    .returning({ id: schema.userTable.id })) as Array<{ id: string }>;

  return { id: inserted.id, created: true };
}

async function upsertCredentialAccount(userId: string, passwordHash: string) {
  const [existing] = (await db
    .select({ id: schema.accountTable.id })
    .from(schema.accountTable)
    .where(
      and(
        eq(schema.accountTable.userId, userId),
        eq(schema.accountTable.providerId, "credential"),
      ),
    )
    .limit(1)) as Array<{ id: string }>;

  if (existing) {
    await db
      .update(schema.accountTable)
      .set({
        accountId: userId,
        password: passwordHash,
      })
      .where(eq(schema.accountTable.id, existing.id));
    return;
  }

  await db.insert(schema.accountTable).values({
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}

async function ensureWorkspaceMember(params: {
  workspaceId: string;
  userId: string;
  role: "owner" | "member";
  ensureAllProjectAccess?: boolean;
}): Promise<boolean> {
  const [existing] = (await db
    .select({
      id: schema.workspaceUserTable.id,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, params.workspaceId),
        eq(schema.workspaceUserTable.userId, params.userId),
      ),
    )
    .limit(1)) as Array<{ id: string; role: string }>;

  let created = false;
  if (existing) {
    if (existing.role !== params.role) {
      await db
        .update(schema.workspaceUserTable)
        .set({ role: params.role })
        .where(eq(schema.workspaceUserTable.id, existing.id));
    }
  } else {
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      role: params.role,
      joinedAt: new Date(),
    });
    created = true;
  }

  if (params.ensureAllProjectAccess) {
    const [existingAccess] = (await db
      .select({
        id: schema.workspaceMemberAccessTable.id,
        projectAccess: schema.workspaceMemberAccessTable.projectAccess,
      })
      .from(schema.workspaceMemberAccessTable)
      .where(
        and(
          eq(schema.workspaceMemberAccessTable.workspaceId, params.workspaceId),
          eq(schema.workspaceMemberAccessTable.userId, params.userId),
        ),
      )
      .limit(1)) as Array<{ id: string; projectAccess: string }>;

    if (existingAccess) {
      if (existingAccess.projectAccess !== "all") {
        await db
          .update(schema.workspaceMemberAccessTable)
          .set({ projectAccess: "all" })
          .where(eq(schema.workspaceMemberAccessTable.id, existingAccess.id));
      }
    } else {
      await db.insert(schema.workspaceMemberAccessTable).values({
        workspaceId: params.workspaceId,
        userId: params.userId,
        projectAccess: "all",
      });
    }
  }

  return created;
}

async function seedWorkspaceRoles(workspaceId: string): Promise<number> {
  const existing = (await db
    .select({ role: schema.workspaceRoleTable.role })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, workspaceId),
        inArray(
          schema.workspaceRoleTable.role,
          DEFAULT_ROLE_NAMES as unknown as string[],
        ),
      ),
    )) as Array<{ role: string }>;

  const present = new Set(existing.map((r) => r.role));
  const now = new Date();
  const rows = DEFAULT_ROLE_NAMES.filter((name) => !present.has(name)).map(
    (name) => ({
      workspaceId,
      role: name,
      permission: JSON.stringify(defaultRolePayloads[name]),
      createdAt: now,
      updatedAt: now,
    }),
  );

  if (rows.length > 0) {
    await db.insert(schema.workspaceRoleTable).values(rows);
  }
  return rows.length;
}

async function main() {
  const qaPassword = readOrCreateQaPassword();
  const qaPasswordHash = await bcrypt.hash(qaPassword, 10);

  const qaResult = await upsertUser({
    email: QA_EMAIL,
    name: QA_NAME,
    locale: "es-VE",
    role: "user",
  });
  await upsertCredentialAccount(qaResult.id, qaPasswordHash);

  const userByEmail = new Map<string, string>([[QA_EMAIL, qaResult.id]]);
  let assigneesCreated = 0;
  let assigneesUpdated = 0;

  for (const assignee of DEMO_ASSIGNEES) {
    const res = await upsertUser({
      email: assignee.email,
      name: assignee.name,
      locale: "es-VE",
      role: "user",
    });
    userByEmail.set(assignee.email, res.id);
    if (res.created) assigneesCreated++;
    else assigneesUpdated++;
  }

  const [existingWorkspace] = (await db
    .select({
      id: schema.workspaceTable.id,
      slug: schema.workspaceTable.slug,
    })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.slug, WORKSPACE_SLUG))
    .limit(1)) as Array<{ id: string; slug: string }>;

  let workspaceId: string;
  let workspaceCreated = false;
  if (existingWorkspace) {
    workspaceId = existingWorkspace.id;
    await db
      .update(schema.workspaceTable)
      .set({
        name: WORKSPACE_NAME,
        description:
          "Espacio de demostración para la gestión ministerial y seguimiento de proyectos estratégicos.",
      })
      .where(eq(schema.workspaceTable.id, workspaceId));
  } else {
    const [insertedWs] = (await db
      .insert(schema.workspaceTable)
      .values({
        name: WORKSPACE_NAME,
        slug: WORKSPACE_SLUG,
        description:
          "Espacio de demostración para la gestión ministerial y seguimiento de proyectos estratégicos.",
        createdAt: new Date(),
      })
      .returning({ id: schema.workspaceTable.id })) as Array<{ id: string }>;
    workspaceId = insertedWs.id;
    workspaceCreated = true;
  }

  const rolesSeeded = await seedWorkspaceRoles(workspaceId);

  let membersCreated = 0;
  if (
    await ensureWorkspaceMember({
      workspaceId,
      userId: qaResult.id,
      role: "owner",
      ensureAllProjectAccess: true,
    })
  ) {
    membersCreated++;
  }

  // Look up primary admin without modifying their user or account records.
  const [existingOwner] = (await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, OWNER_EXISTING_EMAIL))
    .limit(1)) as Array<{ id: string }>;

  let primaryOwnerLinked = false;
  if (existingOwner) {
    primaryOwnerLinked = true;
    if (
      await ensureWorkspaceMember({
        workspaceId,
        userId: existingOwner.id,
        role: "owner",
        ensureAllProjectAccess: true,
      })
    ) {
      membersCreated++;
    }
  }

  for (const assignee of DEMO_ASSIGNEES) {
    const uid = userByEmail.get(assignee.email)!;
    if (
      await ensureWorkspaceMember({
        workspaceId,
        userId: uid,
        role: "member",
      })
    ) {
      membersCreated++;
    }
  }

  let projectsCreated = 0;
  let projectsUpdated = 0;
  let columnsCreated = 0;
  let tasksCreated = 0;
  let tasksUpdated = 0;
  let relationsCreated = 0;
  let relationsExisting = 0;

  for (const projDef of PROJECTS) {
    const [existingProj] = (await db
      .select({
        id: schema.projectTable.id,
        lastTaskNumber: schema.projectTable.lastTaskNumber,
      })
      .from(schema.projectTable)
      .where(
        and(
          eq(schema.projectTable.workspaceId, workspaceId),
          eq(schema.projectTable.slug, projDef.slug),
        ),
      )
      .limit(1)) as Array<{ id: string; lastTaskNumber: number }>;

    const maxTaskNumber = Math.max(...projDef.tasks.map((t) => t.number));
    let projectId: string;
    if (existingProj) {
      projectId = existingProj.id;
      await db
        .update(schema.projectTable)
        .set({
          name: projDef.name,
          icon: projDef.icon,
          description: projDef.description,
          position: projDef.position,
          includeSubtasks: true,
          lastTaskNumber: Math.max(existingProj.lastTaskNumber, maxTaskNumber),
        })
        .where(eq(schema.projectTable.id, projectId));
      projectsUpdated++;
    } else {
      const [insertedProj] = (await db
        .insert(schema.projectTable)
        .values({
          workspaceId,
          slug: projDef.slug,
          name: projDef.name,
          icon: projDef.icon,
          description: projDef.description,
          position: projDef.position,
          includeSubtasks: true,
          lastTaskNumber: maxTaskNumber,
        })
        .returning({ id: schema.projectTable.id })) as Array<{ id: string }>;
      projectId = insertedProj.id;
      projectsCreated++;
    }

    const existingCols = (await db
      .select({
        id: schema.columnTable.id,
        slug: schema.columnTable.slug,
      })
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, projectId))) as Array<{
      id: string;
      slug: string;
    }>;

    const columnIdBySlug = new Map<string, string>();
    for (const col of existingCols) {
      columnIdBySlug.set(col.slug, col.id);
    }

    for (const colDef of STANDARD_COLUMNS) {
      const existingColId = columnIdBySlug.get(colDef.slug);
      if (existingColId) {
        await db
          .update(schema.columnTable)
          .set({
            name: colDef.name,
            position: colDef.position,
            isFinal: colDef.isFinal,
          })
          .where(eq(schema.columnTable.id, existingColId));
      } else {
        const [insertedCol] = (await db
          .insert(schema.columnTable)
          .values({
            projectId,
            name: colDef.name,
            slug: colDef.slug,
            position: colDef.position,
            isFinal: colDef.isFinal,
          })
          .returning({ id: schema.columnTable.id })) as Array<{ id: string }>;
        columnIdBySlug.set(colDef.slug, insertedCol.id);
        columnsCreated++;
      }
    }

    const taskIdByNumber = new Map<number, string>();
    for (const taskDef of projDef.tasks) {
      const columnId = columnIdBySlug.get(taskDef.status)!;
      const assigneeId = userByEmail.get(taskDef.assigneeEmail) ?? null;
      const startDate = parseDateUtc(taskDef.startDate);
      const dueDate = parseDateUtc(taskDef.dueDate);

      const [existingTask] = (await db
        .select({ id: schema.taskTable.id })
        .from(schema.taskTable)
        .where(
          and(
            eq(schema.taskTable.projectId, projectId),
            eq(schema.taskTable.number, taskDef.number),
          ),
        )
        .limit(1)) as Array<{ id: string }>;

      if (existingTask) {
        await db
          .update(schema.taskTable)
          .set({
            title: taskDef.title,
            description: taskDef.description,
            status: taskDef.status,
            columnId,
            priority: taskDef.priority,
            userId: assigneeId,
            startDate,
            dueDate,
            position: taskDef.position,
          })
          .where(eq(schema.taskTable.id, existingTask.id));
        taskIdByNumber.set(taskDef.number, existingTask.id);
        tasksUpdated++;
      } else {
        const [insertedTask] = (await db
          .insert(schema.taskTable)
          .values({
            projectId,
            number: taskDef.number,
            title: taskDef.title,
            description: taskDef.description,
            status: taskDef.status,
            columnId,
            priority: taskDef.priority,
            userId: assigneeId,
            startDate,
            dueDate,
            position: taskDef.position,
          })
          .returning({ id: schema.taskTable.id })) as Array<{ id: string }>;
        taskIdByNumber.set(taskDef.number, insertedTask.id);
        tasksCreated++;
      }
    }

    for (const relDef of projDef.relations) {
      const sourceTaskId = taskIdByNumber.get(relDef.sourceNumber)!;
      const targetTaskId = taskIdByNumber.get(relDef.targetNumber)!;

      const [existingRel] = (await db
        .select({ id: schema.taskRelationTable.id })
        .from(schema.taskRelationTable)
        .where(
          and(
            eq(schema.taskRelationTable.relationType, relDef.relationType),
            or(
              and(
                eq(schema.taskRelationTable.sourceTaskId, sourceTaskId),
                eq(schema.taskRelationTable.targetTaskId, targetTaskId),
              ),
              and(
                eq(schema.taskRelationTable.sourceTaskId, targetTaskId),
                eq(schema.taskRelationTable.targetTaskId, sourceTaskId),
              ),
            ),
          ),
        )
        .limit(1)) as Array<{ id: string }>;

      if (existingRel) {
        relationsExisting++;
      } else {
        await db.insert(schema.taskRelationTable).values({
          sourceTaskId,
          targetTaskId,
          relationType: relDef.relationType,
        });
        relationsCreated++;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        qaUser: {
          email: QA_EMAIL,
          created: qaResult.created,
          credentialFile: QA_CREDENTIAL_PATH,
        },
        assignees: {
          total: DEMO_ASSIGNEES.length,
          created: assigneesCreated,
          updated: assigneesUpdated,
        },
        workspace: {
          slug: WORKSPACE_SLUG,
          name: WORKSPACE_NAME,
          id: workspaceId,
          created: workspaceCreated,
          rolesSeeded,
          membersCreated,
          primaryOwnerLinked,
        },
        projects: {
          total: PROJECTS.length,
          created: projectsCreated,
          updated: projectsUpdated,
          columnsCreated,
        },
        tasks: {
          total: PROJECTS.reduce((acc, p) => acc + p.tasks.length, 0),
          created: tasksCreated,
          updated: tasksUpdated,
        },
        relations: {
          total: PROJECTS.reduce((acc, p) => acc + p.relations.length, 0),
          created: relationsCreated,
          existing: relationsExisting,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getDatabasePool().end();
  });

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  canApproveOrdersInWorkspace,
  canViewConfidentialInWorkspace,
  taskConfidentialitySqlFilter,
} from "../confidentiality/access";
import db from "../database";
import {
  columnTable,
  militarPerfilTable,
  projectTable,
  taskTable,
  userTable,
} from "../database/schema";
import { abreviarGrado, shortDisplayName } from "../executive/rank-abbrev";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { isRestrictedResponsable } from "../utils/is-restricted-responsable";

const CARACAS_TIMEZONE = "America/Caracas";
const CARACAS_OFFSET = "-04:00";
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ITEMS_PER_CATEGORY = 8;
const LLM_TIMEOUT_MS = 12_000;

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  "no-priority": 0,
};

export type DailyBriefMotor = "ollama" | "determinista";

export type DailyBriefItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  number: number | null;
  title: string;
  priority: string;
  dueDate: Date | null;
  isOrder: boolean;
  orderFolio: string | null;
  orderClosureStatus: string;
  confidentialityLevel: string;
};

export type DailyBriefCounters = {
  venceHoy: number;
  vencidas: number;
  ordenesNuevas: number;
  agendaDia: number;
  pendientesVistoBueno: number;
};

export type DailyBriefItems = {
  venceHoy: DailyBriefItem[];
  vencidas: DailyBriefItem[];
  ordenesNuevas: DailyBriefItem[];
  agendaDia: DailyBriefItem[];
  pendientesVistoBueno: DailyBriefItem[];
};

export type DailyBriefSummaryInput = {
  fechaLarga?: string;
  saludo?: string;
  contadores: DailyBriefCounters;
  items?: Partial<DailyBriefItems>;
};

export type DailyBrief = {
  dateKey: string;
  fechaLarga: string;
  saludo: string;
  motorUsado: DailyBriefMotor;
  parrafoEjecutivo: string;
  contadores: DailyBriefCounters;
  items: DailyBriefItems;
};

type CacheEntry = {
  expiresAt: number;
  data: DailyBrief;
};

const briefCache = new Map<string, CacheEntry>();

const caracasDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARACAS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const caracasLongFormatter = new Intl.DateTimeFormat("es-VE", {
  timeZone: CARACAS_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const caracasHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CARACAS_TIMEZONE,
  hour: "numeric",
  hour12: false,
});

export function getCaracasDateKey(date: Date = new Date()): string {
  return caracasDateFormatter.format(date);
}

export function formatCaracasLong(date: Date = new Date()): string {
  const formatted = caracasLongFormatter.format(date);
  return formatted.charAt(0).toLocaleUpperCase("es-VE") + formatted.slice(1);
}

function getCaracasGreeting(date: Date = new Date()): string {
  const hour = Number.parseInt(caracasHourFormatter.format(date), 10);
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function priorityScore(priority: string | null | undefined): number {
  return PRIORITY_WEIGHT[priority ?? "no-priority"] ?? 0;
}

function sortByPriorityAndDueDate(
  a: DailyBriefItem,
  b: DailyBriefItem,
): number {
  const pDiff = priorityScore(b.priority) - priorityScore(a.priority);
  if (pDiff !== 0) return pDiff;
  if (a.dueDate && b.dueDate) {
    return a.dueDate.getTime() - b.dueDate.getTime();
  }
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.title.localeCompare(b.title, "es-VE");
}

function pruneExpiredCache(nowMs: number) {
  for (const [key, entry] of briefCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      briefCache.delete(key);
    }
  }
}

export function clearDailyBriefCache(): void {
  briefCache.clear();
}

export function buildDeterministicBriefParagraph(
  summary: DailyBriefSummaryInput,
): string {
  const { venceHoy, vencidas, ordenesNuevas, agendaDia, pendientesVistoBueno } =
    summary.contadores;

  const total =
    venceHoy + vencidas + ordenesNuevas + agendaDia + pendientesVistoBueno;

  if (total === 0) {
    return "Sin novedades pendientes para la jornada de hoy; no se registran tareas vencidas, compromisos que venzan hoy ni órdenes por revisar.";
  }

  const segmentos: string[] = [];

  if (vencidas > 0) {
    segmentos.push(
      `${vencidas} ${pluralize(vencidas, "tarea vencida", "tareas vencidas")} que ${pluralize(vencidas, "requiere", "requieren")} atención prioritaria`,
    );
  }

  if (venceHoy > 0) {
    segmentos.push(
      `${venceHoy} ${pluralize(venceHoy, "compromiso que vence hoy", "compromisos que vencen hoy")}`,
    );
  }

  if (agendaDia > 0) {
    segmentos.push(
      `${agendaDia} ${pluralize(agendaDia, "actividad en la agenda del día", "actividades en la agenda del día")}`,
    );
  }

  if (ordenesNuevas > 0) {
    segmentos.push(
      `${ordenesNuevas} ${pluralize(ordenesNuevas, "orden nueva emitida en las últimas 24 horas", "órdenes nuevas emitidas en las últimas 24 horas")}`,
    );
  }

  if (pendientesVistoBueno > 0) {
    segmentos.push(
      `${pendientesVistoBueno} ${pluralize(pendientesVistoBueno, "orden pendiente de visto bueno", "órdenes pendientes de visto bueno")}`,
    );
  }

  let body: string;
  if (segmentos.length === 1) {
    body = `Para la jornada de hoy se registra ${segmentos[0]}.`;
  } else {
    const last = segmentos.pop();
    body = `Para la jornada de hoy se registran ${segmentos.join(", ")} y ${last}.`;
  }

  const destacado =
    summary.items?.vencidas?.[0] ??
    summary.items?.venceHoy?.[0] ??
    summary.items?.pendientesVistoBueno?.[0] ??
    summary.items?.ordenesNuevas?.[0] ??
    summary.items?.agendaDia?.[0];

  if (destacado) {
    const ref = destacado.orderFolio
      ? `${destacado.orderFolio}: `
      : destacado.number != null
        ? `${destacado.projectSlug}-${destacado.number}: `
        : "";
    return `${body} Punto focal: ${ref}«${destacado.title}».`;
  }

  return body;
}

function buildLlmPromptContext(summary: DailyBriefSummaryInput): string {
  const { contadores, items } = summary;
  const formatSample = (list?: DailyBriefItem[]) =>
    (list ?? [])
      .slice(0, 3)
      .map((item) => {
        const ref =
          item.orderFolio ?? `${item.projectSlug}-${item.number ?? 0}`;
        return `[${ref}] ${item.title} (prioridad: ${item.priority})`;
      })
      .join("; ");

  return [
    `Fecha: ${summary.fechaLarga ?? formatCaracasLong()}`,
    `Vencidas: ${contadores.vencidas}${items?.vencidas?.length ? ` -> ${formatSample(items.vencidas)}` : ""}`,
    `Vencen hoy: ${contadores.venceHoy}${items?.venceHoy?.length ? ` -> ${formatSample(items.venceHoy)}` : ""}`,
    `Órdenes nuevas (24h): ${contadores.ordenesNuevas}${items?.ordenesNuevas?.length ? ` -> ${formatSample(items.ordenesNuevas)}` : ""}`,
    `Agenda del día: ${contadores.agendaDia}${items?.agendaDia?.length ? ` -> ${formatSample(items.agendaDia)}` : ""}`,
    `Pendientes de visto bueno: ${contadores.pendientesVistoBueno}${items?.pendientesVistoBueno?.length ? ` -> ${formatSample(items.pendientesVistoBueno)}` : ""}`,
  ].join("\n");
}

function cleanLlmParagraph(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^["«“]+|["»”]+$/g, "")
    .trim();
}

export async function generateExecutiveParagraphWithLlm(
  summary: DailyBriefSummaryInput,
): Promise<{ paragraph: string; motorUsado: DailyBriefMotor }> {
  const baseUrl = (
    process.env.AGENDA_LLM_URL || "http://127.0.0.1:11434"
  ).replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/api/chat")
    ? baseUrl
    : `${baseUrl}/api/chat`;
  const model = process.env.AGENDA_LLM_MODEL || "qwen3:8b";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          {
            role: "system",
            content:
              "Eres el asistente ejecutivo de un despacho ministerial en Venezuela. Redacta un resumen breve de 2 a 3 oraciones claras y sobrias en español de Venezuela con los datos suministrados. No inventes cifras, nombres, folios ni tareas que no figuren en el contexto. Responde únicamente con el párrafo final sin títulos ni viñetas.",
          },
          {
            role: "user",
            content: `Redacta el parte ejecutivo del día con estos datos exactos:\n${buildLlmPromptContext(summary)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
      response?: string;
    };
    const rawContent = payload.message?.content ?? payload.response ?? "";
    const cleaned = cleanLlmParagraph(rawContent);

    if (!cleaned) {
      throw new Error("Respuesta vacía del modelo");
    }

    return {
      paragraph: cleaned,
      motorUsado: "ollama",
    };
  } catch {
    return {
      paragraph: buildDeterministicBriefParagraph(summary),
      motorUsado: "determinista",
    };
  }
}

export async function generateDailyBriefForUser(
  workspaceId: string,
  userId: string,
  options?: { useLlm?: boolean; refresh?: boolean; now?: Date },
): Promise<DailyBrief> {
  const now = options?.now ?? new Date();
  const useLlm = options?.useLlm ?? false;
  const refresh = options?.refresh ?? false;
  const dateKey = getCaracasDateKey(now);
  const cacheKey = `${workspaceId}:${userId}:${dateKey}:${useLlm ? 1 : 0}`;
  const nowMs = Date.now();

  if (!refresh) {
    const cached = briefCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return cached.data;
    }
  }

  const [
    restrictedResponsable,
    canViewConfidential,
    canApprove,
    [userRow],
    accessibleProjects,
  ] = await Promise.all([
    isRestrictedResponsable(userId, workspaceId),
    canViewConfidentialInWorkspace(userId, workspaceId),
    canApproveOrdersInWorkspace(userId, workspaceId),
    db
      .select({
        name: userTable.name,
        grado: militarPerfilTable.grado,
        componente: militarPerfilTable.componente,
        unidad: militarPerfilTable.unidad,
      })
      .from(userTable)
      .leftJoin(militarPerfilTable, eq(userTable.id, militarPerfilTable.userId))
      .where(eq(userTable.id, userId))
      .limit(1),
    db
      .select({
        id: projectTable.id,
        name: projectTable.name,
        slug: projectTable.slug,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
          projectAccessCondition(userId, projectTable.id),
        ),
      ),
  ]);

  const greetingPrefix = getCaracasGreeting(now);
  const shortName = shortDisplayName(userRow?.name);
  const shortRank = abreviarGrado(
    userRow?.grado,
    userRow?.componente,
    userRow?.unidad,
  );
  const displayPerson = [shortRank, shortName].filter(Boolean).join(" ").trim();
  const saludo = displayPerson
    ? `${greetingPrefix}, ${displayPerson}`
    : greetingPrefix;
  const fechaLarga = formatCaracasLong(now);

  const emptyItems: DailyBriefItems = {
    venceHoy: [],
    vencidas: [],
    ordenesNuevas: [],
    agendaDia: [],
    pendientesVistoBueno: [],
  };
  const emptyCounters: DailyBriefCounters = {
    venceHoy: 0,
    vencidas: 0,
    ordenesNuevas: 0,
    agendaDia: 0,
    pendientesVistoBueno: 0,
  };

  if (accessibleProjects.length === 0) {
    const baseSummary: DailyBriefSummaryInput = {
      fechaLarga,
      saludo,
      contadores: emptyCounters,
      items: emptyItems,
    };
    const paragraphResult = useLlm
      ? await generateExecutiveParagraphWithLlm(baseSummary)
      : {
          paragraph: buildDeterministicBriefParagraph(baseSummary),
          motorUsado: "determinista" as const,
        };

    const result: DailyBrief = {
      dateKey,
      fechaLarga,
      saludo,
      motorUsado: paragraphResult.motorUsado,
      parrafoEjecutivo: paragraphResult.paragraph,
      contadores: emptyCounters,
      items: emptyItems,
    };

    pruneExpiredCache(nowMs);
    briefCache.set(cacheKey, { expiresAt: nowMs + CACHE_TTL_MS, data: result });
    return result;
  }

  const projectIds = accessibleProjects.map((project) => project.id);
  const projectById = new Map(
    accessibleProjects.map((project) => [project.id, project]),
  );

  const taskConditions = [
    inArray(taskTable.projectId, projectIds),
    ne(taskTable.status, "archived"),
  ];
  if (restrictedResponsable) {
    taskConditions.push(eq(taskTable.userId, userId));
  }
  const confidentialityFilter = taskConfidentialitySqlFilter(
    userId,
    canViewConfidential,
  );
  if (confidentialityFilter) {
    taskConditions.push(confidentialityFilter);
  }

  const [columns, rawTasks] = await Promise.all([
    db
      .select({
        id: columnTable.id,
        projectId: columnTable.projectId,
        slug: columnTable.slug,
        isFinal: columnTable.isFinal,
      })
      .from(columnTable)
      .where(inArray(columnTable.projectId, projectIds)),
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        columnId: taskTable.columnId,
        priority: taskTable.priority,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        createdAt: taskTable.createdAt,
        isOrder: taskTable.isOrder,
        orderFolio: taskTable.orderFolio,
        orderClosureStatus: taskTable.orderClosureStatus,
        confidentialityLevel: taskTable.confidentialityLevel,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(and(...taskConditions)),
  ]);

  const columnById = new Map(columns.map((column) => [column.id, column]));
  const columnByProjectSlug = new Map<string, (typeof columns)[number]>();
  for (const column of columns) {
    const key = `${column.projectId}::${column.slug}`;
    if (!columnByProjectSlug.has(key)) {
      columnByProjectSlug.set(key, column);
    }
  }

  const inicioHoyCaracas = new Date(`${dateKey}T00:00:00${CARACAS_OFFSET}`);
  const finHoyCaracas = new Date(inicioHoyCaracas.getTime() + DAY_MS);
  const hace24h = new Date(now.getTime() - DAY_MS);

  const isTodayCaracas = (date: Date | null) =>
    date !== null && date >= inicioHoyCaracas && date < finHoyCaracas;

  const venceHoyAll: DailyBriefItem[] = [];
  const vencidasAll: DailyBriefItem[] = [];
  const ordenesNuevasAll: Array<{ item: DailyBriefItem; createdAt: Date }> = [];
  const agendaDiaAll: DailyBriefItem[] = [];
  const pendientesVistoBuenoAll: DailyBriefItem[] = [];

  for (const task of rawTasks) {
    const column =
      (task.columnId ? columnById.get(task.columnId) : undefined) ??
      columnByProjectSlug.get(`${task.projectId}::${task.status}`);
    const isCompleted = column
      ? column.isFinal
      : task.status === "done" || task.status === "completed";

    if (isCompleted) continue;

    const project = projectById.get(task.projectId);
    const item: DailyBriefItem = {
      id: task.id,
      projectId: task.projectId,
      projectName: project?.name ?? "Proyecto",
      projectSlug: project?.slug ?? "PRJ",
      number: task.number,
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
      isOrder: task.isOrder,
      orderFolio: task.orderFolio,
      orderClosureStatus: task.orderClosureStatus,
      confidentialityLevel: task.confidentialityLevel,
    };

    if (task.dueDate) {
      if (task.dueDate < inicioHoyCaracas) {
        vencidasAll.push(item);
      } else if (task.dueDate < finHoyCaracas) {
        venceHoyAll.push(item);
      }
    }

    if (task.isOrder && task.createdAt >= hace24h) {
      ordenesNuevasAll.push({ item, createdAt: task.createdAt });
    }

    if (isTodayCaracas(task.dueDate) || isTodayCaracas(task.startDate)) {
      agendaDiaAll.push(item);
    }

    if (
      canApprove &&
      task.isOrder &&
      task.orderClosureStatus === "en_revision"
    ) {
      pendientesVistoBuenoAll.push(item);
    }
  }

  venceHoyAll.sort(sortByPriorityAndDueDate);
  vencidasAll.sort(sortByPriorityAndDueDate);
  ordenesNuevasAll.sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return sortByPriorityAndDueDate(a.item, b.item);
  });
  agendaDiaAll.sort(sortByPriorityAndDueDate);
  pendientesVistoBuenoAll.sort(sortByPriorityAndDueDate);

  const contadores: DailyBriefCounters = {
    venceHoy: venceHoyAll.length,
    vencidas: vencidasAll.length,
    ordenesNuevas: ordenesNuevasAll.length,
    agendaDia: agendaDiaAll.length,
    pendientesVistoBueno: pendientesVistoBuenoAll.length,
  };

  const items: DailyBriefItems = {
    venceHoy: venceHoyAll.slice(0, MAX_ITEMS_PER_CATEGORY),
    vencidas: vencidasAll.slice(0, MAX_ITEMS_PER_CATEGORY),
    ordenesNuevas: ordenesNuevasAll
      .slice(0, MAX_ITEMS_PER_CATEGORY)
      .map((entry) => entry.item),
    agendaDia: agendaDiaAll.slice(0, MAX_ITEMS_PER_CATEGORY),
    pendientesVistoBueno: pendientesVistoBuenoAll.slice(
      0,
      MAX_ITEMS_PER_CATEGORY,
    ),
  };

  const summaryInput: DailyBriefSummaryInput = {
    fechaLarga,
    saludo,
    contadores,
    items,
  };

  const paragraphResult = useLlm
    ? await generateExecutiveParagraphWithLlm(summaryInput)
    : {
        paragraph: buildDeterministicBriefParagraph(summaryInput),
        motorUsado: "determinista" as const,
      };

  const result: DailyBrief = {
    dateKey,
    fechaLarga,
    saludo,
    motorUsado: paragraphResult.motorUsado,
    parrafoEjecutivo: paragraphResult.paragraph,
    contadores,
    items,
  };

  pruneExpiredCache(nowMs);
  briefCache.set(cacheKey, { expiresAt: nowMs + CACHE_TTL_MS, data: result });
  return result;
}

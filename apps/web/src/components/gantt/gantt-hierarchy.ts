import { differenceInCalendarDays, startOfDay } from "date-fns";
import { isTaskCompleted } from "@/lib/due-date-status";
import type Task from "@/types/task";

export type GanttTaskLike = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

export type GanttRelation = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
};

export type GanttColumnMeta = {
  slug?: string;
  isFinal?: boolean;
};

export type GanttRow<T extends GanttTaskLike = GanttTaskLike> = {
  task: T;
  wbs: string;
  depth: number;
  groupIndex: number;
  parentId: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
  isSummary: boolean;
  isMilestone: boolean;
  scheduleStart: Date;
  scheduleEnd: Date;
  durationDays: number;
  isCompleted: boolean;
  isOverdue: boolean;
  progressPercent: number;
  descendantCount: number;
  completedDescendantCount: number;
};

export type GanttHierarchyResult<T extends GanttTaskLike = GanttTaskLike> = {
  allRows: GanttRow<T>[];
  visibleRows: GanttRow<T>[];
  parentIds: Set<string>;
};

type TreeNode<T extends GanttTaskLike> = {
  task: T;
  children: TreeNode<T>[];
  parentId: string | null;
};

function compareGanttTasks<T extends GanttTaskLike>(a: T, b: T): number {
  const hasPosA = typeof a.position === "number";
  const hasPosB = typeof b.position === "number";
  if (hasPosA && hasPosB && a.position !== b.position) {
    return (a.position as number) - (b.position as number);
  }

  const startDiff = a.scheduleStart.getTime() - b.scheduleStart.getTime();
  if (startDiff !== 0) return startDiff;

  const hasNumA = typeof a.number === "number";
  const hasNumB = typeof b.number === "number";
  if (hasNumA && hasNumB && a.number !== b.number) {
    return (a.number as number) - (b.number as number);
  }

  return a.title.localeCompare(b.title);
}

function createsCycle(
  parentId: string,
  childId: string,
  parentMap: Map<string, string>,
): boolean {
  let cursor: string | undefined = parentId;
  const visited = new Set<string>([childId]);
  while (cursor) {
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parentMap.get(cursor);
  }
  return false;
}

function isMilestoneTask(task: GanttTaskLike, hasChildren: boolean): boolean {
  if (hasChildren) return false;
  const spanDays = differenceInCalendarDays(
    startOfDay(task.scheduleEnd),
    startOfDay(task.scheduleStart),
  );
  if (spanDays === 0) return true;
  return spanDays <= 1 && /\bhito\b/i.test(task.title);
}

/**
 * Construye el árbol jerárquico del Gantt a partir de las tareas planificadas
 * y sus relaciones `subtask`, calculando numeración EDT (WBS), fechas
 * agregadas de padres, hitos, estado de vencimiento y filas visibles según
 * los nodos contraídos.
 */
export function buildGanttHierarchy<T extends GanttTaskLike>(
  tasks: T[],
  relations: GanttRelation[] = [],
  columns: GanttColumnMeta[] = [],
  collapsedIds: ReadonlySet<string> = new Set(),
  today: Date = new Date(),
): GanttHierarchyResult<T> {
  if (tasks.length === 0) {
    return { allRows: [], visibleRows: [], parentIds: new Set() };
  }

  const completionColumns = columns.filter(
    (col): col is { slug: string; isFinal: boolean } =>
      typeof col.slug === "string" && typeof col.isFinal === "boolean",
  );
  const resolvedColumns =
    completionColumns.length > 0 ? completionColumns : undefined;
  const todayStart = startOfDay(today);

  const nodeById = new Map<string, TreeNode<T>>();
  for (const task of tasks) {
    nodeById.set(task.id, {
      task,
      children: [],
      parentId: null,
    });
  }

  const parentByChild = new Map<string, string>();
  for (const rel of relations) {
    if (rel.relationType !== "subtask") continue;
    const parentId = rel.sourceTaskId;
    const childId = rel.targetTaskId;
    if (parentId === childId) continue;
    if (!nodeById.has(parentId) || !nodeById.has(childId)) continue;
    if (parentByChild.has(childId)) continue;
    if (createsCycle(parentId, childId, parentByChild)) continue;
    parentByChild.set(childId, parentId);
  }

  const roots: TreeNode<T>[] = [];
  for (const task of tasks) {
    const node = nodeById.get(task.id);
    if (!node) continue;
    const parentId = parentByChild.get(task.id) ?? null;
    node.parentId = parentId;
    if (parentId) {
      nodeById.get(parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes: TreeNode<T>[]) => {
    nodes.sort((left, right) => compareGanttTasks(left.task, right.task));
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortTree(node.children);
      }
    }
  };
  sortTree(roots);

  const allRows: GanttRow<T>[] = [];
  const visibleRows: GanttRow<T>[] = [];
  const parentIds = new Set<string>();

  type ComputedSummary = {
    scheduleStart: Date;
    scheduleEnd: Date;
    leafCount: number;
    completedLeafCount: number;
    allChildrenCompleted: boolean;
  };

  const computeNode = (node: TreeNode<T>): ComputedSummary => {
    const ownCompleted = isTaskCompleted(node.task.status, resolvedColumns);
    if (node.children.length === 0) {
      return {
        scheduleStart: node.task.scheduleStart,
        scheduleEnd: node.task.scheduleEnd,
        leafCount: 1,
        completedLeafCount: ownCompleted ? 1 : 0,
        allChildrenCompleted: ownCompleted,
      };
    }

    let minStart = node.task.scheduleStart;
    let maxEnd = node.task.scheduleEnd;
    let leafCount = 0;
    let completedLeafCount = 0;
    let allChildrenCompleted = true;

    for (const child of node.children) {
      const childSummary = computeNode(child);
      if (childSummary.scheduleStart < minStart) {
        minStart = childSummary.scheduleStart;
      }
      if (childSummary.scheduleEnd > maxEnd) {
        maxEnd = childSummary.scheduleEnd;
      }
      leafCount += childSummary.leafCount;
      completedLeafCount += childSummary.completedLeafCount;
      if (!childSummary.allChildrenCompleted) {
        allChildrenCompleted = false;
      }
    }

    return {
      scheduleStart: minStart,
      scheduleEnd: maxEnd,
      leafCount,
      completedLeafCount,
      allChildrenCompleted,
    };
  };

  const visit = (
    node: TreeNode<T>,
    wbs: string,
    depth: number,
    groupIndex: number,
    ancestorsCollapsed: boolean,
  ) => {
    const hasChildren = node.children.length > 0;
    if (hasChildren) {
      parentIds.add(node.task.id);
    }
    const isExpanded = !collapsedIds.has(node.task.id);
    const summary = computeNode(node);
    const ownCompleted = isTaskCompleted(node.task.status, resolvedColumns);
    const isCompleted = hasChildren
      ? ownCompleted ||
        (summary.leafCount > 0 &&
          summary.completedLeafCount === summary.leafCount)
      : ownCompleted;
    const isMilestone = isMilestoneTask(node.task, hasChildren);
    const rawSpan = differenceInCalendarDays(
      startOfDay(summary.scheduleEnd),
      startOfDay(summary.scheduleStart),
    );
    const durationDays = isMilestone ? 0 : Math.max(1, rawSpan + 1);
    const isOverdue =
      !isCompleted && startOfDay(summary.scheduleEnd) < todayStart;
    const progressPercent = hasChildren
      ? summary.leafCount > 0
        ? Math.round((summary.completedLeafCount / summary.leafCount) * 100)
        : 0
      : isCompleted
        ? 100
        : 0;

    const row: GanttRow<T> = {
      task: node.task,
      wbs,
      depth,
      groupIndex,
      parentId: node.parentId,
      hasChildren,
      isExpanded,
      isSummary: hasChildren,
      isMilestone,
      scheduleStart: summary.scheduleStart,
      scheduleEnd: summary.scheduleEnd,
      durationDays,
      isCompleted,
      isOverdue,
      progressPercent,
      descendantCount: hasChildren ? summary.leafCount : 0,
      completedDescendantCount: hasChildren ? summary.completedLeafCount : 0,
    };

    allRows.push(row);
    if (!ancestorsCollapsed) {
      visibleRows.push(row);
    }

    const hideChildren = ancestorsCollapsed || !isExpanded;
    node.children.forEach((child, index) => {
      visit(child, `${wbs}.${index + 1}`, depth + 1, groupIndex, hideChildren);
    });
  };

  roots.forEach((root, index) => {
    visit(root, String(index + 1), 0, index, false);
  });

  return { allRows, visibleRows, parentIds };
}

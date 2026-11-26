import { parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import {
  buildGanttHierarchy,
  type GanttRelation,
  type GanttTaskLike,
} from "./gantt-hierarchy";

function makeTask(
  id: string,
  overrides: Partial<Task> & { scheduleStart: string; scheduleEnd: string },
): GanttTaskLike {
  const { scheduleStart, scheduleEnd, ...rest } = overrides;
  return {
    id,
    title: id,
    number: 1,
    description: null,
    status: "in-progress",
    priority: "medium",
    startDate: scheduleStart,
    dueDate: scheduleEnd,
    position: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "proj-1",
    scheduleStart: parseISO(scheduleStart),
    scheduleEnd: parseISO(scheduleEnd),
    ...rest,
  };
}

describe("buildGanttHierarchy", () => {
  it("builds WBS numbering, rolls up parent dates and progress, and detects milestones", () => {
    const tasks = [
      makeTask("p1", {
        title: "Fase 1",
        position: 1,
        scheduleStart: "2026-12-05",
        scheduleEnd: "2026-12-10",
      }),
      makeTask("c1", {
        title: "Subtarea A",
        position: 1,
        status: "done",
        scheduleStart: "2026-12-01",
        scheduleEnd: "2026-12-14",
      }),
      makeTask("c2", {
        title: "Hito firma",
        position: 2,
        status: "in-progress",
        scheduleStart: "2026-12-20",
        scheduleEnd: "2026-12-20",
      }),
      makeTask("p2", {
        title: "Fase 2",
        position: 2,
        scheduleStart: "2026-12-22",
        scheduleEnd: "2026-12-28",
      }),
    ];
    const relations: GanttRelation[] = [
      {
        id: "r1",
        sourceTaskId: "p1",
        targetTaskId: "c1",
        relationType: "subtask",
      },
      {
        id: "r2",
        sourceTaskId: "p1",
        targetTaskId: "c2",
        relationType: "subtask",
      },
    ];

    const result = buildGanttHierarchy(
      tasks,
      relations,
      [
        { slug: "in-progress", isFinal: false },
        { slug: "done", isFinal: true },
      ],
      new Set(),
      parseISO("2026-12-15"),
    );

    expect(
      result.visibleRows.map((r) => [r.wbs, r.task.id, r.groupIndex]),
    ).toEqual([
      ["1", "p1", 0],
      ["1.1", "c1", 0],
      ["1.2", "c2", 0],
      ["2", "p2", 1],
    ]);

    const p1 = result.visibleRows[0];
    expect(p1.isSummary).toBe(true);
    expect(p1.scheduleStart).toEqual(parseISO("2026-12-01"));
    expect(p1.scheduleEnd).toEqual(parseISO("2026-12-20"));
    expect(p1.durationDays).toBe(20);
    expect(p1.progressPercent).toBe(50);

    const c1 = result.visibleRows[1];
    expect(c1.isCompleted).toBe(true);
    expect(c1.isOverdue).toBe(false);
    expect(c1.durationDays).toBe(14);

    const c2 = result.visibleRows[2];
    expect(c2.isMilestone).toBe(true);
    expect(c2.durationDays).toBe(0);
    expect(c2.isOverdue).toBe(false);

    expect(result.parentIds).toEqual(new Set(["p1"]));
  });

  it("handles cycles safely and filters collapsed descendants while keeping parent summary", () => {
    const tasks = [
      makeTask("a", { scheduleStart: "2026-12-01", scheduleEnd: "2026-12-05" }),
      makeTask("b", { scheduleStart: "2026-12-03", scheduleEnd: "2026-12-10" }),
    ];
    const relations: GanttRelation[] = [
      {
        id: "r1",
        sourceTaskId: "a",
        targetTaskId: "b",
        relationType: "subtask",
      },
      {
        id: "r2",
        sourceTaskId: "b",
        targetTaskId: "a",
        relationType: "subtask",
      },
    ];

    const result = buildGanttHierarchy(
      tasks,
      relations,
      [],
      new Set(["a"]),
      parseISO("2026-12-20"),
    );

    expect(result.allRows.map((r) => r.wbs)).toEqual(["1", "1.1"]);
    expect(result.visibleRows.map((r) => r.task.id)).toEqual(["a"]);
    expect(result.visibleRows[0].isExpanded).toBe(false);
    expect(result.visibleRows[0].scheduleEnd).toEqual(parseISO("2026-12-10"));
    expect(result.visibleRows[0].isOverdue).toBe(true);
  });
});

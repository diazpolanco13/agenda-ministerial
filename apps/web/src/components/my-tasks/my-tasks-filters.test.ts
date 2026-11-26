import { describe, expect, it } from "vite-plus/test";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import {
  classifyTaskSegment,
  computeSegmentCounts,
  DEFAULT_MY_TASKS_FILTERS,
  filterMyTasks,
  groupMyTasks,
} from "./my-tasks-filters";

function makeTask(overrides: Partial<AssignedTask> = {}): AssignedTask {
  return {
    id: "t1",
    projectId: "p1",
    workspaceId: "w1",
    workspaceName: "Despacho",
    number: 1,
    title: "Revisar oficio",
    status: "to-do",
    columnId: "c1",
    position: 0,
    statusName: "Por hacer",
    statusIcon: null,
    isFinal: false,
    priority: "medium",
    startDate: null,
    dueDate: null,
    createdAt: "2026-11-20T12:00:00.000Z",
    updatedAt: "2026-11-25T12:00:00.000Z",
    userId: "u1",
    assigneeName: "Carlos",
    assigneeImage: null,
    projectName: "Operaciones",
    projectSlug: "OP",
    projectIcon: null,
    labels: [],
    ...overrides,
  };
}

const NOW = new Date("2026-11-26T12:00:00.000Z");

describe("my-tasks-filters", () => {
  it("classifies overdue, today, thisWeek, upcoming, noDueDate, and completedRecent", () => {
    expect(
      classifyTaskSegment(makeTask({ dueDate: "2026-11-25T12:00:00.000Z" }), NOW),
    ).toBe("overdue");
    expect(
      classifyTaskSegment(makeTask({ dueDate: "2026-11-26T18:00:00.000Z" }), NOW),
    ).toBe("today");
    expect(
      classifyTaskSegment(makeTask({ dueDate: "2026-11-29T12:00:00.000Z" }), NOW),
    ).toBe("thisWeek");
    expect(
      classifyTaskSegment(makeTask({ dueDate: "2026-12-10T12:00:00.000Z" }), NOW),
    ).toBe("upcoming");
    expect(classifyTaskSegment(makeTask({ dueDate: null }), NOW)).toBe(
      "noDueDate",
    );
    expect(
      classifyTaskSegment(
        makeTask({ dueDate: "2026-11-20T12:00:00.000Z", isFinal: true }),
        NOW,
      ),
    ).toBe("completedRecent");
  });

  it("computes segment counts excluding completed from active total", () => {
    const tasks = [
      makeTask({ id: "1", dueDate: "2026-11-24T12:00:00.000Z" }),
      makeTask({ id: "2", dueDate: "2026-11-26T12:00:00.000Z" }),
      makeTask({ id: "3", dueDate: null }),
      makeTask({ id: "4", isFinal: true }),
    ];
    const counts = computeSegmentCounts(tasks, NOW);
    expect(counts.all).toBe(3);
    expect(counts.overdue).toBe(1);
    expect(counts.today).toBe(1);
    expect(counts.noDueDate).toBe(1);
    expect(counts.completedRecent).toBe(1);
  });

  it("filters by search, priority, project, and segment", () => {
    const tasks = [
      makeTask({
        id: "1",
        title: "Preparar minuta",
        priority: "urgent",
        projectId: "p1",
        dueDate: "2026-11-25T12:00:00.000Z",
      }),
      makeTask({
        id: "2",
        title: "Revisar logística",
        priority: "low",
        projectId: "p2",
        dueDate: "2026-11-26T12:00:00.000Z",
      }),
    ];
    const filtered = filterMyTasks(
      tasks,
      {
        ...DEFAULT_MY_TASKS_FILTERS,
        search: "minuta",
        priority: "urgent",
        segment: "overdue",
      },
      NOW,
    );
    expect(filtered.map((t) => t.id)).toEqual(["1"]);
  });

  it("groups tasks by priority in descending severity order", () => {
    const tasks = [
      makeTask({ id: "1", priority: "low" }),
      makeTask({ id: "2", priority: "urgent" }),
      makeTask({ id: "3", priority: "high" }),
    ];
    const groups = groupMyTasks(tasks, "priority", {}, NOW);
    expect(groups.map((g) => g.title)).toEqual(["Urgente", "Alta", "Baja"]);
  });
});

import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import {
  getLastProjectView,
  PROJECT_ROUTE_PATHS,
  QUICK_VIEW_TABS,
  resolveProjectView,
  routeForView,
  setLastProjectView,
  tasksViewFor,
} from "./project-views";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

it("serves board and list from the board route and routes new views directly", () => {
  expect(routeForView("list")).toBe("board");
  expect(routeForView("gantt")).toBe("gantt");
  expect(routeForView("workload")).toBe("workload");
  expect(routeForView("people")).toBe("people");
  expect(routeForView("dashboard")).toBe("dashboard");
  expect(resolveProjectView("board", "list")).toBe("list");
  expect(resolveProjectView("calendar", "list")).toBe("calendar");
  expect(resolveProjectView("workload", "board")).toBe("workload");
  expect(resolveProjectView("people", "board")).toBe("people");
  expect(resolveProjectView("dashboard", "board")).toBe("dashboard");
  expect(PROJECT_ROUTE_PATHS.workload).toContain("/workload");
  expect(PROJECT_ROUTE_PATHS.people).toContain("/people");
  expect(PROJECT_ROUTE_PATHS.dashboard).toContain("/dashboard");
});

it("orders the 7 quick view tabs consistently", () => {
  expect(QUICK_VIEW_TABS.map((tab) => tab.id)).toEqual([
    "gantt",
    "board",
    "list",
    "calendar",
    "workload",
    "people",
    "dashboard",
  ]);
});

it("returns to the last task layout, falling back to board or list", () => {
  expect(tasksViewFor("calendar", "list")).toBe("calendar");
  expect(tasksViewFor("gantt", "board")).toBe("gantt");
  expect(tasksViewFor("workload", "board")).toBe("workload");
  expect(tasksViewFor("people", "board")).toBe("people");
  expect(tasksViewFor("dashboard", "board")).toBe("dashboard");
  expect(tasksViewFor("board", "list")).toBe("list");
});

it("persists and restores the last view per project", () => {
  expect(getLastProjectView("proj-1")).toBe("board");
  setLastProjectView("proj-1", "workload");
  expect(getLastProjectView("proj-1")).toBe("workload");
  expect(window.localStorage.getItem("agenda:project-last-view:proj-1")).toBe(
    "workload",
  );
  window.localStorage.setItem("agenda:project-last-view:proj-2", "invalid");
  expect(getLastProjectView("proj-2")).toBe("board");
});

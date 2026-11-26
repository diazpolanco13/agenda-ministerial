import { useEffect } from "react";
import type { MyTasksViewMode } from "./my-tasks-filters";

type UseMyTasksShortcutsProps = {
  enabled: boolean;
  taskIds: string[];
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onChangeView: (view: MyTasksViewMode) => void;
};

const VIEW_BY_KEY: Record<string, MyTasksViewMode> = {
  "1": "list",
  "2": "board",
  "3": "calendar",
  "4": "timeline",
};

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest("[role='dialog'], [data-slot='popover-popup']"));
}

export function useMyTasksShortcuts({
  enabled,
  taskIds,
  focusedTaskId,
  setFocusedTaskId,
  toggleSelect,
  onOpenDetail,
  onChangeView,
}: UseMyTasksShortcutsProps) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableElement(event.target)) return;

      const view = VIEW_BY_KEY[event.key];
      if (view) {
        event.preventDefault();
        onChangeView(view);
        return;
      }

      if (taskIds.length === 0) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        const currentIndex = focusedTaskId ? taskIds.indexOf(focusedTaskId) : -1;
        const nextIndex = Math.min(taskIds.length - 1, currentIndex + 1);
        setFocusedTaskId(taskIds[nextIndex] ?? null);
        return;
      }

      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = focusedTaskId ? taskIds.indexOf(focusedTaskId) : 0;
        const prevIndex = Math.max(0, currentIndex - 1);
        setFocusedTaskId(taskIds[prevIndex] ?? null);
        return;
      }

      if (event.key === "x" && focusedTaskId) {
        event.preventDefault();
        toggleSelect(focusedTaskId);
        return;
      }

      if ((event.key === "e" || event.key === "Enter") && focusedTaskId) {
        event.preventDefault();
        onOpenDetail(focusedTaskId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    taskIds,
    focusedTaskId,
    setFocusedTaskId,
    toggleSelect,
    onOpenDetail,
    onChangeView,
  ]);
}

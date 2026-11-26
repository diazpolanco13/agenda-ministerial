import { useEffect, useRef } from "react";
import { isEditableTarget, shortcutRegistry } from "@/lib/shortcuts/registry";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useUserPreferencesStore } from "@/store/user-preferences";
import {
  type ProjectView,
  QUICK_VIEW_TABS,
  tasksViewFor,
} from "./project-views";

const BLOCKING_POPUP_SELECTOR =
  "[role='dialog']:not([data-closed]), [role='alertdialog']:not([data-closed]), [role='menu']:not([data-closed]), [role='listbox']:not([data-closed]), [data-slot='popover-popup']:not([data-closed])";

export function useProjectViewShortcuts(
  goToView: (view: ProjectView) => void,
  currentView: ProjectView,
  enabled: boolean,
) {
  const taskLayout = useUserPreferencesStore((state) => state.taskLayout);
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const goToViewRef = useRef(goToView);
  goToViewRef.current = goToView;

  useShortcut(
    "toggleLayout",
    () => goToView(currentView === "list" ? "board" : "list"),
    { enabled },
  );
  useShortcut("goToTasks", () => goToView(tasksViewFor(taskLayout, viewMode)), {
    enabled,
  });
  useShortcut("goToBacklog", () => goToView("backlog"), { enabled });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }
      if (shortcutRegistry.getPendingKey()) return;
      if (isEditableTarget(event.target)) return;
      if (
        event.target instanceof Element &&
        event.target.closest(BLOCKING_POPUP_SELECTOR)
      ) {
        return;
      }
      if (document.querySelector(BLOCKING_POPUP_SELECTOR)) return;

      const index = Number(event.key) - 1;
      if (
        !Number.isInteger(index) ||
        event.key.length !== 1 ||
        index < 0 ||
        index >= QUICK_VIEW_TABS.length
      ) {
        return;
      }

      const targetView = QUICK_VIEW_TABS[index];
      if (!targetView) return;
      event.preventDefault();
      goToViewRef.current(targetView.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}

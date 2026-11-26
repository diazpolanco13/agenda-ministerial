import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ProjectView } from "./project-views";
import { useProjectViewShortcuts } from "./use-project-view-shortcuts";

function ShortcutHarness({
  onSelect,
  enabled = true,
}: {
  onSelect: (view: ProjectView) => void;
  enabled?: boolean;
}) {
  useProjectViewShortcuts(onSelect, "board", enabled);
  return (
    <div>
      <input aria-label="search" />
      <div role="dialog" data-testid="modal" />
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("handles 1..7 keyboard shortcuts and ignores inputs, modifiers, and open dialogs", () => {
  const onSelect = vi.fn<(view: ProjectView) => void>();
  const { rerender } = render(<ShortcutHarness onSelect={onSelect} />);

  // Dialog is present and open in DOM, so shortcuts should be blocked.
  fireEvent.keyDown(window, { key: "1" });
  expect(onSelect).not.toHaveBeenCalled();

  // Mark dialog closed so shortcuts become active.
  document
    .querySelector("[data-testid='modal']")
    ?.setAttribute("data-closed", "");

  fireEvent.keyDown(window, { key: "1" });
  fireEvent.keyDown(window, { key: "5" });
  fireEvent.keyDown(window, { key: "7" });
  expect(onSelect).toHaveBeenNthCalledWith(1, "gantt");
  expect(onSelect).toHaveBeenNthCalledWith(2, "workload");
  expect(onSelect).toHaveBeenNthCalledWith(3, "dashboard");

  onSelect.mockClear();
  fireEvent.keyDown(window, { key: "2", ctrlKey: true });
  fireEvent.keyDown(window, { key: "2", metaKey: true });
  fireEvent.keyDown(window, { key: "2", altKey: true });
  expect(onSelect).not.toHaveBeenCalled();

  const input = document.querySelector("input")!;
  fireEvent.keyDown(input, { key: "3" });
  expect(onSelect).not.toHaveBeenCalled();

  rerender(<ShortcutHarness onSelect={onSelect} enabled={false} />);
  fireEvent.keyDown(window, { key: "4" });
  expect(onSelect).not.toHaveBeenCalled();
});

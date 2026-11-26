import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AssignedTask,
  ProjectColumnSummary,
} from "@/fetchers/task/get-assigned-tasks";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import { groupMyTasks, type MyTasksGroupBy } from "./my-tasks-filters";
import {
  MyTasksInlineRow,
  type WorkspaceMemberOption,
} from "./my-tasks-inline-row";

type MyTasksListViewProps = {
  tasks: AssignedTask[];
  total: number;
  groupBy: MyTasksGroupBy;
  columnsByProject: Record<string, ProjectColumnSummary[]>;
  workspaceMembers: WorkspaceMemberOption[];
  selectedTaskIds: Set<string>;
  focusedTaskId: string | null;
  onToggleSelect: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
};

export function MyTasksListView({
  tasks,
  total,
  groupBy,
  columnsByProject,
  workspaceMembers,
  selectedTaskIds,
  focusedTaskId,
  onToggleSelect,
  onOpenDetail,
}: MyTasksListViewProps) {
  const day = useLocalDay();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const groups = useMemo(
    () => groupMyTasks(tasks, groupBy, columnsByProject, new Date(day)),
    [tasks, groupBy, columnsByProject, day],
  );

  useEffect(() => {
    if (!focusedTaskId) return;
    const el = document.querySelector<HTMLElement>(
      `[data-task-id="${focusedTaskId}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedTaskId]);

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col pb-20">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        return (
          <section key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={!isCollapsed}
              className="flex h-9 w-full items-center gap-2 border-border/50 border-b bg-muted/40 px-4 text-left text-xs transition-colors hover:bg-muted/70 sm:px-5"
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "font-semibold",
                  group.tone === "overdue"
                    ? "text-destructive-foreground"
                    : group.tone === "done"
                      ? "text-muted-foreground"
                      : "text-foreground",
                )}
              >
                {group.title}
              </span>
              <span className="font-normal text-muted-foreground tabular-nums">
                {group.tasks.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="flex flex-col">
                {group.tasks.map((task) => (
                  <MyTasksInlineRow
                    key={task.id}
                    task={task}
                    projectColumns={columnsByProject[task.projectId]}
                    workspaceMembers={workspaceMembers}
                    selected={selectedTaskIds.has(task.id)}
                    focused={focusedTaskId === task.id}
                    onToggleSelect={onToggleSelect}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
      {total > tasks.length && tasks.length > 0 && (
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Mostrando {tasks.length} tareas filtradas ({total} abiertas en total).
        </p>
      )}
    </div>
  );
}

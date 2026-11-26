import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { DueDateText } from "@/components/my-work/due-date-text";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  AssignedTask,
  ProjectColumnSummary,
} from "@/fetchers/task/get-assigned-tasks";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import { useMyTasksMutations } from "./use-my-tasks-mutations";

type MyTasksBoardViewProps = {
  tasks: AssignedTask[];
  columnsByProject: Record<string, ProjectColumnSummary[]>;
  selectedTaskIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
};

type StatusBucket = {
  slug: string;
  label: string;
  icon: string | null;
  isFinal: boolean;
  position: number;
  tasks: AssignedTask[];
};

function BoardTaskCard({
  task,
  selected,
  onToggleSelect,
  onOpenDetail,
  isOverlay = false,
}: {
  task: AssignedTask;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
      disabled: isOverlay,
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const code =
    task.number == null ? task.projectSlug : `${task.projectSlug}-${task.number}`;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      data-task-id={task.id}
      onClick={() => onOpenDetail(task.id)}
      className={cn(
        "cursor-grab rounded-lg border border-board-card-border bg-board-card p-3 shadow-xs transition-colors active:cursor-grabbing",
        "hover:border-board-card-border-hover",
        selected && "border-board-card-selected-border bg-board-card-selected",
        isDragging && "opacity-40",
        isOverlay && "shadow-lg ring-1 ring-primary/30",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(task.id)}
              aria-label={`Seleccionar ${task.title}`}
            />
          </div>
          <span className="truncate font-mono text-[11px] font-medium text-board-id">
            {code}
          </span>
        </div>
        <span className="shrink-0 [&_svg]:size-3.5">
          {getPriorityIcon(task.priority)}
        </span>
      </div>

      <p
        className={cn(
          "line-clamp-2 text-sm font-medium text-board-title",
          task.isFinal && "line-through text-board-title-done",
        )}
      >
        {task.title}
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {task.projectName}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <DueDateText dueDate={task.dueDate} />
          <ResponsableAvatar
            size="xs"
            userId={task.userId}
            name={task.assigneeName}
            image={task.assigneeImage}
            cedula={task.assigneeCedula}
            grado={task.assigneeGrado}
            componente={task.assigneeComponente}
            unidad={task.assigneeUnidad}
            assigned={Boolean(task.userId)}
          />
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  bucket,
  selectedTaskIds,
  onToggleSelect,
  onOpenDetail,
}: {
  bucket: StatusBucket;
  selectedTaskIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${bucket.slug}`,
    data: { status: bucket.slug },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border/70 bg-board-lane p-2.5 sm:w-80",
        isOver && "ring-2 ring-primary/50 bg-accent/40",
      )}
    >
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {getColumnIcon(bucket.slug, bucket.isFinal, bucket.icon)}
          <h3 className="truncate text-xs font-semibold text-foreground">
            {bucket.label}
          </h3>
        </div>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {bucket.tasks.length}
        </span>
      </div>

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto">
        {bucket.tasks.map((task) => (
          <BoardTaskCard
            key={task.id}
            task={task}
            selected={selectedTaskIds.has(task.id)}
            onToggleSelect={onToggleSelect}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </div>
  );
}

export function MyTasksBoardView({
  tasks,
  columnsByProject,
  selectedTaskIds,
  onToggleSelect,
  onOpenDetail,
}: MyTasksBoardViewProps) {
  const { updateStatus } = useMyTasksMutations();
  const [activeTask, setActiveTask] = useState<AssignedTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const buckets = useMemo(() => {
    const map = new Map<string, StatusBucket>();

    // Seed with columns discovered from projects so empty target columns stay droppable.
    for (const cols of Object.values(columnsByProject)) {
      for (const col of cols) {
        if (!map.has(col.slug)) {
          map.set(col.slug, {
            slug: col.slug,
            label: getStatusDisplayLabel(col.slug, col.name),
            icon: col.icon,
            isFinal: col.isFinal,
            position: col.position,
            tasks: [],
          });
        }
      }
    }

    for (const task of tasks) {
      const existing = map.get(task.status);
      if (existing) {
        existing.tasks.push(task);
      } else {
        map.set(task.status, {
          slug: task.status,
          label: getStatusDisplayLabel(task.status, task.statusName ?? undefined),
          icon: task.statusIcon,
          isFinal: Boolean(task.isFinal),
          position: 99,
          tasks: [task],
        });
      }
    }

    return [...map.values()].sort((a, b) => a.position - b.position);
  }, [tasks, columnsByProject]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as AssignedTask | undefined;
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const task = active.data.current?.task as AssignedTask | undefined;
    const nextStatus = over.data.current?.status as string | undefined;
    if (!task || !nextStatus || task.status === nextStatus) return;

    const projectCols = columnsByProject[task.projectId] ?? [];
    const targetCol = projectCols.find((c) => c.slug === nextStatus);
    if (projectCols.length > 0 && !targetCol) {
      toast.error(
        `El proyecto ${task.projectName} no tiene la columna "${nextStatus}".`,
      );
      return;
    }

    void updateStatus({
      taskId: task.id,
      projectId: task.projectId,
      status: nextStatus,
      statusName: targetCol?.name ?? nextStatus,
      statusIcon: targetCol?.icon ?? null,
      isFinal: Boolean(targetCol?.isFinal),
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-[26rem] items-start gap-3 overflow-x-auto p-4 pb-24 sm:p-5">
        {buckets.map((bucket) => (
          <BoardColumn
            key={bucket.slug}
            bucket={bucket}
            selectedTaskIds={selectedTaskIds}
            onToggleSelect={onToggleSelect}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <BoardTaskCard
            task={activeTask}
            selected={selectedTaskIds.has(activeTask.id)}
            onToggleSelect={onToggleSelect}
            onOpenDetail={onOpenDetail}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

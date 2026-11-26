import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { DueDateText } from "@/components/my-work/due-date-text";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DelegatedTask } from "@/fetchers/task/get-delegated-tasks";
import { useRemindDelegatedTask } from "@/hooks/mutations/task/use-remind-delegated-task";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";

type MyTasksDelegatedViewProps = {
  tasks: DelegatedTask[];
  onOpenDetail: (taskId: string) => void;
};

const ACTIVITY_LABELS: Record<string, string> = {
  created: "Creada",
  create: "Creada",
  status_changed: "Cambio de estado",
  priority_changed: "Cambio de prioridad",
  assignee_changed: "Reasignada",
  due_date_changed: "Fecha actualizada",
  comment: "Comentario",
  reminder: "Recordatorio enviado",
};

export function MyTasksDelegatedView({
  tasks,
  onOpenDetail,
}: MyTasksDelegatedViewProps) {
  const { mutateAsync: remindTask } = useRemindDelegatedTask();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleRemind = async (task: DelegatedTask) => {
    if (sendingId) return;
    setSendingId(task.id);
    try {
      await remindTask({ taskId: task.id });
      toast.success(
        `Recordatorio enviado a ${
          task.assigneeGrado ? `${task.assigneeGrado} ` : ""
        }${task.assigneeName ?? "responsable"}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el recordatorio",
      );
    } finally {
      setSendingId(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center gap-2 p-8 text-center">
        <CheckCircle2 className="size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">
          No tienes tareas delegadas que coincidan
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Aquí aparecen las tareas que creaste y asignaste a otro miembro del
          despacho para darles seguimiento.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60 pb-20">
      {tasks.map((task) => {
        const code =
          task.number == null
            ? task.projectSlug
            : `${task.projectSlug}-${task.number}`;
        const statusLabel = getStatusDisplayLabel(
          task.status,
          task.statusName ?? undefined,
        );
        const lastMoveText = task.lastActivityAt
          ? formatDistanceToNow(new Date(task.lastActivityAt), {
              addSuffix: true,
              locale: es,
            })
          : "—";
        const activityTypeLabel = task.lastActivityType
          ? (ACTIVITY_LABELS[task.lastActivityType] ?? "Actualización")
          : "Actualización";
        const hasSubtasks = task.subtaskCounts.total > 0;
        const subtaskPct = hasSubtasks
          ? Math.round(
              (task.subtaskCounts.completed / task.subtaskCounts.total) * 100,
            )
          : task.isFinal
            ? 100
            : 0;

        return (
          <div
            key={task.id}
            data-task-id={task.id}
            onClick={() => onOpenDetail(task.id)}
            className="flex cursor-pointer flex-col gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
          >
            {/* Left: task title + status + code */}
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <span className="mt-0.5 shrink-0 [&_svg]:size-3.5">
                {getPriorityIcon(task.priority)}
              </span>
              <span className="mt-0.5 shrink-0" title={statusLabel}>
                {getColumnIcon(task.status, task.isFinal, task.statusIcon)}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-muted-foreground">
                    {code}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium text-foreground",
                      task.isFinal && "line-through text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </span>
                  {task.overdueDays > 0 && (
                    <Badge variant="destructive" size="sm">
                      {task.overdueDays}{" "}
                      {task.overdueDays === 1 ? "día" : "días"} de atraso
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{task.projectName}</span>
                  <span>·</span>
                  <span>{statusLabel}</span>
                  {hasSubtasks && (
                    <>
                      <span>·</span>
                      <span className="tabular-nums">
                        Subtareas: {task.subtaskCounts.completed}/
                        {task.subtaskCounts.total} ({subtaskPct}%)
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {activityTypeLabel} {lastMoveText}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: assignee (foto + grado) + due date + Remind button */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 lg:justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex min-w-0 items-center gap-2">
                <ResponsableAvatar
                  size="sm"
                  userId={task.userId}
                  name={task.assigneeName}
                  image={task.assigneeImage}
                  cedula={task.assigneeCedula}
                  grado={task.assigneeGrado}
                  componente={task.assigneeComponente}
                  unidad={task.assigneeUnidad}
                  showHoverCard
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    {task.assigneeInsignia && (
                      <img
                        src={task.assigneeInsignia}
                        alt={task.assigneeGrado ?? ""}
                        className="h-3.5 w-auto shrink-0 object-contain"
                      />
                    )}
                    <p className="max-w-44 truncate text-xs font-medium text-foreground">
                      {task.assigneeGrado ? `${task.assigneeGrado} ` : ""}
                      {task.assigneeName ?? "Sin nombre"}
                    </p>
                  </div>
                  {task.assigneeUnidad && (
                    <p className="max-w-44 truncate text-[11px] text-muted-foreground">
                      {task.assigneeUnidad}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DueDateText
                  dueDate={task.dueDate}
                  className="min-w-16 text-right"
                />
                {!task.isFinal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sendingId === task.id}
                    onClick={() => void handleRemind(task)}
                    className="h-7 gap-1.5 px-2.5 text-xs"
                  >
                    <Bell className="size-3.5" />
                    <span>
                      {sendingId === task.id ? "Enviando..." : "Recordar"}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

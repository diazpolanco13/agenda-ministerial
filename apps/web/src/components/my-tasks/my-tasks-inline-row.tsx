import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { DueDateText } from "@/components/my-work/due-date-text";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { SigefanbPersonSearch } from "@/components/sigefanb/sigefanb-person-search";
import TaskDueDatePicker from "@/components/task/task-due-date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  provisionarResponsableSigefanb,
  type SigefanbPersonalItem,
} from "@/fetchers/sigefanb";
import type {
  AssignedTask,
  ProjectColumnSummary,
} from "@/fetchers/task/get-assigned-tasks";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import { useMyTasksMutations } from "./use-my-tasks-mutations";

const PRIORITIES = ["urgent", "high", "medium", "low", "no-priority"] as const;

export type WorkspaceMemberOption = {
  userId: string;
  name: string;
  image?: string | null;
  grado?: string | null;
  cedula?: string | null;
  componente?: string | null;
  unidad?: string | null;
};

type MyTasksInlineRowProps = {
  task: AssignedTask;
  projectColumns?: ProjectColumnSummary[];
  workspaceMembers?: WorkspaceMemberOption[];
  selected: boolean;
  focused: boolean;
  onToggleSelect: (taskId: string) => void;
  onOpenDetail: (taskId: string) => void;
};

function StatusInlineTrigger({
  task,
  projectColumns,
  canEdit,
  onSelectStatus,
}: {
  task: AssignedTask;
  projectColumns?: ProjectColumnSummary[];
  canEdit: boolean;
  onSelectStatus: (col: {
    slug: string;
    name: string;
    icon: string | null;
    isFinal: boolean;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: fetchedColumns = [] } = useGetColumns(
    open && !projectColumns?.length ? task.projectId : "",
  );
  const columns = projectColumns?.length ? projectColumns : fetchedColumns;

  const icon = getColumnIcon(
    task.status,
    Boolean(task.isFinal),
    task.statusIcon,
  );

  if (!canEdit) {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center"
        title={getStatusDisplayLabel(task.status, task.statusName ?? undefined)}
      >
        {icon}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={getStatusDisplayLabel(
            task.status,
            task.statusName ?? undefined,
          )}
          aria-label={`Cambiar estado (${getStatusDisplayLabel(task.status, task.statusName ?? undefined)})`}
          className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <OptionMenu
          label="Estado"
          placeholder="Buscar estado..."
          options={columns.map((col) => ({
            value: col.slug,
            label: getStatusDisplayLabel(col.slug, col.name),
            icon: getColumnIcon(col.slug, col.isFinal, col.icon),
            selected: col.slug === task.status,
          }))}
          onSelect={(slug) => {
            const col = columns.find((c) => c.slug === slug);
            setOpen(false);
            if (col) {
              onSelectStatus({
                slug: col.slug,
                name: col.name,
                icon: col.icon ?? null,
                isFinal: Boolean(col.isFinal),
              });
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function MyTasksInlineRow({
  task,
  projectColumns,
  workspaceMembers = [],
  selected,
  focused,
  onToggleSelect,
  onOpenDetail,
}: MyTasksInlineRowProps) {
  const queryClient = useQueryClient();
  const { canUpdateTasks, canAssignTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const canAssign = canAssignTasks();
  const { updateStatus, updatePriority, updateDueDate, updateAssignee } =
    useMyTasksMutations();

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeTab, setAssigneeTab] = useState<"members" | "sigefanb">(
    "members",
  );
  const [provisioning, setProvisioning] = useState(false);

  const dueDateObj = useMemo(
    () => (task.dueDate ? new Date(task.dueDate) : null),
    [task.dueDate],
  );
  const startDateObj = useMemo(
    () => (task.startDate ? new Date(task.startDate) : undefined),
    [task.startDate],
  );

  const code =
    task.number == null ? task.projectSlug : `${task.projectSlug}-${task.number}`;

  const handleSigefanbSelect = async (item: SigefanbPersonalItem) => {
    if (provisioning) return;
    setProvisioning(true);
    try {
      const wsId = task.workspaceId ?? "";
      const { user } = await provisionarResponsableSigefanb({
        cedula: item.cedula,
        workspaceId: wsId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace-users", wsId] }),
        queryClient.invalidateQueries({
          queryKey: ["active-workspace-users", wsId],
        }),
      ]);
      await updateAssignee({
        taskId: task.id,
        projectId: task.projectId,
        userId: user.id,
        assigneeMeta: {
          name: user.name,
          cedula: item.cedula,
          grado: user.grado ?? item.grado,
          componente: item.componente,
          unidad: item.unidad,
        },
      });
      setAssigneeOpen(false);
      toast.success(
        `Responsable asignado: ${user.grado ? `${user.grado} ` : ""}${user.name}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo asignar el responsable",
      );
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div
      data-task-id={task.id}
      data-focused={focused ? "true" : undefined}
      onClick={() => onOpenDetail(task.id)}
      className={cn(
        "group flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1.5 border-border/50 border-b px-2 py-2 transition-colors sm:flex-nowrap sm:px-3",
        "cursor-pointer hover:bg-accent/45",
        selected && "bg-primary/5",
        focused && "ring-1 ring-inset ring-primary/60 bg-accent/35",
      )}
    >
      <div
        className="flex shrink-0 items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(task.id)}
          aria-label={`Seleccionar ${task.title}`}
        />
      </div>

      {/* Inline priority */}
      {canEdit ? (
        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              title={getPriorityLabel(task.priority)}
              aria-label={`Prioridad: ${getPriorityLabel(task.priority)}`}
              className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
            >
              {getPriorityIcon(task.priority)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-0" align="start">
            <OptionMenu
              label="Prioridad"
              placeholder="Cambiar prioridad..."
              options={PRIORITIES.map((p) => ({
                value: p,
                label: getPriorityLabel(p),
                icon: getPriorityIcon(p),
                selected: (task.priority || "no-priority") === p,
              }))}
              onSelect={(priority) => {
                setPriorityOpen(false);
                void updatePriority({
                  taskId: task.id,
                  projectId: task.projectId,
                  priority,
                });
              }}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center [&_svg]:size-3.5">
          {getPriorityIcon(task.priority)}
        </span>
      )}

      {/* Inline status */}
      <StatusInlineTrigger
        task={task}
        projectColumns={projectColumns}
        canEdit={canEdit}
        onSelectStatus={(col) => {
          void updateStatus({
            taskId: task.id,
            projectId: task.projectId,
            status: col.slug,
            statusName: col.name,
            statusIcon: col.icon,
            isFinal: col.isFinal,
          });
        }}
      />

      <span className="hidden w-16 shrink-0 truncate font-mono text-xs font-medium text-muted-foreground sm:inline-block">
        {code}
      </span>

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium text-foreground",
          task.isFinal && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </span>

      {task.labels.length > 0 && (
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {task.labels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="inline-flex max-w-28 items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: resolveLabelColor(label.color) }}
              />
              <span className="truncate">{label.name}</span>
            </span>
          ))}
        </div>
      )}

      <span className="hidden max-w-32 shrink-0 truncate text-xs text-muted-foreground md:inline-block">
        {task.projectName}
      </span>

      {/* Inline due date */}
      <div
        className="flex shrink-0 items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {canEdit ? (
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Cambiar fecha límite"
                className="inline-flex min-w-18 items-center justify-end gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {task.dueDate ? (
                  <DueDateText dueDate={task.dueDate} />
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                    <CalendarDays className="size-3.5" />
                    <span className="hidden sm:inline">Fecha</span>
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-65 p-0" align="end">
              <TaskDueDatePicker
                label="Fecha límite"
                clearLabel="Quitar fecha"
                dueDate={dueDateObj}
                startDate={startDateObj}
                recurrence={null}
                onRecurrenceChange={() => {}}
                onDateChange={(nextDate) => {
                  setDateOpen(false);
                  void updateDueDate({
                    taskId: task.id,
                    projectId: task.projectId,
                    dueDate: nextDate ? nextDate.toISOString() : null,
                  });
                }}
                canSetRecurrence={false}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <DueDateText dueDate={task.dueDate} className="w-20 text-right" />
        )}
      </div>

      {/* Inline assignee with SIGEFANB smart search */}
      <div
        className="flex shrink-0 items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {canAssign ? (
          <Popover
            open={assigneeOpen}
            onOpenChange={(next) => {
              setAssigneeOpen(next);
              if (!next) setAssigneeTab("members");
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                title={
                  task.assigneeName
                    ? `${task.assigneeGrado ? `${task.assigneeGrado} ` : ""}${task.assigneeName}`
                    : "Asignar responsable"
                }
                aria-label="Cambiar responsable"
                className="flex items-center justify-center rounded-full p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ResponsableAvatar
                  size="sm"
                  userId={task.userId}
                  name={task.assigneeName}
                  image={task.assigneeImage}
                  cedula={task.assigneeCedula}
                  grado={task.assigneeGrado}
                  componente={task.assigneeComponente}
                  unidad={task.assigneeUnidad}
                  assigned={Boolean(task.userId)}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Tabs
                value={assigneeTab}
                onValueChange={(v) =>
                  setAssigneeTab(v as "members" | "sigefanb")
                }
                className="gap-0"
              >
                <div className="border-border/80 border-b px-2 pt-2 pb-1.5">
                  <TabsList className="w-full">
                    <TabsTrigger value="members" className="text-xs sm:h-7">
                      Miembros
                    </TabsTrigger>
                    <TabsTrigger value="sigefanb" className="text-xs sm:h-7">
                      Buscar en SIGEFANB
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="members">
                  <OptionMenu
                    label="Responsable"
                    placeholder="Buscar miembro..."
                    options={[
                      {
                        value: "",
                        label: "Sin asignar",
                        icon: (
                          <UserRound className="size-3.5 text-muted-foreground" />
                        ),
                        selected: !task.userId,
                      },
                      ...workspaceMembers.map((m) => ({
                        value: m.userId,
                        label: m.grado ? `${m.grado} ${m.name}` : m.name,
                        icon: (
                          <ResponsableAvatar
                            size="xs"
                            userId={m.userId}
                            name={m.name}
                            image={m.image}
                            cedula={m.cedula}
                            grado={m.grado}
                            componente={m.componente}
                            unidad={m.unidad}
                          />
                        ),
                        selected: m.userId === task.userId,
                      })),
                    ]}
                    onSelect={(nextUserId) => {
                      setAssigneeOpen(false);
                      const member = workspaceMembers.find(
                        (m) => m.userId === nextUserId,
                      );
                      void updateAssignee({
                        taskId: task.id,
                        projectId: task.projectId,
                        userId: nextUserId || null,
                        assigneeMeta: member
                          ? {
                              name: member.name,
                              image: member.image ?? null,
                              cedula: member.cedula ?? null,
                              grado: member.grado ?? null,
                              componente: member.componente ?? null,
                              unidad: member.unidad ?? null,
                            }
                          : {
                              name: null,
                              image: null,
                              cedula: null,
                              grado: null,
                              componente: null,
                              unidad: null,
                            },
                      });
                    }}
                  />
                </TabsContent>
                <TabsContent value="sigefanb">
                  <SigefanbPersonSearch
                    onSelect={handleSigefanbSelect}
                    disabled={provisioning}
                  />
                </TabsContent>
              </Tabs>
            </PopoverContent>
          </Popover>
        ) : (
          <ResponsableAvatar
            size="sm"
            userId={task.userId}
            name={task.assigneeName}
            image={task.assigneeImage}
            cedula={task.assigneeCedula}
            grado={task.assigneeGrado}
            componente={task.assigneeComponente}
            unidad={task.assigneeUnidad}
            assigned={Boolean(task.userId)}
          />
        )}
      </div>
    </div>
  );
}

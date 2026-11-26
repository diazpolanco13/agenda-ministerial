import { useQueryClient } from "@tanstack/react-query";
import {
  CircleDot,
  FolderInput,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BulkCountChip } from "@/components/bulk-selection/bulk-count-chip";
import { BulkDueDatePopover } from "@/components/bulk-selection/bulk-due-date-popover";
import { BulkOptionPopover } from "@/components/bulk-selection/bulk-option-popover";
import { barButtonClass } from "@/components/bulk-selection/bar-button-class";
import { toolbarPresenceClass } from "@/components/bulk-selection/toolbar-presence-class";
import { useBulkSelectionKeys } from "@/components/bulk-selection/use-bulk-selection-keys";
import { useToolbarPresence } from "@/components/bulk-selection/use-toolbar-presence";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import { SigefanbPersonSearch } from "@/components/sigefanb/sigefanb-person-search";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toolbar } from "@/components/ui/toolbar";
import {
  provisionarResponsableSigefanb,
  type SigefanbPersonalItem,
} from "@/fetchers/sigefanb";
import type { ProjectColumnSummary } from "@/fetchers/task/get-assigned-tasks";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import type { WorkspaceMemberOption } from "./my-tasks-inline-row";

type MyTasksBulkBarProps = {
  workspaceId: string;
  selectedTaskIds: Set<string>;
  clearSelection: () => void;
  selectAll: () => void;
  columnsByProject: Record<string, ProjectColumnSummary[]>;
  workspaceMembers: WorkspaceMemberOption[];
};

const PRIORITIES = ["urgent", "high", "medium", "low", "no-priority"] as const;

export function MyTasksBulkBar({
  workspaceId,
  selectedTaskIds,
  clearSelection,
  selectAll,
  columnsByProject,
  workspaceMembers,
}: MyTasksBulkBarProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const operations = useBulkOperations();
  const { canUpdateTasks, canAssignTasks } = useWorkspacePermission();
  const { data: projects = [] } = useGetProjects({ workspaceId });

  const count = selectedTaskIds.size;
  const { mounted, hidden, displayCount } = useToolbarPresence(count);
  useBulkSelectionKeys({
    hasSelection: count > 0,
    selectAll,
    clearSelection,
  });

  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeTab, setAssigneeTab] = useState<"members" | "sigefanb">(
    "members",
  );
  const [provisioning, setProvisioning] = useState(false);

  const statusOptions = useMemo(() => {
    const map = new Map<string, ProjectColumnSummary>();
    for (const cols of Object.values(columnsByProject)) {
      for (const col of cols) {
        if (!map.has(col.slug)) map.set(col.slug, col);
      }
    }
    return [...map.values()]
      .sort((a, b) => a.position - b.position)
      .map((col) => ({
        value: col.slug,
        label: getStatusDisplayLabel(col.slug, col.name),
        icon: getColumnIcon(col.slug, col.isFinal, col.icon),
        selected: false,
      }));
  }, [columnsByProject]);

  const priorityOptions = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        value: p,
        label: getPriorityLabel(p),
        icon: getPriorityIcon(p),
        selected: false,
      })),
    [],
  );

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: p.name,
        icon: <FolderInput className="size-3.5 text-muted-foreground" />,
        selected: false,
      })),
    [projects],
  );

  if (!mounted) return null;
  const canEdit = canUpdateTasks();
  const canAssign = canAssignTasks();
  if (!canEdit && !canAssign) return null;

  const taskIds = Array.from(selectedTaskIds);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
      clearSelection();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo completar la acción en lote",
      );
    }
  };

  const handleSigefanbBulkAssign = async (item: SigefanbPersonalItem) => {
    if (provisioning) return;
    setProvisioning(true);
    try {
      const { user } = await provisionarResponsableSigefanb({
        cedula: item.cedula,
        workspaceId,
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-users", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["active-workspace-users", workspaceId],
        }),
      ]);
      await operations.bulkAssign({ taskIds, userId: user.id });
      setAssigneeOpen(false);
      clearSelection();
      toast.success(
        `${count} ${count === 1 ? "tarea asignada" : "tareas asignadas"} a ${
          user.grado ? `${user.grado} ` : ""
        }${user.name}`,
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
      inert={hidden}
      className={cn(
        "-translate-x-1/2 fixed bottom-5 left-1/2 z-50 transition-[translate,opacity,visibility] ease-out max-sm:right-3 max-sm:left-3 max-sm:translate-x-0",
        toolbarPresenceClass(hidden),
      )}
    >
      <Toolbar className="h-11 items-center gap-0.5 rounded-xl border-border/80 bg-popover px-2 py-0 shadow-lg/10 max-sm:justify-between">
        <BulkCountChip count={displayCount} onClear={clearSelection} />

        <div className="ms-1.5 flex items-center gap-0.5 overflow-x-auto">
          {canEdit && statusOptions.length > 0 && (
            <BulkOptionPopover
              icon={<CircleDot />}
              label="Estado"
              placeholder={t("tasks:bulk.statusPlaceholder")}
              options={statusOptions}
              onSelect={(status) =>
                void runAction(
                  () => operations.bulkChangeStatus({ taskIds, status }),
                  `Estado actualizado en ${count} tareas`,
                )
              }
            />
          )}

          {canEdit && (
            <BulkOptionPopover
              icon={<PriorityGlyph priority="high" />}
              label="Prioridad"
              placeholder={t("tasks:bulk.priorityPlaceholder")}
              options={priorityOptions}
              onSelect={(priority) =>
                void runAction(
                  () => operations.bulkPriority({ taskIds, priority }),
                  `Prioridad actualizada en ${count} tareas`,
                )
              }
            />
          )}

          {canEdit && (
            <BulkDueDatePopover
              onSelect={(date) =>
                void runAction(
                  () =>
                    operations.bulkDueDate({
                      taskIds,
                      dueDate: date ? date.toISOString() : null,
                    }),
                  `Fecha actualizada en ${count} tareas`,
                )
              }
            />
          )}

          {canAssign && (
            <Popover
              open={assigneeOpen}
              onOpenChange={(next) => {
                setAssigneeOpen(next);
                if (!next) setAssigneeTab("members");
              }}
            >
              <PopoverTrigger asChild>
                <button type="button" className={barButtonClass}>
                  <UserRound />
                  <span className="max-lg:sr-only">Responsable</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="center" side="top">
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
                      options={workspaceMembers.map((m) => ({
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
                        selected: false,
                      }))}
                      onSelect={(userId) => {
                        setAssigneeOpen(false);
                        void runAction(
                          () => operations.bulkAssign({ taskIds, userId }),
                          `Responsable asignado en ${count} tareas`,
                        );
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="sigefanb">
                    <SigefanbPersonSearch
                      onSelect={handleSigefanbBulkAssign}
                      disabled={provisioning}
                    />
                  </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>
          )}

          {canEdit && projectOptions.length > 1 && (
            <BulkOptionPopover
              icon={<FolderInput />}
              label="Mover proyecto"
              placeholder="Proyecto destino..."
              options={projectOptions}
              onSelect={(destinationProjectId) =>
                void runAction(
                  () =>
                    operations.bulkMoveProject({
                      taskIds,
                      destinationProjectId,
                    }),
                  `Tareas movidas de proyecto`,
                )
              }
            />
          )}
        </div>
      </Toolbar>
    </div>
  );
}

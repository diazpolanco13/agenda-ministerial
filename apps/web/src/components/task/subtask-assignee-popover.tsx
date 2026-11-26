import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { SigefanbPersonSearch } from "@/components/sigefanb/sigefanb-person-search";
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
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useGetMembersOfProjects from "@/hooks/queries/workspace-users/use-get-members-of-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import { assigneeMenuOptions } from "./menus/assignee-menu-options";

type SubtaskAssigneePopoverProps = {
  tasks: Task[];
  workspaceId: string;
  children: React.ReactNode;
};

export default function SubtaskAssigneePopover({
  tasks,
  workspaceId,
  children,
}: SubtaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "sigefanb">("members");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { data: members = [] } = useGetMembersOfProjects({
    workspaceId,
    projectIds: tasks.map((task) => task.projectId),
  });
  const { canAssignTasks } = useWorkspacePermission();

  if (!canAssignTasks()) return <>{children}</>;

  const current = tasks.every((task) => task.userId === tasks[0]?.userId)
    ? (tasks[0]?.userId ?? null)
    : undefined;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setActiveTab("members");
    }
  };

  const changeAssignee = async (userId: string) => {
    setOpen(false);
    try {
      await Promise.all(
        tasks.map((task) => updateTaskAssignee({ ...task, userId })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.updateError"),
      );
    }
  };

  const handleSelectSigefanb = async (item: SigefanbPersonalItem) => {
    if (isProvisioning) return;
    setIsProvisioning(true);
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
        queryClient.invalidateQueries({
          queryKey: ["projects", workspaceId],
        }),
      ]);
      await Promise.all(
        tasks.map((task) => updateTaskAssignee({ ...task, userId: user.id })),
      );
      setOpen(false);
      setActiveTab("members");
      toast.success(
        `Responsable asignado: ${user.grado ? `${user.grado} ` : ""}${user.name}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.updateError"),
      );
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "members" | "sigefanb")
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
              label={t("tasks:assignee.label")}
              placeholder={t("tasks:bulk.assigneePlaceholder")}
              options={assigneeMenuOptions(
                members,
                current,
                t("tasks:popover.assignee.unassigned"),
              )}
              onSelect={changeAssignee}
            />
          </TabsContent>
          <TabsContent value="sigefanb">
            <SigefanbPersonSearch
              onSelect={handleSelectSigefanb}
              disabled={isProvisioning}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

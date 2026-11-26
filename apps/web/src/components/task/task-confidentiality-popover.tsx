import { Lock, Shield, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  CONFIDENTIALITY_LABELS,
  type ConfidentialityLevel,
} from "@/components/confidentiality/confidentiality-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskConfidentialityPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

const CONFIDENTIALITY_OPTIONS: ConfidentialityLevel[] = [
  "publica_interna",
  "reservada",
  "confidencial",
];

export function normalizeConfidentialityLevel(
  level?: string | null,
): ConfidentialityLevel {
  if (level === "reservada" || level === "confidencial") {
    return level;
  }
  return "publica_interna";
}

export function getConfidentialityIcon(level: ConfidentialityLevel) {
  if (level === "confidencial") {
    return (
      <Lock
        className="size-3.5 text-red-700 dark:text-red-400"
        aria-hidden="true"
      />
    );
  }
  if (level === "reservada") {
    return (
      <ShieldAlert
        className="size-3.5 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      />
    );
  }
  return (
    <Shield className="size-3.5 text-muted-foreground" aria-hidden="true" />
  );
}

/**
 * Selector de nivel de confidencialidad para tareas y órdenes.
 */
export default function TaskConfidentialityPopover({
  task,
  children,
}: TaskConfidentialityPopoverProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks()) return <>{children}</>;

  const currentLevel = normalizeConfidentialityLevel(task.confidentialityLevel);

  const changeLevel = async (nextLevel: string) => {
    setOpen(false);
    try {
      await updateTask({
        ...task,
        confidentialityLevel: nextLevel as ConfidentialityLevel,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el nivel de confidencialidad.",
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <OptionMenu
          label="Confidencialidad"
          placeholder="Buscar nivel..."
          options={CONFIDENTIALITY_OPTIONS.map((level) => ({
            value: level,
            label: CONFIDENTIALITY_LABELS[level],
            icon: getConfidentialityIcon(level),
            selected: currentLevel === level,
          }))}
          onSelect={changeLevel}
        />
      </PopoverContent>
    </Popover>
  );
}

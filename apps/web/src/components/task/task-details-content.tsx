import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ConfidentialWatermark } from "@/components/confidentiality/confidential-watermark";
import {
  ConfidentialityBadge,
  type ConfidentialityLevel,
} from "@/components/confidentiality/confidentiality-badge";
import { ExternalLinksAccordion } from "@/components/external-links/external-links-accordion";
import { OrderClosureCard } from "@/components/ordenes/order-closure-card";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import useCurrentUser from "@/hooks/queries/user/use-current-user";
import { cn } from "@/lib/cn";
import type { ExternalLink } from "@/types/external-link";
import { TaskActivity } from "./task-activity";
import TaskDescription from "./task-description";
import TaskRelations from "./task-relations";
import TaskSubtasks from "./task-subtasks";
import TaskTitle from "./task-title";
import { TaskTimeTracking } from "./task-time-tracking";

const CONF_RANK: Record<ConfidentialityLevel, number> = {
  publica_interna: 0,
  reservada: 1,
  confidencial: 2,
};

function resolveConfidentialityLevel(
  ...levels: Array<string | null | undefined>
): ConfidentialityLevel {
  let best: ConfidentialityLevel = "publica_interna";
  for (const level of levels) {
    if (
      level === "publica_interna" ||
      level === "reservada" ||
      level === "confidencial"
    ) {
      if (CONF_RANK[level] > CONF_RANK[best]) {
        best = level;
      }
    }
  }
  return best;
}

function TaskConfidentialWatermark() {
  const { user } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const userName = currentUser?.name || user?.name || "Usuario";
  const cedula = currentUser?.militar?.cedula ?? null;

  return <ConfidentialWatermark visible userName={userName} cedula={cedula} />;
}

type TaskDetailsContentProps = {
  taskId: string | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
  variant?: "sheet" | "page";
  properties?: ReactNode;
};

export default function TaskDetailsContent({
  taskId,
  projectId,
  workspaceId,
  className,
  variant = "sheet",
  properties,
}: TaskDetailsContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: task } = useGetTask(taskId ?? "");
  const { data: externalLinks = [], isLoading: isLoadingExternalLinks } =
    useExternalLinks(taskId ?? "");
  const { data: relations = [] } = useGetTaskRelations(taskId ?? "");

  const parentTask = relations.find(
    (rel) => rel.relationType === "subtask" && rel.targetTaskId === taskId,
  )?.sourceTask;
  const { data: parentProject } = useGetProject({
    id: parentTask?.projectId ?? "",
    workspaceId,
  });
  const { data: currentProject } = useGetProject({
    id: projectId,
    workspaceId,
  });

  if (!taskId) return null;

  const taskConfidentiality = (
    task as { confidentialityLevel?: string | null } | undefined
  )?.confidentialityLevel;
  const taskProjectConfidentiality = (
    task as { projectConfidentialityLevel?: string | null } | undefined
  )?.projectConfidentialityLevel;
  const currentProjectConfidentiality = (
    currentProject as { confidentialityLevel?: string | null } | undefined
  )?.confidentialityLevel;

  const effectiveConfidentiality = resolveConfidentialityLevel(
    taskConfidentiality,
    taskProjectConfidentiality ?? currentProjectConfidentiality,
  );
  const isConfidential = effectiveConfidentiality === "confidencial";

  return (
    <div className={cn("relative flex flex-col overflow-hidden", className)}>
      {isConfidential ? <TaskConfidentialWatermark /> : null}

      <div className="flex flex-col gap-2.5 pb-4">
        {parentTask && (
          <button
            type="button"
            className="flex w-fit min-w-0 items-center gap-1.5 rounded-sm text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                params: {
                  workspaceId,
                  projectId: parentTask.projectId,
                  taskId: parentTask.id,
                },
              })
            }
          >
            <ArrowUpRight className="size-3 shrink-0" />
            <span className="shrink-0">{t("tasks:detail.subtaskOf")}</span>
            {parentProject?.slug && parentTask.number != null && (
              <span className="shrink-0 font-mono">
                {parentProject.slug}-{parentTask.number}
              </span>
            )}
            <span className="truncate font-medium text-foreground/80">
              {parentTask.title}
            </span>
          </button>
        )}
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <TaskTitle
              taskId={taskId}
              size={variant === "page" ? "lg" : "md"}
            />
          </div>
          {effectiveConfidentiality !== "publica_interna" ? (
            <ConfidentialityBadge
              level={effectiveConfidentiality}
              size="md"
              className="mt-1.5"
            />
          ) : null}
        </div>
      </div>

      {properties}

      <TaskDescription taskId={taskId} />

      {task ? (
        <OrderClosureCard
          taskId={taskId}
          workspaceId={workspaceId}
          projectId={projectId}
          task={{ ...task, isOrder: task.isOrder ?? undefined }}
        />
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {task && (
          <TaskSubtasks
            taskId={taskId}
            projectId={projectId}
            workspaceId={workspaceId}
            parentStatus={task.status}
          />
        )}
        <TaskRelations
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
        />
        <TaskTimeTracking key={taskId} taskId={taskId} />
        <ExternalLinksAccordion
          taskId={taskId}
          externalLinks={externalLinks as ExternalLink[]}
          isLoading={isLoadingExternalLinks}
        />
      </div>

      <TaskActivity
        taskId={taskId}
        projectId={projectId}
        className="mt-8 border-border border-t pt-6"
      />
    </div>
  );
}

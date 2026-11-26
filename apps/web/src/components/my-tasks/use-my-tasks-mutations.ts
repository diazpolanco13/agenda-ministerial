import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskAssignee from "@/fetchers/task/update-task-assignee";
import updateTaskDueDate from "@/fetchers/task/update-task-due-date";
import updateTaskPriority from "@/fetchers/task/update-task-priority";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import type { AssignedTasks } from "@/fetchers/task/get-assigned-tasks";
import type { DelegatedTasksResponse } from "@/fetchers/task/get-delegated-tasks";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type PatchTaskFields = Partial<{
  status: string;
  statusName: string | null;
  statusIcon: string | null;
  isFinal: boolean;
  priority: string;
  dueDate: string | null;
  userId: string | null;
  assigneeName: string | null;
  assigneeImage: string | null;
  assigneeCedula: string | null;
  assigneeGrado: string | null;
  assigneeComponente: string | null;
  assigneeUnidad: string | null;
}>;

function patchTaskLists(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
  patch: PatchTaskFields,
) {
  const assignedQueries = queryClient.getQueriesData<AssignedTasks>({
    queryKey: ["assigned-tasks"],
  });
  for (const [key, data] of assignedQueries) {
    if (!data?.tasks?.length) continue;
    if (!data.tasks.some((t) => t.id === taskId)) continue;
    queryClient.setQueryData<AssignedTasks>(key, {
      ...data,
      tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    });
  }

  const delegatedQueries = queryClient.getQueriesData<DelegatedTasksResponse>({
    queryKey: ["delegated-tasks"],
  });
  for (const [key, data] of delegatedQueries) {
    if (!data?.tasks?.length) continue;
    if (!data.tasks.some((t) => t.id === taskId)) continue;
    queryClient.setQueryData<DelegatedTasksResponse>(key, {
      ...data,
      tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    });
  }
}

export function useMyTasksMutations() {
  const queryClient = useQueryClient();

  const snapshot = () => ({
    assigned: queryClient.getQueriesData<AssignedTasks>({
      queryKey: ["assigned-tasks"],
    }),
    delegated: queryClient.getQueriesData<DelegatedTasksResponse>({
      queryKey: ["delegated-tasks"],
    }),
  });

  const restore = (ctx?: ReturnType<typeof snapshot>) => {
    if (!ctx) return;
    for (const [key, data] of ctx.assigned) {
      queryClient.setQueryData(key, data);
    }
    for (const [key, data] of ctx.delegated) {
      queryClient.setQueryData(key, data);
    }
  };

  const invalidateAfter = (taskId: string, projectId: string) => {
    invalidateMyWork(queryClient);
    void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const statusMutation = useMutation({
    mutationFn: (vars: {
      taskId: string;
      projectId: string;
      status: string;
      statusName?: string | null;
      statusIcon?: string | null;
      isFinal?: boolean;
    }) => updateTaskStatus(vars.taskId, { status: vars.status }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["assigned-tasks"] });
      await queryClient.cancelQueries({ queryKey: ["delegated-tasks"] });
      const prev = snapshot();
      patchTaskLists(queryClient, vars.taskId, {
        status: vars.status,
        ...(vars.statusName !== undefined ? { statusName: vars.statusName } : {}),
        ...(vars.statusIcon !== undefined ? { statusIcon: vars.statusIcon } : {}),
        ...(vars.isFinal !== undefined ? { isFinal: vars.isFinal } : {}),
      });
      return prev;
    },
    onError: (err, _vars, ctx) => {
      restore(ctx);
      toast.error(
        err instanceof Error ? err.message : "No se pudo actualizar el estado",
      );
    },
    onSettled: (_data, _err, vars) => {
      invalidateAfter(vars.taskId, vars.projectId);
    },
  });

  const priorityMutation = useMutation({
    mutationFn: (vars: {
      taskId: string;
      projectId: string;
      priority: string;
    }) =>
      updateTaskPriority(vars.taskId, {
        id: vars.taskId,
        projectId: vars.projectId,
        priority: vars.priority,
      } as Task),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["assigned-tasks"] });
      await queryClient.cancelQueries({ queryKey: ["delegated-tasks"] });
      const prev = snapshot();
      patchTaskLists(queryClient, vars.taskId, { priority: vars.priority });
      return prev;
    },
    onError: (err, _vars, ctx) => {
      restore(ctx);
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la prioridad",
      );
    },
    onSettled: (_data, _err, vars) => {
      invalidateAfter(vars.taskId, vars.projectId);
    },
  });

  const dueDateMutation = useMutation({
    mutationFn: (vars: {
      taskId: string;
      projectId: string;
      dueDate: string | null;
    }) =>
      updateTaskDueDate(vars.taskId, {
        id: vars.taskId,
        projectId: vars.projectId,
        dueDate: vars.dueDate,
      } as Task),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["assigned-tasks"] });
      await queryClient.cancelQueries({ queryKey: ["delegated-tasks"] });
      const prev = snapshot();
      patchTaskLists(queryClient, vars.taskId, { dueDate: vars.dueDate });
      return prev;
    },
    onError: (err, _vars, ctx) => {
      restore(ctx);
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la fecha límite",
      );
    },
    onSettled: (_data, _err, vars) => {
      invalidateAfter(vars.taskId, vars.projectId);
    },
  });

  const assigneeMutation = useMutation({
    mutationFn: (vars: {
      taskId: string;
      projectId: string;
      userId: string | null;
      assigneeMeta?: Partial<{
        name: string | null;
        image: string | null;
        cedula: string | null;
        grado: string | null;
        componente: string | null;
        unidad: string | null;
      }>;
    }) => updateTaskAssignee(vars.taskId, { userId: vars.userId }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["assigned-tasks"] });
      await queryClient.cancelQueries({ queryKey: ["delegated-tasks"] });
      const prev = snapshot();
      patchTaskLists(queryClient, vars.taskId, {
        userId: vars.userId,
        ...(vars.assigneeMeta
          ? {
              assigneeName: vars.assigneeMeta.name ?? null,
              assigneeImage: vars.assigneeMeta.image ?? null,
              assigneeCedula: vars.assigneeMeta.cedula ?? null,
              assigneeGrado: vars.assigneeMeta.grado ?? null,
              assigneeComponente: vars.assigneeMeta.componente ?? null,
              assigneeUnidad: vars.assigneeMeta.unidad ?? null,
            }
          : {}),
      });
      return prev;
    },
    onError: (err, _vars, ctx) => {
      restore(ctx);
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo reasignar la tarea",
      );
    },
    onSettled: (_data, _err, vars) => {
      invalidateAfter(vars.taskId, vars.projectId);
    },
  });

  return {
    updateStatus: statusMutation.mutateAsync,
    updatePriority: priorityMutation.mutateAsync,
    updateDueDate: dueDateMutation.mutateAsync,
    updateAssignee: assigneeMutation.mutateAsync,
  };
}

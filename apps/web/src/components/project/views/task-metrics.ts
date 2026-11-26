import { differenceInCalendarDays, startOfDay } from "date-fns";
import { isTaskCompleted } from "@/lib/due-date-status";
import { localeCompareSort } from "@/lib/format";
import { parseTaskDate } from "@/lib/task-schedule";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

export type WorkspaceMemberEntry = {
  userId: string;
  role?: string | null;
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

export type PersonInfo = {
  key: string;
  userId: string | null;
  name: string;
  subtitle: string | null;
  image: string | null;
  isAssigned: boolean;
};

export type PersonTaskGroup = {
  person: PersonInfo;
  tasks: Task[];
};

const UNASSIGNED_KEY = "__unassigned__";

export function flattenColumnTasks(
  project: ProjectWithTasks | null | undefined,
): Task[] {
  return project?.columns.flatMap((column) => column.tasks) ?? [];
}

export function resolveTaskAssigneeId(task: Task): string | null {
  return task.userId || task.assigneeId || null;
}

export function isTaskOverdue(
  task: Task,
  columns?: ProjectWithTasks["columns"],
  today: Date = new Date(),
): boolean {
  if (isTaskCompleted(task.status, columns)) return false;
  const due = parseTaskDate(task.dueDate);
  if (!due) return false;
  return differenceInCalendarDays(startOfDay(due), startOfDay(today)) < 0;
}

export function groupTasksByAssignee(
  tasks: ReadonlyArray<Task>,
  members: ReadonlyArray<WorkspaceMemberEntry> | undefined,
  unassignedLabel: string,
): PersonTaskGroup[] {
  const memberById = new Map<string, WorkspaceMemberEntry>();
  for (const member of members ?? []) {
    memberById.set(member.userId, member);
  }

  const groups = new Map<string, PersonTaskGroup>();

  for (const task of tasks) {
    const assigneeId = resolveTaskAssigneeId(task);
    const key = assigneeId ?? UNASSIGNED_KEY;
    const existing = groups.get(key);
    if (existing) {
      existing.tasks.push(task);
      continue;
    }

    if (!assigneeId) {
      groups.set(key, {
        person: {
          key,
          userId: null,
          name: unassignedLabel,
          subtitle: null,
          image: null,
          isAssigned: false,
        },
        tasks: [task],
      });
      continue;
    }

    const member = memberById.get(assigneeId);
    groups.set(key, {
      person: {
        key,
        userId: assigneeId,
        name: member?.user?.name || task.assigneeName || assigneeId,
        subtitle: member?.user?.email || member?.role || null,
        image: member?.user?.image || task.assigneeImage || null,
        isAssigned: true,
      },
      tasks: [task],
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.person.isAssigned !== right.person.isAssigned) {
      return left.person.isAssigned ? -1 : 1;
    }
    if (right.tasks.length !== left.tasks.length) {
      return right.tasks.length - left.tasks.length;
    }
    return localeCompareSort(left.person.name, right.person.name);
  });
}

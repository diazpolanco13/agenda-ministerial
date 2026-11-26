import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

type UpdateTaskJson = InferRequestType<
  (typeof client)["task"][":id"]["$put"]
>["json"];

type UpdateTaskPriority = UpdateTaskJson["priority"];

async function updateTask(taskId: string, task: Task) {
  const payload = {
    userId: task.userId || "",
    title: task.title,
    description: task.descriptionDeferred ? undefined : task.description || "",
    status: task.status,
    // The API validates priority against a picklist that has no empty
    // member, so a task carrying no priority has to be sent as the explicit
    // "no priority" value rather than "". Sending "" rejected the whole
    // update, which is what broke dragging every imported task.
    priority: (task.priority || "no-priority") as UpdateTaskPriority,
    startDate: task.startDate?.toString(),
    dueDate: task.dueDate?.toString(),
    position: task.position ?? 0,
    projectId: task.projectId,
    ...(task.confidentialityLevel
      ? { confidentialityLevel: task.confidentialityLevel }
      : {}),
  } as UpdateTaskJson;

  const response = await client.task[":id"].$put({
    param: { id: taskId },
    json: payload,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default updateTask;

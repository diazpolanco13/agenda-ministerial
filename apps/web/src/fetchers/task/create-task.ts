import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type CreateTaskJson = InferRequestType<
  (typeof client)["task"][":projectId"]["$post"]
>["json"];

export type CreateTaskRequest = CreateTaskJson &
  InferRequestType<(typeof client)["task"][":projectId"]["$post"]>["param"] & {
    confidentialityLevel?: string;
    isOrder?: boolean;
    orderOrigin?: string;
    orderQuote?: string;
  };

async function createTask(
  title: string,
  description: string,
  projectId: string,
  userId: string | undefined,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  priority: CreateTaskRequest["priority"],
  customFields?: { fieldId: string; value: string }[],
  draftAssetIds?: string[],
  recurrence?: CreateTaskRequest["recurrence"],
  confidentialityLevel?: string,
  isOrder?: boolean,
  orderOrigin?: string,
  orderQuote?: string,
) {
  if (!projectId) {
    throw new Error("No project selected for task creation");
  }

  const payload = {
    title,
    description,
    ...(userId ? { userId } : {}),
    status,
    startDate: startDate?.toISOString() || undefined,
    dueDate: dueDate?.toISOString() || undefined,
    priority,
    recurrence,
    customFields,
    draftAssetIds,
    ...(confidentialityLevel ? { confidentialityLevel } : {}),
    ...(isOrder ? { isOrder } : {}),
    ...(orderOrigin ? { orderOrigin } : {}),
    ...(orderQuote ? { orderQuote } : {}),
  } as CreateTaskJson;

  const response = await client.task[":projectId"].$post({
    json: payload,
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default createTask;

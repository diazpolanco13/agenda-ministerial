import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type TaskDetailAggregate = InferResponseType<
  (typeof client)["task"][":id"]["detalle"]["$get"],
  200
>;

export async function getTaskDetail(
  taskId: string,
): Promise<TaskDetailAggregate> {
  const response = await client.task[":id"].detalle.$get({
    param: { id: taskId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getTaskDetail;

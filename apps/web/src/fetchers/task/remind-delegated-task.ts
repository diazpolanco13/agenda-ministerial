import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function remindDelegatedTask(taskId: string, message?: string) {
  const response = await client.task.delegated[":id"].remind.$post({
    param: { id: taskId },
    json: message ? { message } : {},
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

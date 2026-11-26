import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DelegatedTasksResponse = InferResponseType<
  (typeof client)["task"]["delegated"]["$get"],
  200
>;

export type DelegatedTask = DelegatedTasksResponse["tasks"][number];

export async function getDelegatedTasks(
  workspaceId: string,
  options: { includeCompleted?: boolean; allWorkspaces?: boolean } = {},
) {
  const response = await client.task.delegated.$get({
    query: {
      workspaceId,
      includeCompleted: options.includeCompleted === false ? "false" : "true",
      ...(options.allWorkspaces ? { allWorkspaces: "true" } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

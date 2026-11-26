import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type AssignedTasks = InferResponseType<
  (typeof client)["task"]["assigned"]["$get"],
  200
>;

export type AssignedTask = AssignedTasks["tasks"][number];
export type MyTasksKpis = NonNullable<AssignedTasks["kpis"]>;
export type ProjectColumnSummary = NonNullable<
  AssignedTasks["columnsByProject"]
>[string][number];

export type GetAssignedTasksOptions = {
  includeCompleted?: boolean;
  allWorkspaces?: boolean;
};

async function getAssignedTasks(
  workspaceId: string,
  countOnly = false,
  options: GetAssignedTasksOptions = {},
) {
  const response = await client.task.assigned.$get({
    query: {
      workspaceId,
      countOnly: countOnly ? "true" : "false",
      ...(options.includeCompleted ? { includeCompleted: "true" } : {}),
      ...(options.allWorkspaces ? { allWorkspaces: "true" } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getAssignedTasks;

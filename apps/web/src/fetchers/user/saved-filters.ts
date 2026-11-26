import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SavedFilter = InferResponseType<
  (typeof client)["user"]["saved-filters"]["$get"],
  200
>[number];

export async function listSavedFilters(
  workspaceId: string,
  scope?: "my-tasks" | "delegated",
) {
  const response = await client.user["saved-filters"].$get({
    query: {
      workspaceId,
      ...(scope ? { scope } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export async function createSavedFilter(input: {
  workspaceId: string;
  scope: "my-tasks" | "delegated";
  name: string;
  filters: Record<string, unknown>;
}) {
  const response = await client.user["saved-filters"].$post({
    json: input,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export async function deleteSavedFilter(id: string) {
  const response = await client.user["saved-filters"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

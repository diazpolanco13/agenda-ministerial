import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type UpdateProjectJson = InferRequestType<
  (typeof client)["project"][":id"]["$put"]
>["json"];

export type UpdateProjectRequest = UpdateProjectJson &
  InferRequestType<(typeof client)["project"][":id"]["$put"]>["param"] & {
    confidentialityLevel?: string;
  };

async function updateProject({
  id,
  name,
  icon,
  slug,
  description,
  isPublic,
  includeSubtasks,
  confidentialityLevel,
}: UpdateProjectRequest) {
  const payload = {
    name,
    icon,
    slug,
    description,
    isPublic,
    includeSubtasks,
    ...(confidentialityLevel ? { confidentialityLevel } : {}),
  } as UpdateProjectJson;

  const response = await client.project[":id"].$put({
    param: { id },
    json: payload,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default updateProject;

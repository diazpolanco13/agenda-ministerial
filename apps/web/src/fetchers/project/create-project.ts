import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type CreateProjectJson = InferRequestType<
  (typeof client)["project"]["$post"]
>["json"];

export type CreateProjectRequest = CreateProjectJson & {
  confidentialityLevel?: string;
};

async function createProject({
  name,
  slug,
  workspaceId,
  icon,
  confidentialityLevel,
}: CreateProjectRequest) {
  const payload = {
    name,
    slug,
    icon,
    workspaceId,
    ...(confidentialityLevel ? { confidentialityLevel } : {}),
  } as CreateProjectJson;

  const response = await client.project.$post({
    json: payload,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default createProject;

import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function generateTemporaryPassword(userId: string) {
  const response = await client.admin.users[":userId"][
    "temporary-password"
  ].$post({
    param: { userId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function syncSigefanbProfile() {
  const response = await client.user.me["sincronizar-sigefanb"].$post();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

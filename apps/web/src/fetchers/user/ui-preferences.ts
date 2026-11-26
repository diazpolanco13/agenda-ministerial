import { client } from "@kaneo/libs";
import type { AccessibilityPreferences } from "@/lib/accessibility";
import { HttpError } from "@/lib/http-error";

export async function getUiPreferences(): Promise<AccessibilityPreferences> {
  const response = await client.user["ui-preferences"].$get();
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

export async function updateUiPreferences(
  input: Partial<AccessibilityPreferences>,
): Promise<AccessibilityPreferences> {
  const response = await client.user["ui-preferences"].$put({
    json: input,
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}

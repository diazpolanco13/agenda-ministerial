import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export type NtfyEventPreferences = {
  taskAssigned: boolean;
  mentionComment: boolean;
  dueTomorrow: boolean;
  dueToday: boolean;
  overdue: boolean;
  ministerOrder: boolean;
  eventEscalation?: boolean;
  eventDailyBrief?: boolean;
};

export type NtfyStatus = {
  configuredOnServer: boolean;
  enabled: boolean;
  publicUrl: string;
  topic: string | null;
  username: string | null;
  subscribeUrl: string | null;
  appUri: string | null;
  credentialsVersion: number;
  lastTestAt: string | null;
  preferences: NtfyEventPreferences;
};

export type NtfyOneTimeCredentials = {
  serverUrl: string;
  topic: string;
  username: string;
  password: string;
  subscribeUrl: string;
  appUri: string;
};

export type NtfyProvisionResponse = NtfyStatus & {
  credentials: NtfyOneTimeCredentials;
};

async function ntfyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(`/ntfy${path}`), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as T;
}

export function getNtfyStatus(): Promise<NtfyStatus> {
  return ntfyRequest<NtfyStatus>("/status");
}

export function activateNtfy(): Promise<NtfyProvisionResponse> {
  return ntfyRequest<NtfyProvisionResponse>("/activate", { method: "POST" });
}

export function regenerateNtfy(): Promise<NtfyProvisionResponse> {
  return ntfyRequest<NtfyProvisionResponse>("/regenerate", { method: "POST" });
}

export function deactivateNtfy(): Promise<NtfyStatus> {
  return ntfyRequest<NtfyStatus>("/deactivate", { method: "POST" });
}

export function sendNtfyTest(): Promise<{ ok: boolean; sentAt: string }> {
  return ntfyRequest<{ ok: boolean; sentAt: string }>("/test", {
    method: "POST",
  });
}

export function updateNtfyPreferences(
  preferences: Partial<NtfyEventPreferences>,
): Promise<NtfyStatus> {
  return ntfyRequest<NtfyStatus>("/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

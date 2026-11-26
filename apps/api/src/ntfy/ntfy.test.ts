import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createOrReplaceNtfyUser,
  generateNtfyPassword,
  generateNtfyUsername,
  generatePrivateTopic,
  getAgendaPublicUrl,
  publishNtfyMessage,
} from "./client";
import {
  buildPublicTaskClickUrl,
  mapNotificationToAgendaNtfy,
} from "./deliver";

const ALL_ENABLED = {
  eventTaskAssigned: true,
  eventMentionComment: true,
  eventDueTomorrow: true,
  eventDueToday: true,
  eventOverdue: true,
  eventMinisterOrder: true,
};

describe("ntfy helpers and delivery mapping", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NTFY_URL = "http://127.0.0.1:4187";
    process.env.NTFY_PUBLIC_URL = "https://ntfy.mppd.dev";
    process.env.NTFY_ADMIN_USER = "agenda-publicador";
    process.env.NTFY_ADMIN_PASSWORD = "test-admin-password";
    process.env.AGENDA_PUBLIC_URL = "https://agenda.mppd.dev";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("generates private topic, username, and high-entropy password", () => {
    const topic1 = generatePrivateTopic();
    const topic2 = generatePrivateTopic();
    expect(topic1).toMatch(/^agenda-[a-z0-9]{20}$/);
    expect(topic1).not.toBe(topic2);

    const user = generateNtfyUsername("Heo334uvSJ6xILei4n09rkte");
    expect(user).toMatch(/^ag_[a-z0-9]{1,24}$/);

    const pass = generateNtfyPassword();
    expect(pass.length).toBeGreaterThanOrEqual(20);
  });

  it("builds public task click URLs pointing to agenda.mppd.dev", () => {
    expect(getAgendaPublicUrl()).toBe("https://agenda.mppd.dev");
    expect(
      buildPublicTaskClickUrl({
        workspaceId: "ws-1",
        projectId: "proj-1",
        taskId: "task-1",
      }),
    ).toBe("https://agenda.mppd.dev/dashboard/workspace/ws-1/project/proj-1/task/task-1");
  });

  it("maps all 6 institutional events and respects preference toggles", () => {
    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "task_assignee_changed",
          title: null,
          content: null,
          eventData: { taskTitle: "Plan Logístico" },
        },
        ALL_ENABLED,
      ),
    ).toMatchObject({ title: "Tarea asignada", priority: 3, tags: "clipboard" });

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "task_mention",
          title: null,
          content: null,
          eventData: { taskTitle: "Plan Logístico", mentionerName: "G/B Castillo" },
        },
        ALL_ENABLED,
      ),
    ).toMatchObject({
      title: "G/B Castillo te mencionó",
      priority: 4,
      tags: "loudspeaker",
    });

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "due_date_reminder",
          title: null,
          content: null,
          eventData: { taskTitle: "Plan Logístico", reminderType: "due_tomorrow" },
        },
        ALL_ENABLED,
      ),
    ).toMatchObject({ title: "Vence mañana", priority: 3, tags: "calendar" });

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "due_date_reminder",
          title: null,
          content: null,
          eventData: { taskTitle: "Plan Logístico", reminderType: "due_today" },
        },
        ALL_ENABLED,
      ),
    ).toMatchObject({ title: "Vence hoy", priority: 4, tags: "alarm_clock" });

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "due_date_reminder",
          title: null,
          content: null,
          eventData: {
            taskTitle: "Plan Logístico",
            reminderType: "configured_before",
          },
        },
        ALL_ENABLED,
      ),
    ).toBeNull();

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "task_overdue",
          title: null,
          content: null,
          eventData: { taskTitle: "Plan Logístico" },
        },
        ALL_ENABLED,
      ),
    ).toMatchObject({ title: "Tarea vencida", priority: 4, tags: "rotating_light" });

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "minister_order",
          title: null,
          content: null,
          eventData: {
            taskTitle: "Despliegue táctico",
            origenTitulo: "Discurso Anual",
          },
        },
        ALL_ENABLED,
      ),
    ).toMatchObject({
      title: "Orden del Ministro",
      priority: 4,
      tags: "mega,star",
    });

    expect(
      mapNotificationToAgendaNtfy(
        {
          type: "minister_order",
          title: null,
          content: null,
          eventData: { taskTitle: "Despliegue táctico" },
        },
        { ...ALL_ENABLED, eventMinisterOrder: false },
      ),
    ).toBeNull();
  });

  it("provisions user with read-only ACL and publishes UTF-8 RFC 2047 titles", async () => {
    const calls: Array<{ url: string; method: string; body: unknown; headers: Record<string, string> }> = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: init?.body,
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await createOrReplaceNtfyUser("ag_qa1", "secret123456", "agenda-topic123");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[1]?.method).toBe("POST");
    expect(calls[2]?.method).toBe("PUT");
    expect(String(calls[2]?.url)).toContain("/v1/users/access");

    await publishNtfyMessage({
      topic: "agenda-topic123",
      title: "Orden del Ministro — Revisión",
      body: "Cumplir plazo.",
      priority: 4,
      tags: "mega,star",
      clickUrl: "https://agenda.mppd.dev/dashboard",
    });
    const pubCall = calls[3]!;
    expect(pubCall.url).toBe("http://127.0.0.1:4187/agenda-topic123");
    expect(pubCall.headers.Title).toMatch(/^=\?UTF-8\?B\?/);
    expect(pubCall.headers.Priority).toBe("4");
    expect(pubCall.headers.Tags).toBe("mega,star");
    expect(pubCall.headers.Click).toBe("https://agenda.mppd.dev/dashboard");
  });
});

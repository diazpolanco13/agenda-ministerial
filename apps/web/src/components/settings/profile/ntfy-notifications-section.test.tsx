import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { NtfyProvisionResponse, NtfyStatus } from "@/fetchers/ntfy";
import { NtfyNotificationsSection } from "./ntfy-notifications-section";

const m = vi.hoisted(() => ({
  status: {
    configuredOnServer: true,
    enabled: false,
    publicUrl: "https://ntfy.mppd.dev",
    topic: null,
    username: null,
    subscribeUrl: null,
    appUri: null,
    credentialsVersion: 0,
    lastTestAt: null,
    preferences: {
      taskAssigned: true,
      mentionComment: true,
      dueTomorrow: true,
      dueToday: true,
      overdue: true,
      ministerOrder: true,
    },
  } as NtfyStatus,
  activate: vi.fn(),
  regenerate: vi.fn(),
  deactivate: vi.fn(),
  sendTest: vi.fn(),
  updatePrefs: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCKQR"),
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: m.toastSuccess,
    error: m.toastError,
  },
}));

vi.mock("@/hooks/queries/ntfy/use-ntfy", () => ({
  useNtfyStatus: () => ({ data: m.status, isLoading: false }),
  useActivateNtfy: () => ({ mutateAsync: m.activate, isPending: false }),
  useRegenerateNtfy: () => ({ mutateAsync: m.regenerate, isPending: false }),
  useDeactivateNtfy: () => ({ mutateAsync: m.deactivate, isPending: false }),
  useSendNtfyTest: () => ({ mutateAsync: m.sendTest, isPending: false }),
  useUpdateNtfyPreferences: () => ({
    mutateAsync: m.updatePrefs,
    isPending: false,
  }),
}));

describe("NtfyNotificationsSection", () => {
  beforeEach(() => {
    m.status = {
      configuredOnServer: true,
      enabled: false,
      publicUrl: "https://ntfy.mppd.dev",
      topic: null,
      username: null,
      subscribeUrl: null,
      appUri: null,
      credentialsVersion: 0,
      lastTestAt: null,
      preferences: {
        taskAssigned: true,
        mentionComment: true,
        dueTomorrow: true,
        dueToday: true,
        overdue: true,
        ministerOrder: true,
      },
    };
    m.activate.mockReset();
    m.regenerate.mockReset();
    m.deactivate.mockReset();
    m.sendTest.mockReset();
    m.updatePrefs.mockReset();
    m.toastSuccess.mockReset();
    m.toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders inactive state with Activar button and all 6 event switches", () => {
    render(<NtfyNotificationsSection />);
    expect(screen.getByText("Notificaciones móviles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activar" })).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Orden del Ministro (desde discurso)" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Tarea vencida (una vez)" }),
    ).toBeTruthy();
  });

  it("activates ntfy, generates QR, masks password by default, and supports test", async () => {
    const provisioned: NtfyProvisionResponse = {
      configuredOnServer: true,
      enabled: true,
      publicUrl: "https://ntfy.mppd.dev",
      topic: "agenda-abcdefghijklmnop1234",
      username: "ag_qa1",
      subscribeUrl: "https://ntfy.mppd.dev/agenda-abcdefghijklmnop1234",
      appUri: "ntfy://ntfy.mppd.dev/agenda-abcdefghijklmnop1234",
      credentialsVersion: 1,
      lastTestAt: null,
      preferences: { ...m.status.preferences },
      credentials: {
        serverUrl: "https://ntfy.mppd.dev",
        topic: "agenda-abcdefghijklmnop1234",
        username: "ag_qa1",
        password: "super-secret-pass-value",
        subscribeUrl: "https://ntfy.mppd.dev/agenda-abcdefghijklmnop1234",
        appUri: "ntfy://ntfy.mppd.dev/agenda-abcdefghijklmnop1234",
      },
    };
    m.activate.mockImplementation(async () => {
      const { credentials: _c, ...rest } = provisioned;
      m.status = rest;
      return provisioned;
    });
    m.sendTest.mockResolvedValue({ ok: true, sentAt: new Date().toISOString() });

    const view = render(<NtfyNotificationsSection />);
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(m.activate).toHaveBeenCalledTimes(1));

    view.rerender(<NtfyNotificationsSection />);

    await waitFor(() => {
      const qr = screen.getByAltText("Código QR para suscribirse en ntfy");
      expect(qr).toHaveAttribute("src", "data:image/png;base64,MOCKQR");
    });

    const pwdNode = screen.getByTestId("ntfy-onetime-password");
    expect(pwdNode.textContent).toBe("••••••••••••••••");
    expect(screen.queryByText("super-secret-pass-value")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(pwdNode.textContent).toBe("super-secret-pass-value");

    fireEvent.click(screen.getByRole("button", { name: "Enviar prueba" }));
    await waitFor(() => expect(m.sendTest).toHaveBeenCalledTimes(1));
  });
});

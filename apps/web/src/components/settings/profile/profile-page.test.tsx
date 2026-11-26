import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { CurrentUserProfile, MilitarProfile } from "@/types/user";
import { ProfilePage } from "./profile-page";

const m = vi.hoisted(() => ({
  syncMutate: vi.fn(),
  syncPending: false,
  permissions: [] as string[],
  currentUser: undefined as CurrentUserProfile | undefined,
  authUser: {
    id: "user-1",
    name: "Carlos Díaz",
    email: "carlos@mppd.gob.ve",
    image: null as string | null,
    role: "responsable" as string | null,
    militar: null as MilitarProfile | null,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      resolvedLanguage: "es-VE",
      language: "es-VE",
      changeLanguage: vi.fn(),
    },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: m.authUser, refetchUser: vi.fn() }),
}));

vi.mock("@/hooks/queries/user/use-current-user", () => ({
  useCurrentUser: () => ({ data: m.currentUser, isLoading: false }),
  useSyncSigefanbProfile: () => ({
    mutate: m.syncMutate,
    isPending: m.syncPending,
  }),
  default: () => ({ data: m.currentUser, isLoading: false }),
}));

vi.mock("@/hooks/queries/admin/use-admin-access", () => ({
  default: () => ({
    permissions: m.permissions,
    can: (permission: string) => m.permissions.includes(permission),
  }),
}));

vi.mock("@/hooks/queries/user/use-managed-profile-fields", () => ({
  default: () => [],
}));

vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ locale: "es", setLocale: vi.fn() }),
}));

vi.mock(
  "@/components/account/change-password/change-password-settings",
  () => ({
    ChangePasswordSettings: () => (
      <div data-testid="change-password-settings">Cambio de contraseña</div>
    ),
  }),
);

vi.mock("@/components/account/sessions/active-sessions-settings", () => ({
  ActiveSessionsSettings: () => (
    <div data-testid="active-sessions-settings">Sesiones activas</div>
  ),
}));

vi.mock("@/components/sigefanb/sigefanb-person-search", () => ({
  SigefanbPersonSearch: () => (
    <div data-testid="sigefanb-person-search">Buscador SIGEFANB</div>
  ),
}));

const MILITAR_FIXTURE: MilitarProfile = {
  cedula: "12345678",
  nacionalidad: "V",
  grado: "General de Brigada",
  componente: "EJB",
  unidad: "Dirección General de Despacho",
  sexo: "M",
  insignia: null,
  fotoUrl: "/api/sigefanb/foto/12345678",
  pendiente: false,
  sincronizadoEn: "2026-11-25T10:30:00.000Z",
};

describe("ProfilePage (Ficha Militar)", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    m.syncMutate.mockReset();
    m.syncPending = false;
    m.permissions = [];
    m.authUser = {
      id: "user-1",
      name: "Carlos Díaz",
      email: "carlos@mppd.gob.ve",
      image: null,
      role: "ministro",
      militar: null,
    };
    m.currentUser = undefined;
  });

  it("renders the military header, read-only SIGEFANB fields, AGENDA preferences, and security section", () => {
    m.currentUser = {
      id: "user-1",
      name: "Carlos Díaz",
      email: "carlos@mppd.gob.ve",
      image: null,
      role: "ministro",
      managedProfileFields: [],
      militar: MILITAR_FIXTURE,
    };

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "Ficha Militar" })).toBeTruthy();
    expect(screen.getByText("Carlos Díaz")).toBeTruthy();
    expect(screen.getAllByText("Oficial General").length).toBeGreaterThan(0);
    expect(screen.getAllByText("V-12.***.678").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
    expect(screen.getByText("Ministro")).toBeTruthy();
    expect(screen.getAllByText("Ejército Bolivariano").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText("Dirección General de Despacho").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("G/B")).toBeTruthy();

    // No editable inputs for military fields
    expect(screen.queryByRole("textbox")).toBeNull();

    // Sync button calls mutation
    fireEvent.click(
      screen.getByRole("button", { name: "Sincronizar con SIGEFANB" }),
    );
    expect(m.syncMutate).toHaveBeenCalledTimes(1);

    // AGENDA preferences and security sections
    expect(screen.getByText("Preferencias de AGENDA")).toBeTruthy();
    expect(screen.getByText("Zona horaria")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Configurar notificaciones/i }),
    ).toHaveAttribute("href", "/dashboard/settings/account/notifications");
    expect(screen.getByTestId("change-password-settings")).toBeTruthy();
    expect(screen.getByTestId("active-sessions-settings")).toBeTruthy();
  });

  it("shows a DEMO preview when a QA/demo account has no linked cedula", () => {
    m.authUser.email = "qa@agenda.mppd.dev";
    m.currentUser = {
      id: "qa-1",
      name: "Usuario QA",
      email: "qa@agenda.mppd.dev",
      image: null,
      role: "responsable",
      managedProfileFields: [],
      militar: null,
    };

    render(<ProfilePage />);

    expect(screen.getAllByText("DEMO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("V-00.***.000 (DEMO)").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByRole("button", { name: "Vincular cédula" }),
    ).toBeNull();
  });

  it("persists timezone selection and renders theme options in AGENDA preferences", () => {
    m.currentUser = {
      id: "user-1",
      name: "Carlos Díaz",
      email: "carlos@mppd.gob.ve",
      image: null,
      role: "ministro",
      managedProfileFields: [],
      militar: MILITAR_FIXTURE,
    };

    render(<ProfilePage />);

    const timezoneTrigger = screen.getByRole("combobox", {
      name: "Zona horaria",
    });
    expect(timezoneTrigger).toHaveTextContent("America/Caracas (UTC-4)");
    fireEvent.click(timezoneTrigger);
    const utcOption = screen.getByRole("option", { name: "UTC (UTC+0)" });
    fireEvent.pointerDown(utcOption);
    fireEvent.click(utcOption);

    expect(window.localStorage.getItem("agenda.timezone")).toBe("UTC");
  });

  it("allows admins without linked cedula to open the SIGEFANB search dialog", () => {
    m.permissions = ["users:update"];
    m.currentUser = {
      id: "admin-1",
      name: "Admin Despacho",
      email: "admin@mppd.gob.ve",
      image: null,
      role: "admin",
      managedProfileFields: [],
      militar: null,
    };

    render(<ProfilePage />);

    expect(screen.getByText("Sin cédula SIGEFANB vinculada")).toBeTruthy();
    const linkButton = screen.getByRole("button", { name: "Vincular cédula" });
    fireEvent.click(linkButton);

    expect(screen.getByText("Vincular cédula desde SIGEFANB")).toBeTruthy();
    expect(screen.getByTestId("sigefanb-person-search")).toBeTruthy();
  });

  it("guides non-admin users without linked cedula to request linking", () => {
    m.permissions = [];
    m.currentUser = {
      id: "user-2",
      name: "Analista Despacho",
      email: "analista@mppd.gob.ve",
      image: null,
      role: "responsable",
      managedProfileFields: [],
      militar: null,
    };

    render(<ProfilePage />);

    expect(
      screen.getByText(
        /Solicita la vinculación de tu cédula al Administrador/i,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Vincular cédula" }),
    ).toBeNull();
  });
});

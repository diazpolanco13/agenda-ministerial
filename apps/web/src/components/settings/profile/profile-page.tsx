import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { ChangePasswordSettings } from "@/components/account/change-password/change-password-settings";
import { ActiveSessionsSettings } from "@/components/account/sessions/active-sessions-settings";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { AgendaPreferencesSection } from "@/components/settings/profile/agenda-preferences-section";
import { MilitaryProfileHeader } from "@/components/settings/profile/military-profile-header";
import { isDemoUserEmail } from "@/components/settings/profile/military-profile-helpers";
import { SigefanbReadonlySection } from "@/components/settings/profile/sigefanb-readonly-section";
import { SettingsPage } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/queries/user/use-current-user";

export function ProfilePage() {
  const { user } = useAuth();
  const { data: currentUser, isLoading } = useCurrentUser();

  const resolvedUser = currentUser ?? user ?? null;
  const militar = currentUser?.militar ?? user?.militar ?? null;
  const isDemo = !militar && isDemoUserEmail(resolvedUser?.email);

  return (
    <>
      <PageTitle title="Ficha Militar" />
      <SettingsPage
        title="Ficha Militar"
        description="Identidad institucional sincronizada desde SIGEFANB, preferencias de AGENDA y seguridad de acceso."
      >
        <MilitaryProfileHeader
          user={resolvedUser}
          militar={militar}
          isDemo={isDemo}
          isLoading={isLoading && !resolvedUser}
        />

        <SigefanbReadonlySection
          militar={militar}
          userRole={resolvedUser?.role}
          isDemo={isDemo}
          isLoading={isLoading && !currentUser}
        />

        <AgendaPreferencesSection />

        <div className="space-y-6 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Seguridad
              </h2>
              <p className="text-xs text-muted-foreground">
                Contraseña de acceso y sesiones activas de tu cuenta.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              render={<Link to="/dashboard/settings/account/security" />}
            >
              Vista completa de seguridad
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>

          <ChangePasswordSettings />
          <ActiveSessionsSettings />
        </div>
      </SettingsPage>
    </>
  );
}

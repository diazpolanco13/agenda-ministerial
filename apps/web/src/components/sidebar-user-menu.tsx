import { useNavigate } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  LogOut,
  LogOutIcon,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import useSignOut from "@/hooks/mutations/use-sign-out";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { useCurrentUser } from "@/hooks/queries/user/use-current-user";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { abbreviateMilitaryRank, maskCedula } from "@/lib/military-assets";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

const THEME_OPTIONS = [
  { id: "light", icon: Sun, labelKey: "navigation:userMenu.themeLight", fallback: "Claro" },
  { id: "dark", icon: Moon, labelKey: "navigation:userMenu.themeDark", fallback: "Oscuro" },
  { id: "system", icon: Monitor, labelKey: "navigation:userMenu.themeSystem", fallback: "Sistema" },
] as const;

export function SidebarUserMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const { data: config } = useGetConfig();
  const { canInviteUsers } = useWorkspacePermission();
  const { theme, setTheme } = useUserPreferencesStore();
  const { mutateAsync: signOut, isPending } = useSignOut(
    config?.customOAuthLogoutUrl,
  );
  const { setProject } = useProjectStore();
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      setProject(undefined);
      toast.success(t("navigation:userMenu.signedOutSuccess"), {
        icon: LogOutIcon,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("navigation:userMenu.signOutFailed"),
      );
    }
  };

  useShortcut("logOut", () => void handleSignOut(), { enabled: Boolean(user) });

  if (!user) {
    return null;
  }

  const militar = currentUser?.militar ?? null;
  const displayName =
    currentUser?.name || user.name || t("navigation:userMenu.unnamedUser");
  const displayImage = currentUser?.image ?? user.image ?? null;
  const rankAbbr = abbreviateMilitaryRank(militar?.grado);
  const maskedCedula = militar?.cedula
    ? maskCedula(militar.cedula, militar.nacionalidad)
    : null;
  const secondaryFooterLine = rankAbbr ?? user.email ?? "";
  const identityDetail = maskedCedula || user.email || "";

  const goTo = (
    to:
      | "/dashboard/settings/account/information"
      | "/dashboard/settings/account/preferences",
  ) => {
    setOpenMobile(false);
    navigate({ to });
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  tooltip={displayName}
                  aria-label={displayName}
                  className="h-10 rounded-lg px-2 hover:bg-sidebar-accent/70 data-popup-open:bg-sidebar-accent group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                />
              }
            >
              <ResponsableAvatar
                userId={user.id}
                name={displayName}
                image={displayImage}
                cedula={militar?.cedula}
                nacionalidad={militar?.nacionalidad}
                grado={militar?.grado}
                componente={militar?.componente}
                unidad={militar?.unidad}
                size="sm"
                className="size-7"
              />
              <div className="min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {displayName}
                </p>
                {secondaryFooterLine ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {secondaryFooterLine}
                  </p>
                ) : null}
              </div>
              <ChevronsUpDown
                className="ml-auto size-3.5 shrink-0 text-muted-foreground/70 group-data-[collapsible=icon]:hidden"
                aria-hidden="true"
              />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-60 p-1"
            >
              <div className="flex items-center gap-2.5 px-2 py-2">
                <ResponsableAvatar
                  userId={user.id}
                  name={displayName}
                  image={displayImage}
                  cedula={militar?.cedula}
                  nacionalidad={militar?.nacionalidad}
                  grado={militar?.grado}
                  componente={militar?.componente}
                  unidad={militar?.unidad}
                  size="md"
                  className="size-8"
                />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium text-foreground">
                    {displayName}
                  </p>
                  {militar?.grado ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {militar.grado}
                    </p>
                  ) : null}
                  {identityDetail ? (
                    <p className="truncate text-[11px] text-muted-foreground/80 tabular-nums">
                      {identityDetail}
                    </p>
                  ) : null}
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => goTo("/dashboard/settings/account/information")}
                className="gap-2"
              >
                <User className="size-4" aria-hidden="true" />
                <span>
                  {t("navigation:userMenu.myProfile", {
                    defaultValue: "Mi perfil",
                  })}
                </span>
              </DropdownMenuItem>

              {canInviteUsers() ? (
                <DropdownMenuItem
                  onClick={() => {
                    setOpenMobile(false);
                    setIsInviteOpen(true);
                  }}
                  className="gap-2"
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  <span>{t("navigation:sidebar.invitePeople")}</span>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem
                onClick={() => goTo("/dashboard/settings/account/preferences")}
                className="gap-2"
              >
                <Settings className="size-4" aria-hidden="true" />
                <span>{t("navigation:userMenu.settings")}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <div className="px-1.5 py-1">
                <div
                  role="group"
                  aria-label={t("navigation:userMenu.theme", {
                    defaultValue: "Tema",
                  })}
                  className="grid grid-cols-3 gap-0.5 rounded-md bg-muted/70 p-0.5"
                >
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = theme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={(event) => {
                          event.stopPropagation();
                          setTheme(option.id);
                        }}
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-[5px] px-1.5 py-1 text-[11px] font-medium transition-colors",
                          active
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3" aria-hidden="true" />
                        <span>
                          {t(option.labelKey, { defaultValue: option.fallback })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                variant="destructive"
                onClick={handleSignOut}
                disabled={isPending}
                className="gap-2"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>
                  {isPending
                    ? t("navigation:userMenu.signingOut")
                    : t("navigation:userMenu.logOut")}
                </span>
              </DropdownMenuItem>

              <div className="px-2 pt-1 pb-0.5 text-[10px] text-muted-foreground/60 tabular-nums">
                SIGEFANB · Agenda v{__APP_VERSION__}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <InviteTeamMemberModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </>
  );
}

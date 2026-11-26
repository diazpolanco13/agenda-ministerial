import {
  BadgeCheckIcon,
  BanIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  PencilIcon,
  ShieldPlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResponsableAvatar } from "@/components/responsable-avatar";
import {
  type RowAction,
  RowActionsMenu,
} from "@/components/settings/row-actions-menu";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { rankInsignia } from "@/lib/military-assets";
import type { InstancePermission } from "@kaneo/permissions";
import { getPrimaryInstanceRole } from "./get-primary-instance-role";
import { getUserActionTypes } from "./get-user-action-types";
import type { UserActionType } from "./pending-user-action";
import { USER_ACTION_COPY } from "./user-action-copy";
import { USER_DIRECTORY_COLUMNS } from "./user-directory-columns";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatus } from "./user-status";

const ACTION_ICONS: Record<UserActionType, LucideIcon> = {
  generateTemporaryPassword: ShieldPlusIcon,
  sendPasswordReset: KeyRoundIcon,
  sendVerification: MailIcon,
  markEmailVerified: BadgeCheckIcon,
  deactivate: BanIcon,
  reactivate: CheckCircle2Icon,
  delete: Trash2Icon,
};

type UserDirectoryRowProps = {
  user: AdminUser;
  isSelf: boolean;
  canSendPasswordReset: boolean;
  /** The viewer's instance permissions. */
  permissions: readonly InstancePermission[];
  /** False when the user holds permissions the viewer lacks. */
  canManage: boolean;
  onEdit: () => void;
  onAction: (type: UserActionType) => void;
  onOpenSecurity: () => void;
};

const CELL_CLASS = "hidden shrink-0 sm:flex";

export function UserDirectoryRow({
  user,
  isSelf,
  canSendPasswordReset,
  permissions,
  canManage,
  onEdit,
  onOpenSecurity,
  onAction,
}: UserDirectoryRowProps) {
  const { t } = useTranslation();
  const role = getPrimaryInstanceRole(user.role);
  const isDeactivated = user.banned === true;
  const isPending = user.pendiente === true;
  const cedulaLabel = user.cedula
    ? `${user.nacionalidad === "E" ? "E" : "V"}-${user.cedula}`
    : null;
  const insignia = user.grado
    ? rankInsignia(user.grado, user.componente, user.unidad)
    : null;

  const can = (permission: InstancePermission) =>
    canManage && permissions.includes(permission);

  const actions: RowAction[] = [
    ...(can("users:update")
      ? [
          {
            id: "edit",
            label: t("settings:adminUsers.actions.edit"),
            icon: PencilIcon,
            onSelect: onEdit,
          },
        ]
      : []),
    ...(can("users:sessions") || can("users:api_keys")
      ? [
          {
            id: "security",
            label: t("settings:adminUsers.actions.security"),
            icon: MonitorSmartphoneIcon,
            onSelect: onOpenSecurity,
          },
        ]
      : []),
    ...(canManage
      ? getUserActionTypes(user, {
          isSelf,
          canSendPasswordReset,
          permissions,
        })
      : []
    ).map((type) => {
      const copy = USER_ACTION_COPY[type];
      return {
        id: type,
        label: copy.menuDefault
          ? t(copy.menu, { defaultValue: copy.menuDefault })
          : t(copy.menu),
        icon: ACTION_ICONS[type],
        destructive: type === "delete",
        onSelect: () => onAction(type),
      };
    }),
  ];

  return (
    <div role="row" className="flex items-center gap-4 px-4 py-3">
      <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
        <ResponsableAvatar
          userId={user.id}
          name={user.name}
          image={user.image}
          cedula={user.cedula}
          nacionalidad={user.nacionalidad}
          grado={user.grado}
          componente={user.componente}
          unidad={user.unidad}
          size="sm"
          className="size-8"
          showHoverCard={Boolean(user.cedula)}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{user.name}</span>
            {isSelf ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("settings:adminUsers.you")}
              </span>
            ) : null}
          </div>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{user.email}</span>
            {user.emailVerified || isPending ? null : (
              <span className="shrink-0 text-warning-foreground">
                {t("settings:adminUsers.unverified")}
              </span>
            )}
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
            {cedulaLabel ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {cedulaLabel}
              </span>
            ) : null}
            <UserRoleBadge role={role} />
            <UserStatus isDeactivated={isDeactivated} isPending={isPending} />
          </div>
        </div>
      </div>

      <div
        role="cell"
        className={cn(
          "hidden shrink-0 md:flex items-center font-mono text-xs text-muted-foreground",
          USER_DIRECTORY_COLUMNS.cedula,
        )}
      >
        {cedulaLabel ?? "—"}
      </div>

      <div
        role="cell"
        className={cn(
          "hidden shrink-0 lg:flex items-center gap-1.5 min-w-0",
          USER_DIRECTORY_COLUMNS.grado,
        )}
      >
        {user.grado ? (
          <>
            {insignia ? (
              <img
                src={insignia.src}
                alt={insignia.name}
                className={cn(
                  "shrink-0 object-contain",
                  insignia.shape === "vertical" ? "h-4.5 w-auto" : "h-3 w-auto",
                )}
              />
            ) : null}
            <span className="truncate text-xs text-foreground">
              {user.grado}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div role="cell" className={cn(CELL_CLASS, USER_DIRECTORY_COLUMNS.role)}>
        <UserRoleBadge role={role} />
      </div>

      <div
        role="cell"
        className={cn(CELL_CLASS, USER_DIRECTORY_COLUMNS.status)}
      >
        <UserStatus isDeactivated={isDeactivated} isPending={isPending} />
      </div>

      <div
        role="cell"
        className={cn(
          "hidden shrink-0 xl:flex",
          USER_DIRECTORY_COLUMNS.lastActive,
          "text-[13px] text-muted-foreground tabular-nums",
        )}
      >
        {user.lastActiveAt ? (
          <time
            dateTime={user.lastActiveAt}
            title={formatDateTime(user.lastActiveAt)}
            className="truncate"
          >
            {formatRelativeTime(user.lastActiveAt)}
          </time>
        ) : (
          t("settings:adminUsers.never")
        )}
      </div>

      <div
        role="cell"
        className={cn(
          "flex shrink-0 justify-end",
          USER_DIRECTORY_COLUMNS.actions,
        )}
      >
        {actions.length > 0 ? (
          <RowActionsMenu
            label={t("settings:adminUsers.actions.open", { name: user.name })}
            actions={actions}
          />
        ) : null}
      </div>
    </div>
  );
}

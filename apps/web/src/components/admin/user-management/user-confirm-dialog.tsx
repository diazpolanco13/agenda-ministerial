import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useDeleteAdminUser from "@/hooks/mutations/admin/use-delete-admin-user";
import useGenerateTemporaryPassword from "@/hooks/mutations/admin/use-generate-temporary-password";
import useMarkAdminUserEmailVerified from "@/hooks/mutations/admin/use-mark-admin-user-email-verified";
import useSendAdminUserPasswordReset from "@/hooks/mutations/admin/use-send-admin-user-password-reset";
import useSendAdminUserVerificationEmail from "@/hooks/mutations/admin/use-send-admin-user-verification-email";
import useToggleAdminUserStatus from "@/hooks/mutations/admin/use-toggle-admin-user-status";
import type { PendingUserAction } from "./pending-user-action";
import type { TemporaryPasswordPayload } from "./temporary-password-dialog";
import { USER_ACTION_COPY } from "./user-action-copy";

type UserConfirmDialogProps = {
  action: PendingUserAction | null;
  onClose: () => void;
  onTemporaryPassword?: (payload: TemporaryPasswordPayload) => void;
};

export function UserConfirmDialog({
  action,
  onClose,
  onTemporaryPassword,
}: UserConfirmDialogProps) {
  const { t } = useTranslation();
  const [shownAction, setShownAction] = useState(action);
  const toggleStatus = useToggleAdminUserStatus();
  const deleteUser = useDeleteAdminUser();
  const generateTempPassword = useGenerateTemporaryPassword();
  const sendPasswordReset = useSendAdminUserPasswordReset();
  const sendVerification = useSendAdminUserVerificationEmail();
  const markEmailVerified = useMarkAdminUserEmailVerified();
  const isPending = [
    toggleStatus,
    deleteUser,
    generateTempPassword,
    sendPasswordReset,
    sendVerification,
    markEmailVerified,
  ].some((mutation) => mutation.isPending);

  if (action && action !== shownAction) {
    setShownAction(action);
  }

  const run = async ({ type, user }: PendingUserAction) => {
    switch (type) {
      case "generateTemporaryPassword": {
        const result = await generateTempPassword.mutateAsync(user.id);
        onTemporaryPassword?.({
          userName: user.name,
          identifier: user.cedula
            ? `${user.nacionalidad === "E" ? "E" : "V"}-${user.cedula}`
            : user.email,
          temporaryPassword: result.temporaryPassword,
        });
        return;
      }
      case "delete":
        return deleteUser.mutateAsync(user.id);
      case "deactivate":
      case "reactivate":
        return toggleStatus.mutateAsync({
          userId: user.id,
          deactivate: type === "deactivate",
        });
      case "sendPasswordReset":
        return sendPasswordReset.mutateAsync(user);
      case "sendVerification":
        return sendVerification.mutateAsync(user);
      case "markEmailVerified":
        return markEmailVerified.mutateAsync(user);
    }
  };

  const handleConfirm = async () => {
    if (!action) return;
    try {
      await run(action);
      onClose();
    } catch {
      return;
    }
  };

  const copy = USER_ACTION_COPY[shownAction?.type ?? "delete"];
  const values = {
    name: shownAction?.user.name ?? "",
    email: shownAction?.user.email ?? "",
  };

  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      title={
        copy.titleDefault
          ? t(copy.title, { defaultValue: copy.titleDefault })
          : t(copy.title)
      }
      description={
        copy.description
          ? copy.descriptionDefault
            ? t(copy.description, {
                ...values,
                defaultValue: copy.descriptionDefault,
              })
            : t(copy.description, values)
          : undefined
      }
      confirmLabel={
        copy.actionDefault
          ? t(copy.action, { defaultValue: copy.actionDefault })
          : t(copy.action)
      }
      pendingLabel={t("settings:adminUsers.confirm.working")}
      pending={isPending}
      destructive={copy.destructive}
      onConfirm={handleConfirm}
    />
  );
}

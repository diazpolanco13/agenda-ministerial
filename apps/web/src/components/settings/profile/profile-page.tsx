import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { DeleteAccountSection } from "@/components/settings/profile/delete-account-section";
import { NtfyNotificationsPlaceholder } from "@/components/settings/profile/ntfy-notifications-placeholder";
import { ProfileDetailsSection } from "@/components/settings/profile/profile-details-section";
import { SigefanbProfileCard } from "@/components/settings/profile/sigefanb-profile-card";
import { useProfileNameAutosave } from "@/components/settings/profile/use-profile-name-autosave";
import { SettingsPage } from "@/components/settings/settings-page";
import useManagedProfileFields from "@/hooks/queries/user/use-managed-profile-fields";

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, refetchUser } = useAuth();
  const form = useProfileNameAutosave({ name: user?.name, refetchUser });
  const managedFields = useManagedProfileFields();

  return (
    <>
      <PageTitle title={t("settings:informationPage.pageTitle")} />
      <SettingsPage
        title={t("settings:informationPage.title")}
        description={t("settings:informationPage.subtitle")}
        actions={<AutosaveNote />}
      >
        <SigefanbProfileCard />
        <ProfileDetailsSection
          form={form}
          user={user ?? undefined}
          refetchUser={refetchUser}
          managedFields={managedFields}
        />
        <NtfyNotificationsPlaceholder />
        <DeleteAccountSection email={user?.email} />
      </SettingsPage>
    </>
  );
}

import {
  INSTITUTIONAL_ROLE_LABELS,
  isInstitutionalRole,
} from "@kaneo/permissions";
import { useTranslation } from "react-i18next";

/** Roles institucionales en español y roles integrados traducidos. */
export function useInstanceRoleLabel() {
  const { t } = useTranslation();
  return (role: string) => {
    if (role === "admin") {
      return t("settings:adminUsers.roles.admin");
    }
    if (role === "user") {
      return t("settings:adminUsers.roles.user");
    }
    if (isInstitutionalRole(role)) {
      return INSTITUTIONAL_ROLE_LABELS[role];
    }
    return role;
  };
}

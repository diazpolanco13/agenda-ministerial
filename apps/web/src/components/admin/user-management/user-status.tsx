import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type UserStatusProps = {
  isDeactivated: boolean;
  isPending?: boolean;
};

export function UserStatus({
  isDeactivated,
  isPending = false,
}: UserStatusProps) {
  const { t } = useTranslation();

  const dotClass = isDeactivated
    ? "bg-muted-foreground"
    : isPending
      ? "bg-amber-500"
      : "bg-success";

  const label = isDeactivated
    ? t("settings:adminUsers.status.deactivated")
    : isPending
      ? t("settings:adminUsers.status.pending", { defaultValue: "Pendiente" })
      : t("settings:adminUsers.status.active");

  return (
    <span className="flex items-center gap-1.5 text-[13px]">
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", dotClass)}
      />
      <span
        className={isDeactivated ? "text-muted-foreground" : "text-foreground"}
      >
        {label}
      </span>
    </span>
  );
}

import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";

export type UserActionType =
  | "generateTemporaryPassword"
  | "sendPasswordReset"
  | "sendVerification"
  | "markEmailVerified"
  | "deactivate"
  | "reactivate"
  | "delete";

export type PendingUserAction = {
  type: UserActionType;
  user: AdminUser;
};

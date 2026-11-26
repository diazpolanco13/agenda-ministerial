import type { UserActionType } from "./pending-user-action";

type ActionCopy = {
  menu: string;
  menuDefault?: string;
  title: string;
  titleDefault?: string;
  description?: string;
  descriptionDefault?: string;
  action: string;
  actionDefault?: string;
  destructive: boolean;
};

export const USER_ACTION_COPY: Record<UserActionType, ActionCopy> = {
  generateTemporaryPassword: {
    menu: "settings:adminUsers.actions.generateTemporaryPassword",
    menuDefault: "Generar contraseña temporal",
    title: "settings:adminUsers.confirm.generateTemporaryPassword.title",
    titleDefault: "¿Generar contraseña temporal?",
    description:
      "settings:adminUsers.confirm.generateTemporaryPassword.description",
    descriptionDefault:
      "Se generará una nueva contraseña temporal para {{name}}, se cerrarán sus sesiones activas y se mostrará una sola vez.",
    action: "settings:adminUsers.confirm.generateTemporaryPassword.action",
    actionDefault: "Generar contraseña",
    destructive: false,
  },
  sendPasswordReset: {
    menu: "settings:adminUsers.actions.sendPasswordReset",
    title: "settings:adminUsers.confirm.sendPasswordReset.title",
    action: "settings:adminUsers.confirm.sendPasswordReset.action",
    destructive: false,
  },
  sendVerification: {
    menu: "settings:adminUsers.actions.sendVerification",
    title: "settings:adminUsers.confirm.sendVerification.title",
    action: "settings:adminUsers.confirm.sendVerification.action",
    destructive: false,
  },
  markEmailVerified: {
    menu: "settings:adminUsers.actions.markEmailVerified",
    title: "settings:adminUsers.confirm.markEmailVerified.title",
    action: "settings:adminUsers.confirm.markEmailVerified.action",
    destructive: false,
  },
  deactivate: {
    menu: "settings:adminUsers.actions.deactivate",
    title: "settings:adminUsers.confirm.deactivate.title",
    description: "settings:adminUsers.confirm.deactivate.description",
    action: "settings:adminUsers.confirm.deactivate.action",
    destructive: true,
  },
  reactivate: {
    menu: "settings:adminUsers.actions.reactivate",
    title: "settings:adminUsers.confirm.reactivate.title",
    description: "settings:adminUsers.confirm.reactivate.description",
    action: "settings:adminUsers.confirm.reactivate.action",
    destructive: false,
  },
  delete: {
    menu: "common:actions.delete",
    title: "settings:adminUsers.confirm.delete.title",
    description: "settings:adminUsers.confirm.delete.description",
    action: "settings:adminUsers.confirm.delete.action",
    destructive: true,
  },
};

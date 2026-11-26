export const DEFAULT_INSTANCE_NAME = "Kaneo";

/** What the `instance_settings` row holds, with defaults for a missing row. */
export type StoredInstanceSettings = {
  instanceName: string | null;
  registrationEnabled: boolean;
  passwordRegistrationEnabled: boolean;
  requireEmailVerification: boolean;
  /** Custom role name, or `user` when no default role is set. */
  defaultRole: string;
  workspaceCreationRestricted: boolean;
  disabledIntegrations: string[];
};

/** Settings an environment variable can force. */
export type EnvLockedSetting =
  | "registrationEnabled"
  | "passwordRegistrationEnabled"
  | "workspaceCreationRestricted";

export type InstanceSettings = Omit<StoredInstanceSettings, "instanceName"> & {
  instanceName: string;
  /** Settings forced by an environment variable, which wins over the database. */
  lockedByEnv: EnvLockedSetting[];
};

export const DEFAULT_STORED_SETTINGS: StoredInstanceSettings = {
  instanceName: null,
  registrationEnabled: true,
  passwordRegistrationEnabled: true,
  requireEmailVerification: false,
  defaultRole: "user",
  workspaceCreationRestricted: false,
  disabledIntegrations: [],
};

type Env = Record<string, string | undefined>;

function parseDisabledIntegrationsEnv(
  raw: string | undefined,
): string[] | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "none") return [];
  return trimmed
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Apply environment overrides. Only `"true"` locks a setting: deployments that
 * set these variables to `"false"` keep the database value.
 */
export function resolveInstanceSettings(
  stored: StoredInstanceSettings,
  env: Env,
): InstanceSettings {
  const registrationLocked = env.DISABLE_REGISTRATION === "true";
  const passwordLocked = env.DISABLE_PASSWORD_REGISTRATION === "true";
  const workspaceLocked = env.DISABLE_WORKSPACE_CREATION === "true";
  const lockedByEnv: EnvLockedSetting[] = [];
  if (registrationLocked) lockedByEnv.push("registrationEnabled");
  if (passwordLocked) lockedByEnv.push("passwordRegistrationEnabled");
  if (workspaceLocked) lockedByEnv.push("workspaceCreationRestricted");

  const envDisabled = parseDisabledIntegrationsEnv(
    env.AGENDA_DISABLE_INTEGRATIONS,
  );
  const disabledIntegrations =
    envDisabled === null
      ? stored.disabledIntegrations
      : [...new Set([...stored.disabledIntegrations, ...envDisabled])].sort();

  return {
    ...stored,
    disabledIntegrations,
    instanceName: stored.instanceName?.trim() || DEFAULT_INSTANCE_NAME,
    registrationEnabled: registrationLocked
      ? false
      : stored.registrationEnabled,
    passwordRegistrationEnabled: passwordLocked
      ? false
      : stored.passwordRegistrationEnabled,
    workspaceCreationRestricted:
      workspaceLocked || stored.workspaceCreationRestricted,
    lockedByEnv,
  };
}

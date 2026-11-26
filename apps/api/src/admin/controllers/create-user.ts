import { isInstitutionalRole } from "@kaneo/permissions";
import bcrypt from "bcryptjs";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  accountTable,
  militarPerfilTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { readStoredSettings } from "../../instance-settings/read-stored-settings";
import { normalizeCedulaInput } from "../../sigefanb/military-assets";
import { isCloud } from "../../utils/is-cloud";
import { isDisposableEmail } from "../../utils/is-disposable-email";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { assertAssignableRole } from "../roles/assert-assignable-role";
import { getUserAccess } from "../roles/get-instance-access";
import { emailPasswordLink } from "../users/account-email-links";
import { adminUserColumns, toAdminUser } from "../users/admin-user-columns";
import { createsPasswordAccounts } from "../users/password-sign-in";
import { generateReadableTemporaryPassword } from "./generate-temporary-password";

type CreateUserInput = {
  name: string;
  email?: string;
  /** Defaults to the instance's default role. */
  role?: string;
  cedula?: string;
  nacionalidad?: string;
  grado?: string;
  componente?: string;
  unidad?: string;
  generarContrasenaTemporal?: boolean;
  workspaceId?: string;
};

export type PasswordSetupEmail =
  | "sent"
  | "failed"
  | "not_configured"
  | "not_needed";

function emailTaken() {
  return new ApiError(409, {
    code: "USER_ALREADY_EXISTS",
    message: "A user with this email address already exists.",
  });
}

function cedulaTaken() {
  return new ApiError(409, {
    code: "CEDULA_ALREADY_EXISTS",
    message: "Ya existe un usuario registrado con esta cédula de identidad.",
  });
}

/**
 * Create an account with optional SIGEFANB military profile and optional
 * one-time temporary password.
 */
async function createUser(input: CreateUserInput, audit: AdminAuditRequest) {
  const name = input.name.trim();

  let cedula: string | null = null;
  if (input.cedula?.trim()) {
    cedula = normalizeCedulaInput(input.cedula);
    if (!cedula) {
      throw new ApiError(400, {
        code: "INVALID_CEDULA",
        message: "La cédula de identidad ingresada no es válida.",
      });
    }
  }

  const nacionalidad =
    input.nacionalidad?.trim().toUpperCase() === "E"
      ? "E"
      : input.nacionalidad?.trim().toUpperCase() === "V"
        ? "V"
        : cedula
          ? "V"
          : null;

  const rawEmail = input.email?.trim().toLowerCase();
  const email =
    rawEmail && rawEmail.length > 0
      ? rawEmail
      : cedula
        ? `${(nacionalidad || "v").toLowerCase()}${cedula}@agenda.mppd.local`
        : "";

  if (!email) {
    throw new ApiError(400, {
      code: "EMAIL_OR_CEDULA_REQUIRED",
      message: "Debe indicar correo electrónico o cédula de identidad.",
    });
  }

  if (isCloud() && isDisposableEmail(email)) {
    throw new ApiError(400, {
      code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
      message:
        "Use a permanent email address. Disposable addresses cannot create accounts.",
    });
  }

  const withPassword = await createsPasswordAccounts();
  const actor = await getUserAccess(audit.actorUserId ?? "");
  const generarTemporal = input.generarContrasenaTemporal === true;
  const temporaryPassword = generarTemporal
    ? generateReadableTemporaryPassword(12)
    : null;
  const passwordHash = temporaryPassword
    ? await bcrypt.hash(temporaryPassword, 10)
    : null;

  const userId = await db.transaction(async (tx) => {
    const role = input.role ?? (await readStoredSettings(tx)).defaultRole;
    await assertAssignableRole(role, actor, tx);

    const [existing] = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(sql`lower(${userTable.email})`, email))
      .limit(1);
    if (existing) throw emailTaken();

    if (cedula) {
      const [existingCedula] = await tx
        .select({ userId: militarPerfilTable.userId })
        .from(militarPerfilTable)
        .where(eq(militarPerfilTable.cedula, cedula))
        .limit(1);
      if (existingCedula) throw cedulaTaken();
    }

    const [created] = await tx
      .insert(userTable)
      .values({
        name,
        email,
        role,
        emailVerified: generarTemporal ? true : !withPassword,
      })
      .onConflictDoNothing({ target: userTable.email })
      .returning({ id: userTable.id });
    if (!created) throw emailTaken();

    if (cedula) {
      await tx
        .insert(militarPerfilTable)
        .values({
          userId: created.id,
          cedula,
          nacionalidad,
          grado: input.grado?.trim() || null,
          componente: input.componente?.trim() || null,
          unidad: input.unidad?.trim() || null,
          pendiente: !generarTemporal,
          sincronizadoEn: new Date(),
        })
        .onConflictDoNothing({ target: militarPerfilTable.cedula });
    }

    if (passwordHash) {
      await tx.insert(accountTable).values({
        accountId: created.id,
        providerId: "credential",
        userId: created.id,
        password: passwordHash,
      });
    }

    if (isInstitutionalRole(role)) {
      const targetWorkspace = input.workspaceId
        ? await tx
            .select({ id: workspaceTable.id })
            .from(workspaceTable)
            .where(
              and(
                eq(workspaceTable.id, input.workspaceId),
                isNull(workspaceTable.archivedAt),
              ),
            )
            .limit(1)
        : await tx
            .select({ id: workspaceTable.id })
            .from(workspaceTable)
            .where(isNull(workspaceTable.archivedAt))
            .orderBy(asc(workspaceTable.createdAt))
            .limit(1);

      const workspaceId = targetWorkspace[0]?.id;
      if (workspaceId) {
        const [existingMember] = await tx
          .select({ id: workspaceUserTable.id })
          .from(workspaceUserTable)
          .where(
            and(
              eq(workspaceUserTable.workspaceId, workspaceId),
              eq(workspaceUserTable.userId, created.id),
            ),
          )
          .limit(1);
        if (!existingMember) {
          await tx.insert(workspaceUserTable).values({
            workspaceId,
            userId: created.id,
            role,
            joinedAt: new Date(),
          });
        }
      }
    }

    const signInMode = generarTemporal
      ? "temporary_password"
      : withPassword
        ? "password_link"
        : "single_sign_on";

    await recordAdminAction(
      {
        ...audit,
        action: "user.created",
        targetType: "user",
        targetId: created.id,
        targetLabel: email,
        metadata: {
          name,
          role,
          ...(cedula ? { cedula } : {}),
          signIn: signInMode,
        },
      },
      tx,
    );
    return created.id;
  });

  let passwordSetupEmail: PasswordSetupEmail = "not_needed";
  if (withPassword && !generarTemporal) {
    try {
      const result = await emailPasswordLink(
        { id: userId, name, email, locale: null },
        "setup",
      );
      passwordSetupEmail = result.success ? "sent" : "not_configured";
    } catch {
      passwordSetupEmail = "failed";
    }
  }

  const [row] = await db
    .select(adminUserColumns)
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!row)
    throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });

  return {
    user: toAdminUser(row),
    passwordSetupEmail,
    ...(temporaryPassword ? { temporaryPassword } : {}),
  };
}

export default createUser;

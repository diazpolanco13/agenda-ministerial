import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  accountTable,
  militarPerfilTable,
  userTable,
} from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { deleteUserSessions } from "../../sessions/delete-user-sessions";
import { revokeSessionConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../users/find-admin-target-user";

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%";

/**
 * Genera una contraseña aleatoria legible de 12 caracteres sin caracteres ambiguos.
 */
export function generateReadableTemporaryPassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i] ?? 0;
    password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  }
  return password;
}

/**
 * Genera una contraseña temporal para un usuario, la guarda en `account`
 * (`providerId: "credential"`), marca su correo como verificado y `militar_perfil.pendiente = false`,
 * revoca sus sesiones activas y registra la acción en auditoría sin guardar la clave.
 */
async function generateTemporaryPassword(
  userId: string,
  audit: AdminAuditRequest,
) {
  const temporaryPassword = generateReadableTemporaryPassword(12);
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const revoked = await db.transaction(async (tx) => {
    const user = await findAdminTargetUser(userId, tx);
    if (user.isAnonymous) {
      throw new ApiError(409, {
        code: "GUEST_ACCOUNT",
        message: "Las cuentas de invitado no usan contraseña.",
      });
    }

    const revokedIds = await deleteUserSessions(tx, userId, {
      exceptSessionId: null,
    });

    const [existingAccount] = await tx
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, userId),
          eq(accountTable.providerId, "credential"),
        ),
      )
      .limit(1);

    if (existingAccount) {
      await tx
        .update(accountTable)
        .set({ password: passwordHash, accountId: userId })
        .where(eq(accountTable.id, existingAccount.id));
    } else {
      await tx.insert(accountTable).values({
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      });
    }

    await tx
      .update(userTable)
      .set({ emailVerified: true })
      .where(eq(userTable.id, userId));

    await tx
      .update(militarPerfilTable)
      .set({ pendiente: false })
      .where(eq(militarPerfilTable.userId, userId));

    await recordAdminAction(
      {
        ...audit,
        action: "user.temporary_password_generated",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
      },
      tx,
    );

    return revokedIds;
  });

  await revokeSessionConnections(userId, revoked);
  return { temporaryPassword };
}

export default generateTemporaryPassword;

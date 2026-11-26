import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AdminAuditRequest } from "../../admin/audit/admin-audit-request";
import { recordAdminAction } from "../../admin/audit/record-admin-action";
import db from "../../database";
import { militarPerfilTable, userTable } from "../../database/schema";
import { obtenerPersonalPorCedula } from "../../sigefanb/personal-query";
import { SigefanbUnavailableError } from "../../sigefanb/pools";
import getCurrentUser from "./get-current-user";

/**
 * Sincroniza el perfil militar del usuario autenticado consultando SIGEFANB
 * por su cédula vinculada y actualiza grado, componente, unidad y nombre completo.
 */
export async function syncSigefanbProfile(
  userId: string,
  userEmail: string | undefined,
  audit: AdminAuditRequest,
) {
  const [perfil] = await db
    .select({ cedula: militarPerfilTable.cedula })
    .from(militarPerfilTable)
    .where(eq(militarPerfilTable.userId, userId))
    .limit(1);

  if (!perfil) {
    throw new HTTPException(400, {
      message: "Tu cuenta no tiene una cédula militar vinculada.",
    });
  }

  let persona: Awaited<ReturnType<typeof obtenerPersonalPorCedula>>;
  try {
    persona = await obtenerPersonalPorCedula(perfil.cedula);
  } catch (error) {
    if (error instanceof SigefanbUnavailableError) {
      throw new HTTPException(503, {
        message: "Servicio SIGEFANB temporalmente no disponible.",
      });
    }
    throw error;
  }

  if (!persona) {
    throw new HTTPException(404, {
      message: "No se encontró registro activo en SIGEFANB para esta cédula.",
    });
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(militarPerfilTable)
      .set({
        nacionalidad: persona.nacionalidad,
        grado: persona.grado || null,
        componente: persona.componente,
        unidad: persona.unidad,
        sexo: persona.sexo,
        sincronizadoEn: now,
      })
      .where(eq(militarPerfilTable.userId, userId));

    if (persona.nombreCompleto) {
      await tx
        .update(userTable)
        .set({ name: persona.nombreCompleto })
        .where(eq(userTable.id, userId));
    }

    await recordAdminAction(
      {
        ...audit,
        action: "user.sigefanb_synced",
        targetType: "user",
        targetId: userId,
        targetLabel: userEmail || persona.cedula,
        metadata: {
          cedula: persona.cedula,
          grado: persona.grado,
          componente: persona.componente,
        },
      },
      tx,
    );
  });

  return getCurrentUser(userId);
}

export default syncSigefanbProfile;

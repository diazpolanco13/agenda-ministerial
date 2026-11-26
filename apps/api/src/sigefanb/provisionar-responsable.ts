import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { recordAdminAction } from "../admin/audit/record-admin-action";
import db, { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import { normalizeCedulaInput } from "./military-assets";
import { obtenerPersonalPorCedula } from "./personal-query";

export type ProvisionarResponsableInput = {
  cedula: string;
  workspaceId: string;
  actorUserId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProvisionedUserDto = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  cedula: string;
  nacionalidad: string | null;
  grado: string | null;
  componente: string | null;
  unidad: string | null;
  pendiente: boolean;
};

export type ProvisionarResponsableResult = {
  user: ProvisionedUserDto;
  created: boolean;
};

async function findLinkedUserByCedula(
  cedula: string,
  database: DbOrTx = db,
): Promise<ProvisionedUserDto | null> {
  const [row] = await database
    .select({
      id: schema.userTable.id,
      name: schema.userTable.name,
      email: schema.userTable.email,
      image: schema.userTable.image,
      cedula: schema.militarPerfilTable.cedula,
      nacionalidad: schema.militarPerfilTable.nacionalidad,
      grado: schema.militarPerfilTable.grado,
      componente: schema.militarPerfilTable.componente,
      unidad: schema.militarPerfilTable.unidad,
      pendiente: schema.militarPerfilTable.pendiente,
    })
    .from(schema.militarPerfilTable)
    .innerJoin(
      schema.userTable,
      eq(schema.userTable.id, schema.militarPerfilTable.userId),
    )
    .where(eq(schema.militarPerfilTable.cedula, cedula))
    .limit(1);

  return row ?? null;
}

async function ensureWorkspaceExists(
  workspaceId: string,
  database: DbOrTx = db,
): Promise<void> {
  const [ws] = await database
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId))
    .limit(1);

  if (!ws) {
    throw new HTTPException(404, {
      message: "Espacio de trabajo no encontrado",
    });
  }
}

async function ensureWorkspaceMember(
  workspaceId: string,
  userId: string,
  database: DbOrTx = db,
): Promise<void> {
  const [existingMember] = await database
    .select({ id: schema.workspaceUserTable.id })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  if (!existingMember) {
    await database.insert(schema.workspaceUserTable).values({
      workspaceId,
      userId,
      role: "responsable",
      joinedAt: new Date(),
    });
  }
}

async function resolveUniqueSyntheticEmail(
  nacionalidad: "V" | "E",
  cedula: string,
  tx: DbOrTx,
): Promise<string> {
  const baseLocal = `${nacionalidad.toLowerCase()}${cedula}`;
  const primary = `${baseLocal}@agenda.mppd.local`;

  const [existing] = await tx
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, primary))
    .limit(1);

  if (!existing) return primary;
  return `${baseLocal}.${randomUUID().slice(0, 8)}@agenda.mppd.local`;
}

/**
 * Aprovisiona de forma idempotente un responsable militar en AGENDA a partir de su cédula en SIGEFANB
 * y garantiza su membresía en el workspace indicado con el rol `responsable`.
 */
export async function provisionarResponsable({
  cedula,
  workspaceId,
  actorUserId,
  ipAddress = null,
  userAgent = null,
}: ProvisionarResponsableInput): Promise<ProvisionarResponsableResult> {
  const normalizedCedula = normalizeCedulaInput(cedula);
  if (!normalizedCedula) {
    throw new HTTPException(400, { message: "Cédula inválida" });
  }

  await ensureWorkspaceExists(workspaceId);

  const existing = await findLinkedUserByCedula(normalizedCedula);
  if (existing) {
    await ensureWorkspaceMember(workspaceId, existing.id);
    return { user: existing, created: false };
  }

  const persona = await obtenerPersonalPorCedula(normalizedCedula);
  if (!persona) {
    throw new HTTPException(404, {
      message: "No se encontró personal activo con esa cédula en SIGEFANB",
    });
  }

  return db.transaction(async (tx) => {
    const existingInTx = await findLinkedUserByCedula(persona.cedula, tx);
    if (existingInTx) {
      await ensureWorkspaceMember(workspaceId, existingInTx.id, tx);
      return { user: existingInTx, created: false };
    }

    const email = await resolveUniqueSyntheticEmail(
      persona.nacionalidad,
      persona.cedula,
      tx,
    );
    const now = new Date();

    const [createdUser] = await tx
      .insert(schema.userTable)
      .values({
        name: persona.nombreCompleto,
        email,
        emailVerified: false,
        role: "responsable",
      })
      .returning({
        id: schema.userTable.id,
        name: schema.userTable.name,
        email: schema.userTable.email,
        image: schema.userTable.image,
      });

    if (!createdUser) {
      throw new HTTPException(500, {
        message: "No se pudo crear el usuario del responsable",
      });
    }

    await tx.insert(schema.militarPerfilTable).values({
      userId: createdUser.id,
      cedula: persona.cedula,
      nacionalidad: persona.nacionalidad,
      grado: persona.grado,
      componente: persona.componente,
      unidad: persona.unidad,
      sexo: persona.sexo,
      pendiente: true,
      sincronizadoEn: now,
    });

    await tx.insert(schema.workspaceUserTable).values({
      workspaceId,
      userId: createdUser.id,
      role: "responsable",
      joinedAt: now,
    });

    await recordAdminAction(
      {
        actorUserId,
        action: "sigefanb.user_provisioned",
        targetType: "user",
        targetId: createdUser.id,
        targetLabel: persona.cedula,
        metadata: {
          workspaceId,
          nacionalidad: persona.nacionalidad,
          grado: persona.grado,
          componente: persona.componente,
        },
        ipAddress,
        userAgent,
      },
      tx,
    );

    return {
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        image: createdUser.image,
        cedula: persona.cedula,
        nacionalidad: persona.nacionalidad,
        grado: persona.grado,
        componente: persona.componente,
        unidad: persona.unidad,
        pendiente: true,
      },
      created: true,
    };
  });
}

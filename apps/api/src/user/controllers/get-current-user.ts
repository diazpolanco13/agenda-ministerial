import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { militarPerfilTable, userTable } from "../../database/schema";
import { rankInsignia } from "../../sigefanb/military-assets";
import getManagedProfile from "./get-managed-profile";

export async function getCurrentUser(userId: string) {
  const [row] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: userTable.role,
      cedula: militarPerfilTable.cedula,
      nacionalidad: militarPerfilTable.nacionalidad,
      grado: militarPerfilTable.grado,
      componente: militarPerfilTable.componente,
      unidad: militarPerfilTable.unidad,
      sexo: militarPerfilTable.sexo,
      pendiente: militarPerfilTable.pendiente,
      sincronizadoEn: militarPerfilTable.sincronizadoEn,
    })
    .from(userTable)
    .leftJoin(militarPerfilTable, eq(userTable.id, militarPerfilTable.userId))
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!row) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const managed = await getManagedProfile(userId);
  const militar = row.cedula
    ? {
        cedula: row.cedula,
        nacionalidad: row.nacionalidad,
        grado: row.grado,
        componente: row.componente,
        unidad: row.unidad,
        sexo: row.sexo,
        insignia:
          rankInsignia(row.grado, row.componente, row.unidad)?.src ?? null,
        fotoUrl: `/api/sigefanb/foto/${row.cedula}`,
        pendiente: row.pendiente ?? false,
        sincronizadoEn: row.sincronizadoEn ?? null,
      }
    : null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    managedProfileFields: managed?.fields ?? [],
    militar,
  };
}

export default getCurrentUser;

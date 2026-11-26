import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userSavedFilterTable } from "../../database/schema";

const MAX_FILTERS_PER_USER_WORKSPACE = 30;

export async function listSavedFilters(
  userId: string,
  workspaceId: string,
  scope?: "my-tasks" | "delegated",
) {
  return db
    .select({
      id: userSavedFilterTable.id,
      workspaceId: userSavedFilterTable.workspaceId,
      scope: userSavedFilterTable.scope,
      name: userSavedFilterTable.name,
      filters: userSavedFilterTable.filters,
      createdAt: userSavedFilterTable.createdAt,
      updatedAt: userSavedFilterTable.updatedAt,
    })
    .from(userSavedFilterTable)
    .where(
      and(
        eq(userSavedFilterTable.userId, userId),
        eq(userSavedFilterTable.workspaceId, workspaceId),
        scope ? eq(userSavedFilterTable.scope, scope) : undefined,
      ),
    )
    .orderBy(desc(userSavedFilterTable.updatedAt));
}

export async function createSavedFilter(
  userId: string,
  input: {
    workspaceId: string;
    scope: "my-tasks" | "delegated";
    name: string;
    filters: Record<string, unknown>;
  },
) {
  const existing = await db
    .select({ id: userSavedFilterTable.id })
    .from(userSavedFilterTable)
    .where(
      and(
        eq(userSavedFilterTable.userId, userId),
        eq(userSavedFilterTable.workspaceId, input.workspaceId),
      ),
    );

  if (existing.length >= MAX_FILTERS_PER_USER_WORKSPACE) {
    throw new HTTPException(400, {
      message: "Alcanzaste el límite de filtros guardados en este espacio",
    });
  }

  const [created] = await db
    .insert(userSavedFilterTable)
    .values({
      userId,
      workspaceId: input.workspaceId,
      scope: input.scope,
      name: input.name.trim(),
      filters: input.filters,
    })
    .returning({
      id: userSavedFilterTable.id,
      workspaceId: userSavedFilterTable.workspaceId,
      scope: userSavedFilterTable.scope,
      name: userSavedFilterTable.name,
      filters: userSavedFilterTable.filters,
      createdAt: userSavedFilterTable.createdAt,
      updatedAt: userSavedFilterTable.updatedAt,
    });

  if (!created) {
    throw new HTTPException(500, {
      message: "No se pudo guardar el filtro",
    });
  }

  return created;
}

export async function deleteSavedFilter(userId: string, filterId: string) {
  const [deleted] = await db
    .delete(userSavedFilterTable)
    .where(
      and(
        eq(userSavedFilterTable.id, filterId),
        eq(userSavedFilterTable.userId, userId),
      ),
    )
    .returning({ id: userSavedFilterTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Filtro guardado no encontrado" });
  }

  return { deleted: true, id: deleted.id };
}

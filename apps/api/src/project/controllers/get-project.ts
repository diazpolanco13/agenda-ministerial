import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canViewConfidentialInWorkspace } from "../../confidentiality/access";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function getProject(id: string, workspaceId: string, userId?: string) {
  const project = await db.query.projectTable.findFirst({
    where: and(
      eq(projectTable.id, id),
      eq(projectTable.workspaceId, workspaceId),
    ),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  if (
    project.confidentialityLevel === "confidencial" &&
    userId &&
    !(await canViewConfidentialInWorkspace(userId, project.workspaceId))
  ) {
    throw new HTTPException(403, {
      message: "No tienes acceso a este proyecto confidencial",
    });
  }

  return project;
}

export default getProject;

import { eq } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable } from "../../database/schema";

export async function getExternalLinksByTask(taskId: string) {
  const links = await db.query.externalLinkTable.findMany({
    where: eq(externalLinkTable.taskId, taskId),
    with: {
      // Never widen this: integration.config holds plaintext provider
      // secrets and this route is reachable by any workspace member.
      integration: { columns: { id: true, type: true } },
    },
  });

  return links.map((link) => ({
    ...link,
    metadata: link.metadata ? JSON.parse(link.metadata) : null,
  }));
}

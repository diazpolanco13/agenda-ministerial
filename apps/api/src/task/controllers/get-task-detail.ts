import getActivitiesFromTaskId from "../../activity/controllers/get-activities";
import getCustomFieldValuesByTask from "../../custom-field/controllers/get-custom-field-values-by-task";
import { getExternalLinksByTask } from "../../external-link/controllers/get-external-links";
import getLabelsByTaskId from "../../label/controllers/get-labels-by-task-id";
import getTaskRelations from "../../task-relation/controllers/get-task-relations";
import getTimeEntriesByTaskId from "../../time-entry/controllers/get-time-entries";
import getTask from "./get-task";

/**
 * Devuelve en una sola respuesta el detalle completo de la tarea para abrir
 * la vista o el panel lateral sin cascada de peticiones.
 */
export async function getTaskDetail(
  taskId: string,
  workspaceId: string,
  userId: string,
) {
  const task = await getTask(taskId, false, userId);

  const [
    activities,
    relations,
    labels,
    externalLinks,
    timeEntries,
    customFieldValues,
  ] = await Promise.all([
    getActivitiesFromTaskId(taskId, userId),
    getTaskRelations(taskId, workspaceId, userId),
    getLabelsByTaskId(taskId),
    getExternalLinksByTask(taskId),
    getTimeEntriesByTaskId(taskId),
    getCustomFieldValuesByTask(taskId),
  ]);

  return {
    task,
    activities,
    relations,
    labels,
    externalLinks,
    timeEntries,
    customFieldValues,
  };
}

export default getTaskDetail;

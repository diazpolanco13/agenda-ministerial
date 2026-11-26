import { z } from "../openapi";

export const ntfyPreferencesBody = z.object({
  taskAssigned: z.boolean().optional(),
  mentionComment: z.boolean().optional(),
  dueTomorrow: z.boolean().optional(),
  dueToday: z.boolean().optional(),
  overdue: z.boolean().optional(),
  ministerOrder: z.boolean().optional(),
});

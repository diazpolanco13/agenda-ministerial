import { activityListSchema } from "../activity/response";
import { customFieldValueListSchema } from "../custom-field/response";
import { externalLinkListSchema } from "../external-link/response";
import { labelListSchema } from "../label/response";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { taskRelationWithTasksListSchema } from "../task-relation/response";
import { timeEntryListSchema } from "../time-entry/response";
import { taskRecurrenceSchema } from "./recurrence/schema";

const priorityDescription = "One of: no-priority, low, medium, high, urgent.";

const orderAndConfidentialityFields = {
  confidentialityLevel: z.string().nullable().optional(),
  isOrder: z.boolean().nullable().optional(),
  orderFolio: z.string().nullable().optional(),
  orderOrigin: z.string().nullable().optional(),
  orderQuote: z.string().nullable().optional(),
  orderClosureStatus: z.string().nullable().optional(),
  orderEvidenceText: z.string().nullable().optional(),
  orderEvidenceAssetId: z.string().nullable().optional(),
  orderEvidenceSubmittedAt: nullableResponseTimestamp.optional(),
  orderEvidenceSubmittedBy: z.string().nullable().optional(),
  orderReviewedAt: nullableResponseTimestamp.optional(),
  orderReviewedBy: z.string().nullable().optional(),
  orderReviewComment: z.string().nullable().optional(),
  orderSealHash: z.string().nullable().optional(),
  projectConfidentialityLevel: z.string().nullable().optional(),
};

export const taskSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    position: z.number().nullable().openapi({
      description: "Order within its column, ascending.",
    }),
    number: z.number().nullable().openapi({
      description: "Per-project counter shown as {projectSlug}-{number}.",
    }),
    userId: z
      .string()
      .nullable()
      .openapi({ description: "The assignee, if any." }),
    title: z.string(),
    description: z.string().nullable(),
    descriptionDeferred: z.boolean().optional().openapi({
      description:
        "True when the list omits a large description; load the task detail or description pages to read it. Do not replace stored text with this null summary.",
    }),
    status: z.string().openapi({
      description: "The slug of the column the task sits in.",
    }),
    priority: z.string().openapi({ description: priorityDescription }),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    recurrence: z.union([taskRecurrenceSchema, z.null()]).optional(),
    createdAt: responseTimestamp,
    customFields: z
      .array(z.object({ fieldId: z.string(), value: z.string() }))
      .optional(),
    ...orderAndConfidentialityFields,
  })
  .openapi("Task");

export const taskWithAssigneeSchema = taskSchema
  .extend({
    workspaceId: z.string().optional().openapi({
      description:
        "The workspace currently owning the task's project. Included in the detail view; omitted from the compact board view.",
    }),
    columnId: z.string().nullable().openapi({
      description:
        "The referenced workflow column; null for virtual statuses and legacy tasks without a column reference.",
    }),
    isSubtask: z.boolean().optional(),
    subtaskCounts: z
      .object({ completed: z.number(), total: z.number() })
      .optional(),
    parentSubtaskCounts: z
      .array(
        z.object({
          taskId: z.string(),
          completed: z.number(),
          total: z.number(),
        }),
      )
      .optional(),
    assigneeName: z.string().nullable(),
    assigneeId: z.string().nullable(),
    assigneeCedula: z.string().nullable().optional(),
    assigneeGrado: z.string().nullable().optional(),
    assigneeComponente: z.string().nullable().optional(),
    assigneeUnidad: z.string().nullable().optional(),
  })
  .openapi("TaskWithAssignee");

export const taskByTicketIdSchema = taskWithAssigneeSchema
  .extend({
    workspaceId: z.string().openapi({
      description: "The workspace that owns the task's project.",
    }),
  })
  .openapi("TaskByTicketId");

const taskLabelSchema = z
  .object({ id: z.string(), name: z.string(), color: z.string() })
  .openapi("TaskLabel");

const taskExternalLinkSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    integrationId: z.string().nullable(),
    resourceType: z.string(),
    externalId: z.string(),
    url: z.string(),
    title: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable().openapi({
      description:
        "Provider-specific payload, already parsed from the stored JSON string.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TaskExternalLink");

export const boardTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    number: z.number().nullable(),
    description: z.string().nullable(),
    descriptionDeferred: z.boolean().optional().openapi({
      description:
        "True when the list omits a large description; load the task detail or description pages to read it. Do not replace stored text with this null summary.",
    }),
    status: z.string(),
    priority: z.string().openapi({ description: priorityDescription }),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    recurrence: z.union([taskRecurrenceSchema, z.null()]),
    position: z.number().nullable(),
    createdAt: responseTimestamp,
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    assigneeId: z.string().nullable(),
    assigneeImage: z.string().nullable(),
    assigneeCedula: z.string().nullable().optional(),
    assigneeGrado: z.string().nullable().optional(),
    assigneeComponente: z.string().nullable().optional(),
    assigneeUnidad: z.string().nullable().optional(),
    projectId: z.string(),
    isSubtask: z.boolean().optional(),
    subtaskCounts: z
      .object({
        completed: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .openapi({
        description:
          "Direct subtasks in the workspace; completed means a final column in the child project. Public boards count only children in public projects.",
      }),
    labels: z.array(taskLabelSchema),
    externalLinks: z.array(taskExternalLinkSchema),
    ...orderAndConfidentialityFields,
  })
  .openapi("BoardTask");

export const boardColumnSchema = z
  .object({
    id: z.string().openapi({ description: "The column slug, same as `slug`." }),
    slug: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    isFinal: z.boolean(),
    position: z.number().optional(),
    tasks: z.array(boardTaskSchema),
  })
  .openapi("BoardColumn");

export const boardSchema = z
  .object({
    data: z
      .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        icon: z.string().nullable(),
        description: z.string().nullable(),
        descriptionDeferred: z.boolean().optional().openapi({
          description:
            "True when a project description above 64 KiB is omitted; use project detail or public project description pages for full text.",
        }),
        isPublic: z.boolean().nullable(),
        includeSubtasks: z.boolean().optional(),
        workspaceId: z.string(),
        backgroundVersion: z.string().nullable(),
        columns: z.array(boardColumnSchema),
        archivedTasks: z.array(boardTaskSchema),
        plannedTasks: z.array(boardTaskSchema),
      })
      .openapi("Board"),
    pagination: z
      .object({
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
        relatedPage: z.number(),
        relatedPageSize: z.number(),
        relatedTotalPages: z.number(),
        relatedRevision: z.string().optional().openapi({
          description:
            "Public board labels and external links revision for this task page. Restart pagination if it changes during related-page continuations.",
        }),
        revision: z.string().optional().openapi({
          description:
            "Public board content, membership and ordering revision, including related records and visible subtask progress. Restart pagination if it changes between task or related pages.",
        }),
      })
      .openapi({
        description:
          "Always paginated: 50 tasks by default, at most 100 per page. Continue through totalPages to retrieve all tasks. For each task page, follow relatedPage through relatedTotalPages to retrieve all labels, external links and columns (100 related rows per kind per request, plus up to 100 columns needed to represent the tasks).",
      })
      .openapi("BoardPagination"),
  })
  .openapi("BoardResponse");

export const bulkResultSchema = z
  .object({ success: z.boolean(), updatedCount: z.number() })
  .openapi("BulkTaskResult");

export const moveTaskResultSchema = z
  .object({
    task: taskSchema,
    sourceProjectId: z.string(),
    destinationProjectId: z.string(),
  })
  .openapi("MoveTaskResult");

export const taskExportSchema = z
  .object({
    project: z
      .object({
        name: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        exportedAt: z.string().openapi({ format: "date-time" }),
      })
      .openapi("TaskExportProject"),
    tasks: z.array(
      z
        .object({
          title: z.string(),
          description: z.string(),
          status: z.string(),
          priority: z.string(),
          dueDate: z.string().nullable().openapi({ format: "date-time" }),
          startDate: z.string().nullable().openapi({ format: "date-time" }),
          userId: z.string().nullable(),
          labels: z
            .array(
              z
                .object({ name: z.string(), color: z.string() })
                .openapi("ExportedTaskLabel"),
            )
            .openapi({
              description: "Label names and colors, without their ids.",
            }),
        })
        .openapi("ExportedTask"),
    ),
  })
  .openapi("TaskExport");

export const taskImportResultSchema = z
  .object({
    results: z
      .object({
        total: z.number(),
        successful: z.number(),
        failed: z.number(),
        tasks: z.array(z.unknown()).openapi({
          description: "Per-task outcome, each carrying a success flag.",
        }),
      })
      .openapi("TaskImportSummary"),
  })
  .openapi("TaskImportResult");

export const imageUploadSchema = z
  .object({
    key: z.string().openapi({
      description: "Object key to send back to the finalize route.",
    }),
    uploadUrl: z.string().openapi({
      description: "Presigned URL to PUT the image bytes to.",
    }),
    headers: z.record(z.string(), z.string()).openapi({
      description:
        "Headers that must accompany the upload request, including Content-Type.",
    }),
  })
  .openapi("TaskImageUpload");

export const finalizedAssetSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description: "Where the stored image can be read back from.",
    }),
  })
  .openapi("TaskImageAsset");

export const descriptionPageSchema = z
  .object({
    content: z.string(),
    version: z.string(),
    nextOffset: z.number().nullable(),
  })
  .openapi("TaskDescriptionPage");
export const descriptionMatchesSchema = z
  .object({ ids: z.array(z.string()), nextCursor: z.string().nullable() })
  .openapi("TaskDescriptionMatches");

export const projectColumnSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  isFinal: z.boolean(),
  position: z.number(),
});

export const myTasksKpisSchema = z.object({
  overdueCount: z.number(),
  dueTodayCount: z.number(),
  completedThisWeekCount: z.number(),
  completedOnTime30d: z.number(),
  completedWithDue30d: z.number(),
  onTimeRate30d: z.number().nullable(),
});

export const assignedTasksSchema = z
  .object({
    tasks: z.array(
      z
        .object({
          id: z.string(),
          projectId: z.string(),
          workspaceId: z.string().optional(),
          workspaceName: z.string().optional(),
          number: z.number().nullable(),
          title: z.string(),
          status: z.string().openapi({
            description: "The slug of the column the task sits in.",
          }),
          columnId: z.string().nullable().optional(),
          position: z.number().nullable().optional(),
          statusName: z.string().nullable().openapi({
            description:
              "The column's display name. Null for tasks outside a column, such as planned ones.",
          }),
          statusIcon: z.string().nullable(),
          isFinal: z.boolean().optional(),
          priority: z.string().openapi({ description: priorityDescription }),
          startDate: nullableResponseTimestamp.optional(),
          dueDate: nullableResponseTimestamp,
          createdAt: responseTimestamp.optional(),
          updatedAt: responseTimestamp.optional(),
          userId: z.string().nullable().optional(),
          assigneeName: z.string().nullable().optional(),
          assigneeImage: z.string().nullable().optional(),
          projectName: z.string(),
          projectSlug: z.string(),
          projectIcon: z.string().nullable(),
          assigneeCedula: z.string().nullable().optional(),
          assigneeGrado: z.string().nullable().optional(),
          assigneeComponente: z.string().nullable().optional(),
          assigneeUnidad: z.string().nullable().optional(),
          labels: z.array(taskLabelSchema),
          ...orderAndConfidentialityFields,
        })
        .openapi("AssignedTask"),
    ),
    total: z.number().openapi({
      description:
        "All open tasks assigned to the caller, including any beyond the first 100 returned.",
    }),
    kpis: myTasksKpisSchema.optional(),
    columnsByProject: z
      .record(z.string(), z.array(projectColumnSummarySchema))
      .optional(),
  })
  .openapi("AssignedTasks");

export const delegatedTasksSchema = z
  .object({
    tasks: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        workspaceId: z.string(),
        workspaceName: z.string(),
        number: z.number().nullable(),
        title: z.string(),
        status: z.string(),
        columnId: z.string().nullable(),
        statusName: z.string().nullable(),
        statusIcon: z.string().nullable(),
        isFinal: z.boolean(),
        priority: z.string(),
        startDate: nullableResponseTimestamp,
        dueDate: nullableResponseTimestamp,
        createdAt: responseTimestamp,
        updatedAt: responseTimestamp,
        projectName: z.string(),
        projectSlug: z.string(),
        projectIcon: z.string().nullable(),
        userId: z.string().nullable(),
        assigneeName: z.string().nullable(),
        assigneeImage: z.string().nullable(),
        assigneeCedula: z.string().nullable(),
        assigneeGrado: z.string().nullable(),
        assigneeComponente: z.string().nullable(),
        assigneeUnidad: z.string().nullable(),
        assigneeInsignia: z.string().nullable(),
        assigneeFotoUrl: z.string().nullable(),
        overdueDays: z.number(),
        lastActivityAt: responseTimestamp,
        lastActivityType: z.string().nullable(),
        lastRemindedAt: nullableResponseTimestamp,
        subtaskCounts: z.object({
          completed: z.number(),
          total: z.number(),
        }),
        labels: z.array(taskLabelSchema),
        ...orderAndConfidentialityFields,
      }),
    ),
    total: z.number(),
    columnsByProject: z.record(z.string(), z.array(projectColumnSummarySchema)),
  })
  .openapi("DelegatedTasks");

export const remindDelegatedTaskSchema = z
  .object({
    success: z.boolean(),
    notifiedUserId: z.string(),
    sentAt: z.string(),
  })
  .openapi("RemindDelegatedTaskResult");

export const taskDetailSchema = z
  .object({
    task: taskWithAssigneeSchema,
    activities: activityListSchema,
    relations: taskRelationWithTasksListSchema,
    labels: labelListSchema,
    externalLinks: externalLinkListSchema,
    timeEntries: timeEntryListSchema,
    customFieldValues: customFieldValueListSchema,
  })
  .openapi("TaskDetailAggregate");

import { useQueryClient } from "@tanstack/react-query";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  CONFIDENTIALITY_LABELS,
  type ConfidentialityLevel,
} from "@/components/confidentiality/confidentiality-badge";
import { ProjectBackgroundRow } from "@/components/settings/project-general/project-background-row";
import type { ProjectFormValues } from "@/components/settings/project-general/project-form-values";
import { ProjectIconPicker } from "@/components/settings/project-general/project-icon-picker";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsFormRow } from "@/components/settings/settings-form-row";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { normalizeConfidentialityLevel } from "@/components/task/task-confidentiality-popover";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";

type ProjectDetailsSectionProps = {
  form: UseFormReturn<ProjectFormValues>;
  project: ProjectWithTasks | undefined;
  canEdit: boolean;
};

export function ProjectDetailsSection({
  form,
  project,
  canEdit,
}: ProjectDetailsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: updateProject, isPending: isUpdatingConfidentiality } =
    useUpdateProject();
  const slug = useWatch({ control: form.control, name: "slug" });
  const icon = useWatch({ control: form.control, name: "icon" });
  const currentConfidentiality = normalizeConfidentialityLevel(
    project?.confidentialityLevel,
  );

  const handleConfidentialityChange = async (value: string | null) => {
    if (
      !project?.id ||
      (value !== "publica_interna" &&
        value !== "reservada" &&
        value !== "confidencial") ||
      value === currentConfidentiality
    ) {
      return;
    }

    try {
      await updateProject({
        id: project.id,
        name: project.name,
        icon: project.icon || "Layout",
        slug: project.slug,
        description: project.description ?? "",
        isPublic: !!project.isPublic,
        confidentialityLevel: value as ConfidentialityLevel,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({
          queryKey: ["projects", project.workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["projects", project.workspaceId, project.id],
        }),
      ]);
      toast.success("Confidencialidad del proyecto actualizada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la confidencialidad.",
      );
    }
  };

  return (
    <SettingsSection title={t("settings:projectGeneral.projectInfoTitle")}>
      <Form {...form}>
        <form onSubmit={(event) => event.preventDefault()}>
          <SettingsCard>
            <FormField
              control={form.control}
              name="includeSubtasks"
              render={({ field }) => (
                <SettingsFormRow label={t("tasks:display.includeSubtasks")}>
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                    disabled={!canEdit}
                  />
                </SettingsFormRow>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:projectGeneral.projectNameLabel")}
                >
                  <Input
                    size="sm"
                    className="sm:w-64"
                    placeholder={t(
                      "settings:projectGeneral.projectNamePlaceholder",
                    )}
                    disabled={!canEdit}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:projectGeneral.keyLabel")}
                  description={t("settings:projectGeneral.keyHint", {
                    slug: slug?.trim() || "ABC",
                  })}
                >
                  <Input
                    size="sm"
                    className="font-mono sm:w-64"
                    placeholder={t("settings:projectGeneral.keyPlaceholder")}
                    disabled={!canEdit}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:projectGeneral.descriptionLabel")}
                >
                  <Input
                    size="sm"
                    className="sm:w-64"
                    placeholder={t(
                      "settings:projectGeneral.descriptionPlaceholder",
                    )}
                    disabled={!canEdit}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
            <SettingsRow
              title={t("settings:projectGeneral.iconLabel")}
              description={t("settings:projectGeneral.iconHint")}
            >
              <ProjectIconPicker
                value={icon}
                disabled={!canEdit}
                onChange={(next) =>
                  form.setValue("icon", next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </SettingsRow>
            <ProjectBackgroundRow project={project} canEdit={canEdit} />
            <SettingsRow
              title="Nivel de confidencialidad"
              description="Controla quién puede visualizar este proyecto y sus tareas."
            >
              <Select
                value={currentConfidentiality}
                disabled={!canEdit || !project?.id || isUpdatingConfidentiality}
                onValueChange={handleConfidentialityChange}
              >
                <SelectTrigger
                  size="sm"
                  className="sm:w-48"
                  aria-label="Nivel de confidencialidad"
                >
                  <SelectValue>
                    {CONFIDENTIALITY_LABELS[currentConfidentiality]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica_interna">
                    Pública interna
                  </SelectItem>
                  <SelectItem value="reservada">Reservada</SelectItem>
                  <SelectItem value="confidencial">Confidencial</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsCard>
        </form>
      </Form>
    </SettingsSection>
  );
}

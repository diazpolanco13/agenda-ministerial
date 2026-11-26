import { useMutation } from "@tanstack/react-query";
import type { ConfidentialityLevel } from "@/components/confidentiality/confidentiality-badge";
import createProject from "@/fetchers/project/create-project";

function useCreateProject({
  name,
  slug,
  workspaceId,
  icon,
  confidentialityLevel,
}: {
  name: string;
  slug: string;
  workspaceId: string;
  icon: string;
  confidentialityLevel?: ConfidentialityLevel;
}) {
  return useMutation({
    mutationFn: () =>
      createProject({ name, slug, workspaceId, icon, confidentialityLevel }),
  });
}

export default useCreateProject;

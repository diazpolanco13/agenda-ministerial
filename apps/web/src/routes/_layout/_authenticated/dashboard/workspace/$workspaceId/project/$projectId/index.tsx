import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  getLastProjectView,
  PROJECT_ROUTE_PATHS,
  routeForView,
} from "@/components/project/views/project-views";
import { useUserPreferencesStore } from "@/store/user-preferences";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/",
)({
  beforeLoad: ({ params }) => {
    const lastView = getLastProjectView(params.projectId);
    if (lastView === "board" || lastView === "list") {
      useUserPreferencesStore.getState().setViewMode(lastView);
    }
    const route = routeForView(lastView);
    throw redirect({
      to: PROJECT_ROUTE_PATHS[route],
      params,
      replace: true,
    });
  },
});

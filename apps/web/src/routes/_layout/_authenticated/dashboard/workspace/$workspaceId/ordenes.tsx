import { createFileRoute } from "@tanstack/react-router";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { OrdenesPage } from "@/components/ordenes/ordenes-page";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/ordenes",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title="Órdenes del Ministro" />
      <WorkspaceLayout title="Órdenes del Ministro">
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <OrdenesPage workspaceId={workspaceId} />
        </div>
      </WorkspaceLayout>
    </>
  );
}

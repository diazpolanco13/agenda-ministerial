import { createFileRoute } from "@tanstack/react-router";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { DiscursoPage } from "@/components/discurso/discurso-page";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/discurso",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title="Discurso / Reunión" />
      <WorkspaceLayout title="Discurso / Reunión">
        <div className="h-full overflow-y-auto">
          <DiscursoPage workspaceId={workspaceId} />
        </div>
      </WorkspaceLayout>
    </>
  );
}

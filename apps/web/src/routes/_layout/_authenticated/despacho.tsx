import { createFileRoute, Link } from "@tanstack/react-router";
import { DespachoPage } from "@/components/despacho/despacho-page";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";

type DespachoSearchParams = {
  workspaceId?: string;
};

export const Route = createFileRoute("/_layout/_authenticated/despacho")({
  validateSearch: (search: Record<string, unknown>): DespachoSearchParams => ({
    workspaceId:
      typeof search.workspaceId === "string" && search.workspaceId.trim()
        ? search.workspaceId.trim()
        : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId: searchWorkspaceId } = Route.useSearch();
  const { data: workspaces, isLoading } = useGetWorkspaces();

  const resolvedWorkspaceId = searchWorkspaceId ?? workspaces?.[0]?.id;

  if (!searchWorkspaceId && isLoading) {
    return (
      <>
        <PageTitle title="Modo Despacho" />
        <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </>
    );
  }

  if (!resolvedWorkspaceId) {
    return (
      <>
        <PageTitle title="Modo Despacho" />
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="font-medium text-base text-foreground">
            No se encontró un despacho activo para mostrar.
          </p>
          <Button render={<Link to="/dashboard" />} className="min-h-12 px-5">
            Ir al panel principal
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Modo Despacho" />
      <DespachoPage workspaceId={resolvedWorkspaceId} />
    </>
  );
}

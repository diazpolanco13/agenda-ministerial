import { QueryClientContext } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { SquircleDashed } from "lucide-react";
import { useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import getProjectTaskRelations from "@/fetchers/task-relation/get-project-task-relations";
import getActiveWorkspaceUsers from "@/fetchers/workspace-user/get-active-workspace-users";
import { prefetchBoard } from "@/hooks/queries/task/prefetch-board";
import { cn } from "@/lib/cn";
import { isPlainClick } from "./is-plain-click";
import {
  PROJECT_ROUTE_PATHS,
  type ProjectView,
  QUICK_VIEW_TABS,
  routeForView,
} from "./project-views";
import { useProjectViewHref } from "./use-project-view-href";

type ProjectViewTabsProps = {
  workspaceId: string;
  projectId: string;
  currentView: ProjectView;
  onSelect: (view: ProjectView) => void;
  className?: string;
};

type ViewTabLinkProps = {
  view: ProjectView;
  label: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  workspaceId: string;
  projectId: string;
  active: boolean;
  onSelect: (view: ProjectView) => void;
  onPrefetch: (view: ProjectView) => void;
};

function ViewTabLink({
  view,
  label,
  shortcut,
  icon: Icon,
  workspaceId,
  projectId,
  active,
  onSelect,
  onPrefetch,
}: ViewTabLinkProps) {
  const { t } = useTranslation();
  const href = useProjectViewHref(view, workspaceId, projectId);

  const link = (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      onMouseEnter={() => onPrefetch(view)}
      onFocus={() => onPrefetch(view)}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onSelect(view);
      }}
      className={cn(
        "group relative inline-flex h-9 shrink-0 items-center gap-1.5 border-b-[1.5px] px-2.5 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        active
          ? "border-primary font-medium text-foreground"
          : "border-transparent font-normal text-muted-foreground hover:border-border/60 hover:text-foreground",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-75" aria-hidden={true} />
      <span>{label}</span>
      {shortcut ? (
        <kbd
          aria-hidden="true"
          className="hidden rounded border border-border/70 bg-muted/60 px-1 py-px font-mono text-[10px] leading-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80 lg:inline-flex"
        >
          {shortcut}
        </kbd>
      ) : null}
    </a>
  );

  if (!shortcut) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span className="text-[11px]">
          {t("tasks:view.shortcutHint", { key: shortcut })}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function ProjectViewTabs({
  workspaceId,
  projectId,
  currentView,
  onSelect,
  className,
}: ProjectViewTabsProps) {
  const { t } = useTranslation();
  const queryClient = useContext(QueryClientContext);
  const router = useRouter();

  const handlePrefetch = useCallback(
    (view: ProjectView) => {
      const route = routeForView(view);
      if (typeof router?.preloadRoute === "function") {
        void router
          .preloadRoute({
            to: PROJECT_ROUTE_PATHS[route],
            params: { workspaceId, projectId },
          })
          .catch(() => undefined);
      }

      if (!queryClient || !projectId) return;

      void prefetchBoard(queryClient, projectId);

      if (
        !queryClient.getQueryState(["task-relations", "project", projectId])
          ?.data
      ) {
        void queryClient.prefetchQuery({
          queryKey: ["task-relations", "project", projectId],
          queryFn: () => getProjectTaskRelations(projectId),
          staleTime: 30_000,
        });
      }

      if (
        workspaceId &&
        !queryClient.getQueryState(["active-workspace-users", workspaceId])
          ?.data
      ) {
        void queryClient.prefetchQuery({
          queryKey: ["active-workspace-users", workspaceId],
          queryFn: () => getActiveWorkspaceUsers({ workspaceId }),
          staleTime: 30_000,
        });
      }
    },
    [projectId, queryClient, router, workspaceId],
  );

  return (
    <nav
      aria-label={t("tasks:view.tabsAriaLabel")}
      className={cn(
        "flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-border/60 border-b px-2 sm:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        {QUICK_VIEW_TABS.map((tab) => (
          <ViewTabLink
            key={tab.id}
            view={tab.id}
            label={t(tab.labelKey)}
            shortcut={tab.shortcut}
            icon={tab.icon}
            workspaceId={workspaceId}
            projectId={projectId}
            active={currentView === tab.id}
            onSelect={onSelect}
            onPrefetch={handlePrefetch}
          />
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center border-border/60 border-l pl-2">
        <ViewTabLink
          view="backlog"
          label={t("tasks:view.backlog")}
          icon={SquircleDashed}
          workspaceId={workspaceId}
          projectId={projectId}
          active={currentView === "backlog"}
          onSelect={onSelect}
          onPrefetch={handlePrefetch}
        />
      </div>
    </nav>
  );
}

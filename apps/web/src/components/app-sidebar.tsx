import { Link, useLocation } from "@tanstack/react-router";
import type * as React from "react";
import { useEffect } from "react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { ThemeToggleDropdown } from "@/components/theme-toggle-dropdown";
import { TrialCard } from "@/components/trial-card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { VersionDisplay } from "@/components/version-display";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar();
  const pathname = useLocation({ select: (location) => location.pathname });

  // Navigation that doesn't start from a sidebar link (creating a project,
  // the command palette) must still dismiss the mobile drawer.
  useEffect(() => {
    if (pathname) setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="border-none"
      {...props}
    >
      <SidebarHeader className="pt-1 pb-1.5 gap-2">
        <div className="px-1.5 pt-1">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-md py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <img
              src="/marca/sigefanb.webp"
              alt="SIGEFANB"
              className="h-6 w-auto object-contain dark:hidden"
            />
            <img
              src="/marca/sigefanb-oscuro.png"
              alt="SIGEFANB"
              className="hidden h-6 w-auto object-contain dark:block"
            />
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">
              AGENDA
            </span>
          </Link>
        </div>
        <div
          className="flex h-0.5 w-full overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <span className="flex-1 bg-[#ffe600]" />
          <span className="flex-1 bg-[#0056a2]" />
          <span className="flex-1 bg-[#ec1651]" />
        </div>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden gap-1 py-1">
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary />
        <TrialCard />
        <div className="flex items-center justify-between">
          <VersionDisplay />
          <ThemeToggleDropdown />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

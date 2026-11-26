import { Link, useLocation } from "@tanstack/react-router";
import type * as React from "react";
import { useEffect } from "react";

import { BrandMark, TricolorBar } from "@/components/common/brand-mark";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import { TrialCard } from "@/components/trial-card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
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
      <SidebarHeader className="gap-2.5 px-2.5 pt-2.5 pb-2">
        <div className="px-1">
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-md py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <BrandMark size="sm" collapsibleIcon />
          </Link>
        </div>
        <TricolorBar className="w-full" />
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden gap-1 py-1">
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border/60 p-2">
        <TrialCard />
        <SidebarUserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}

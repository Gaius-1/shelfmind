"use client"

import * as React from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { authClient } from "#/lib/auth-client.ts"
import { NavUser } from "#/components/nav-user.tsx"
import { NavSecondary } from "#/components/nav-secondary.tsx"
// import FallbackAvatar from "#/components/fallback-avatar.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "#/components/ui/sidebar.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  CloudUploadIcon,
  TaskDone01Icon,
  CheckListIcon,
  PackageIcon,
  FileExportIcon,
  SentIcon,
  BookHeadphonesIcon,
} from "@hugeicons/core-free-icons"

export interface AppSidebarUser {
  name: string
  email: string
  avatar: string
}

type NavGroup = {
  label: string
  items: {
    title: string
    url: string
    icon: any
  }[]
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home01Icon },
    ],
  },
  {
    label: "Processing",
    items: [
      { title: "Uploads", url: "/dashboard/uploads", icon: CloudUploadIcon },
      { title: "Processing Queue", url: "/dashboard/processing-queue", icon: TaskDone01Icon },
      { title: "Review Queue", url: "/dashboard/review-queue", icon: CheckListIcon },
    ],
  },
  {
    label: "Data",
    items: [
      { title: "Product Repository", url: "/dashboard/products", icon: PackageIcon },
      { title: "Export Center", url: "/dashboard/exports", icon: FileExportIcon },
    ],
  },
]

const navSecondary = [
  {
    title: "Feedback",
    url: "#",
    icon: <HugeiconsIcon icon={SentIcon} strokeWidth={2} />,
  },
  {
    title: "Support",
    url: "#",
    icon: <HugeiconsIcon icon={BookHeadphonesIcon} strokeWidth={2} />,
  },
]

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user?: AppSidebarUser }) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const { data: session } = authClient.useSession()
  // const { data: activeOrg } = authClient.useActiveOrganization()

  const resolvedUser = user ?? {
    name: session?.user.name || "Anonymous",
    email: session?.user.email || "",
    avatar: session?.user.image || "",
  }

  // const workspaceName = activeOrg?.name || "ShelfMind"
  // const workspaceLabel = activeOrg ? "Organization" : "Workspace"

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="border-b border-dashed border-sidebar-border/30 pb-3 mb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="border border-dashed border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-all rounded-xl"
            >
              <Link to="/dashboard">
                <img src="/logo.png" alt="ShelfMind Logo" className="h-8 w-auto rounded-full" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-sidebar-foreground">
                    ShelfMind
                  </span>
                  <span className="truncate text-[11px] text-sidebar-foreground/50">
                    Workspace Dashboard
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-0.5 px-2">
            <SidebarGroupLabel className="h-5 text-[10.5px] uppercase tracking-widest text-sidebar-foreground/40 px-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map(({ title, url, icon }) => {
                const isActive =
                  url === "/dashboard"
                    ? pathname === "/dashboard" || pathname === "/dashboard/"
                    : pathname.startsWith(url)
                return (
                  <SidebarMenuItem key={url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={title}
                      className="rounded-lg text-[13px] font-medium h-9"
                    >
                      <Link to={url as any}>
                        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5" />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter className="border-t border-dashed border-sidebar-border/30 pt-3 mt-2">
        <NavUser user={resolvedUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

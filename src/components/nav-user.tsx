"use client"

import FallbackAvatar from "#/components/fallback-avatar.tsx"
import {
  Avatar,
  AvatarImage,
} from "#/components/ui/avatar.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "#/components/ui/sidebar.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UnfoldMoreIcon,
  CheckmarkBadgeIcon,
  LogoutIcon,
} from "@hugeicons/core-free-icons"
import { authClient } from "#/lib/auth-client.ts"
import { useRouter } from "@tanstack/react-router"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  async function handleLogout() {
    await authClient.signOut()
    router.navigate({ to: "/" })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg overflow-hidden">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : (
                  <FallbackAvatar name={user.name || "User"} size={32} animated className="rounded-lg" />
                )}
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg overflow-hidden">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt={user.name} />
                  ) : (
                    <FallbackAvatar name={user.name || "User"} size={32} animated={false} className="rounded-lg" />
                  )}
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <HugeiconsIcon icon={CheckmarkBadgeIcon} strokeWidth={2} />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

import { createFileRoute, Outlet } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { AppSidebar } from '#/components/app-sidebar.tsx'
import { ThemeSwitcher } from '#/components/theme-switcher.tsx'
import { OrganizationSwitcher } from '#/components/organization-switcher.tsx'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb.tsx'
import { Spinner } from '#/components/spinner.tsx'

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="ShelfMind" className="h-10 w-auto rounded-full animate-pulse" />
          <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>
    )
  }

  if (!session) {
    // redirect to login
    window.location.href = '/'
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: session.user.name || 'Anonymous',
          email: session.user.email,
          avatar: session.user.image || '',
        }}
      />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl px-4 sticky top-0 z-40 transition-all">
          <SidebarTrigger className="-ml-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors" />
          <Separator orientation="vertical" className="mr-2 h-6 my-4 bg-neutral-200 dark:bg-neutral-800" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href="/dashboard"
                  className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors text-xs"
                >
                  ShelfMind
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block text-neutral-300 dark:text-neutral-700" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-neutral-700 dark:text-neutral-300 text-xs font-semibold">
                  Dashboard
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-3">
            <OrganizationSwitcher />
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
            <ThemeSwitcher className="size-8 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors" />
          </div>
        </header>

        {/* Page content */}
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

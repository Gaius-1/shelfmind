"use client"

import { useEffect, useState } from "react"
import { authClient } from "#/lib/auth-client.ts"
import { Spinner } from "#/components/spinner.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, ArrowDownIcon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { cn } from "#/lib/utils.ts"
import FallbackAvatar from "#/components/fallback-avatar.tsx"

export function OrganizationSwitcher({ className }: { className?: string }) {
  const { data: session } = authClient.useSession()
  const {
    data: organizations,
    isPending: isListPending,
    refetch: refetchList,
  } = authClient.useListOrganizations()
  const {
    data: activeOrg,
    isPending: isActivePending,
    refetch: refetchActive,
  } = authClient.useActiveOrganization()

  const [isSwitching, setIsSwitching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [hasAttemptedAutoActivate, setHasAttemptedAutoActivate] = useState(false)

  // Reset attempt flag when user changes
  const currentUserId = session?.user?.id
  useEffect(() => {
    setHasAttemptedAutoActivate(false)
  }, [currentUserId])

  // Auto-activate the first org when logged in and nothing is active
  useEffect(() => {
    if (
      !isListPending &&
      !isActivePending &&
      !activeOrg &&
      organizations &&
      organizations.length > 0 &&
      session &&
      !hasAttemptedAutoActivate
    ) {
      setHasAttemptedAutoActivate(true)
      authClient.organization
        .setActive({ organizationId: organizations[0].id })
        .then(() => {
          refetchActive()
          refetchList()
        })
        .catch((err) => {
          console.error("Auto-activation failed", err)
        })
    }
  }, [isListPending, isActivePending, activeOrg, organizations, session, hasAttemptedAutoActivate])

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrg?.id) {
      setIsOpen(false)
      return
    }
    setIsSwitching(true)
    setIsOpen(false)
    try {
      await authClient.organization.setActive({ organizationId: orgId })
      await Promise.all([refetchActive(), refetchList()])
    } catch (err) {
      console.error("Failed to switch organization", err)
    } finally {
      setIsSwitching(false)
    }
  }

  const isLoading = isListPending || isActivePending || isSwitching

  return (
    <div className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-xl transition-all text-xs font-semibold",
          "bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900",
          "border border-dashed border-neutral-300 dark:border-neutral-700",
          "text-neutral-700 dark:text-neutral-300",
          "hover:border-neutral-400 dark:hover:border-neutral-600",
          "shadow-xs disabled:opacity-60 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
        )}
      >
        {isLoading ? (
          <Spinner size="sm" className="text-indigo-500 shrink-0" />
        ) : activeOrg ? (
          <FallbackAvatar
            name={activeOrg.name}
            size={16}
            className="rounded-md shrink-0"
          />
        ) : (
          <HugeiconsIcon
            icon={Building01Icon}
            strokeWidth={2}
            className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0"
          />
        )}

        <span className="truncate max-w-[140px]">
          {isLoading && !activeOrg
            ? "Loading..."
            : activeOrg?.name || "No Organization"}
        </span>

        <HugeiconsIcon
          icon={ArrowDownIcon}
          strokeWidth={2.5}
          className={cn(
            "size-3 text-neutral-400 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="p-1.5">
              <p className="px-2.5 pt-1 pb-2 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                Workspaces
              </p>

              {!organizations || organizations.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
                  No organizations found
                </div>
              ) : (
                organizations.map((org) => {
                  const isActive = org.id === activeOrg?.id
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => handleSwitch(org.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors text-sm",
                        "hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60",
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                          : "text-neutral-700 dark:text-neutral-300",
                      )}
                    >
                      <FallbackAvatar
                        name={org.name}
                        size={24}
                        className="rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-xs">{org.name}</p>
                      </div>
                      {isActive && (
                        <HugeiconsIcon
                          icon={CheckmarkCircle01Icon}
                          strokeWidth={2}
                          className="size-4 text-indigo-500 dark:text-indigo-400 shrink-0"
                        />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

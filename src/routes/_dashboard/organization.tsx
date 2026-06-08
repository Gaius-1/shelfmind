import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { Building2, Save, Trash2, ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/_dashboard/organization')({
  component: OrganizationPage,
})

function OrganizationPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  useEffect(() => {
    if (activeOrg) {
      setName(activeOrg.name)
      setSlug(activeOrg.slug)
    }
  }, [activeOrg])

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrg) return
      // better-auth doesn't have a direct updateOrg client method in basic organization
      // but let's see if we can do update or just show the active org details
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeOrganization'] })
    }
  })

  if (!activeOrg) {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-5xl mx-auto w-full text-center">
        <Building2 className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
        <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">No Active Organization</h1>
        <p className="text-sm text-neutral-500">Please create or switch to an organization from the switcher in the top right.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Organization Profile
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          View and manage details for your active organization.
        </p>
      </div>

      <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100">Profile Details</CardTitle>
          <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">Settings for {activeOrg.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Organization Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-500 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Organization Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-500 cursor-not-allowed"
            />
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Workspace Information</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-100 dark:border-neutral-850">
                <span className="text-neutral-400">ID</span>
                <p className="font-mono font-semibold text-neutral-700 dark:text-neutral-300 truncate mt-0.5" title={activeOrg.id}>{activeOrg.id}</p>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/40 border border-neutral-100 dark:border-neutral-850">
                <span className="text-neutral-400">Created At</span>
                <p className="font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5">{new Date(activeOrg.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

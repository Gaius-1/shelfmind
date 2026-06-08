import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Settings05Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { ToggleLeft, Save } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'

export const Route = createFileRoute('/_dashboard/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Settings
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Adjust your account workspace preferences and settings.
        </p>
      </div>

      <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100">Preferences</CardTitle>
          <CardDescription className="text-xs text-neutral-500">Configure notifications and interface display options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div>
              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Email Notifications</p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Receive alerts when new members join your organization.</p>
            </div>
            <ToggleLeft className="w-6 h-6 text-neutral-300 dark:text-neutral-700 cursor-pointer" />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div>
              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Developer Mode</p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Show technical IDs and database logs in dashboard widgets.</p>
            </div>
            <ToggleLeft className="w-6 h-6 text-neutral-300 dark:text-neutral-700 cursor-pointer" />
          </div>

          <div className="pt-4 flex justify-end">
            <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2">
              <Save className="w-3.5 h-3.5" />
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

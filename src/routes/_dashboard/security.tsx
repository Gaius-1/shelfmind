import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { ShieldCheck, Key, Laptop, Smartphone, Globe, ShieldAlert } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/security')({
  component: SecurityPage,
})

function SecurityPage() {
  const { data: session } = authClient.useSession()

  // Fallback session list as better-auth listSessions might require server endpoints/plugins enabled
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => {
      // safe fallback if not enabled or supported on simple local setup
      try {
        const res = await authClient.listSessions()
        return res || []
      } catch {
        return []
      }
    },
    retry: false
  })

  if (!session) return null

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Security & Access
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your credentials, active sessions, and access permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-6">
          {/* Active Sessions */}
          <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-neutral-500" />
                Active Sessions
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">Device logins currently authorized to access your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-250 flex items-center gap-1.5">
                      Current Browser Session
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
                    </p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Expires on {new Date(session.session.expiresAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MFA Mock/Details */}
          <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-neutral-500" />
                Multi-Factor Authentication
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500">Secure your account with two-step verification.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Authenticator App (TOTP)</p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Use Google Authenticator or 1Password to generate verification codes.</p>
                </div>
                <span className="text-xs font-semibold text-neutral-400">Disabled</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4">
          <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-neutral-850 dark:text-neutral-150 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-500" />
                Access Level
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/40 dark:border-neutral-800/40 text-xs">
                <p className="font-semibold text-neutral-700 dark:text-neutral-350">User Profile ID</p>
                <p className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 truncate" title={session.user.id}>{session.user.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { LoginForm } from '#/components/login-form.tsx'
import { OrganizationSwitcher } from '#/components/organization-switcher.tsx'
import { Spinner } from '#/components/spinner.tsx'
import AnimatedGradient from '#/components/animated-gradient.tsx'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { ThemeSwitcher } from '#/components/theme-switcher.tsx'
import { useQuery } from '@tanstack/react-query'
import {
  Database,
  Check,
  LogOut,
  User,
  Shield,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const { data: activeOrg, refetch: refetchActiveOrg } = authClient.useActiveOrganization()
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Fetch organization members using TanStack Query
  const {
    data: members = [],
    isLoading: isMembersLoading,
    refetch: refetchMembers
  } = useQuery({
    queryKey: ['org-members', activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return []
      const res = await authClient.organization.listMembers()
      return res.data?.members || []
    },
    enabled: !!activeOrg?.id,
  })

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !activeOrg) return
    
    setIsInviting(true)
    setInviteSuccess(null)
    setInviteError(null)

    try {
      const { error } = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      })

      if (error) {
        setInviteError(error.message || "Failed to send invitation.")
      } else {
        setInviteSuccess(`Invitation successfully sent to ${inviteEmail}!`)
        setInviteEmail("")
      }
    } catch (err: any) {
      setInviteError(err.message || "An unexpected error occurred.")
    } finally {
      setIsInviting(false)
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut()
  }

  // Centered Loading State
  if (isSessionPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-radial from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>
    )
  }

  // 1. GUEST STATE (NOT LOGGED IN)
  if (!session) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 ${isDark ? 'text-neutral-50' : 'text-neutral-900'}`}>
        <div className={`absolute inset-0 -z-10 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`} />
        <AnimatedGradient
          config={{
            preset: "custom",
            color1: isDark ? "#0f172a" : "#f8fafc", // Softer slate-900 base vs clean slate-50 base
            color2: isDark ? "#2563eb" : "#3b82f6", // Royal blue vs standard blue
            color3: isDark ? "#ea580c" : "#f97316", // Deep orange vs standard orange
            rotation: -50,
            proportion: 1,
            scale: 0.01,
            speed: 30,
            distortion: 0,
            swirl: 50,
            swirlIterations: 16,
            softness: 47,
            offset: -299,
            shape: "Checks",
            shapeSize: 45,
          }}
          noise={{ opacity: 0.04 }}
        />
        
        <div className="absolute top-4 right-4 z-20">
          <ThemeSwitcher className="size-9 rounded-xl text-neutral-200 hover:bg-white/10" />
        </div>
        <div className="w-full max-w-md z-10 flex flex-col gap-6 items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ShelfMind Logo" className="h-12 w-auto rounded-full" />
          </div>
          <LoginForm />
        </div>
      </div>
    )
  }

  // 2. AUTHENTICATED STATE (LOGGED IN)
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex flex-col">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200/60 dark:border-neutral-800/60 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-200/60 dark:border-neutral-800/60 shadow-md">
              <img src="/logo.png" alt="ShelfMind Logo" className="h-6 w-auto rounded-full" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-indigo-600 dark:text-indigo-400">ShelfMind</span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <OrganizationSwitcher />
            
            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
            
            <ThemeSwitcher className="size-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors" />

            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

            {/* User Dropdown Preview */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{session.user.name || 'Anonymous User'}</span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{session.user.email}</span>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="size-9 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 shadow-xs">
          <div className="flex items-center gap-4">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-md" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/30">
                <User className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Welcome, {session.user.name || 'User'}!</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Manage your personal active workspace and sync states.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/30 dark:border-emerald-800/30 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
              Active Session Verified
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/30 dark:border-indigo-800/30 text-xs font-medium text-indigo-700 dark:text-indigo-400">
              Role: {activeOrg ? "Org Owner" : "Personal User"}
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Active Org Info (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {activeOrg ? (
              <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        {activeOrg.name} Workspace
                      </CardTitle>
                      <CardDescription className="text-neutral-500 dark:text-neutral-400 mt-1">
                        Active tenant synchronization details
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { refetchActiveOrg(); refetchMembers(); }}
                      className="rounded-xl border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Sync Status
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Org attributes table */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/40 dark:border-neutral-800/40">
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Slug</span>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5">{activeOrg.slug}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Tenant ID</span>
                      <p className="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5 truncate" title={activeOrg.id}>{activeOrg.id}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Created At</span>
                      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {new Date(activeOrg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Cloudflare D1 / Drizzle Synchronization Stats */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">Database Sync Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 flex gap-3 items-start">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Edge Replication</h5>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Drizzle ORM schema synced successfully with SQLite Cloudflare D1 database.</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-indigo-500/[0.04] border border-indigo-500/20 flex gap-3 items-start">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-50/10 text-indigo-600 dark:text-indigo-400">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Organization Boundaries</h5>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">All data accesses isolated inside tenant ID {activeOrg.id}.</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Team Members List */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center justify-between">
                      <span>Workspace Members ({members.length})</span>
                      {isMembersLoading && <Spinner size="sm" />}
                    </h4>
                    
                    <div className="border border-neutral-200/60 dark:border-neutral-800/60 rounded-2xl overflow-hidden divide-y divide-neutral-200/50 dark:divide-neutral-800/50">
                      {members.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-white/40 dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-950/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                              <User className="w-4.5 h-4.5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                                {member.user?.name || "Anonymous member"}
                                {member.userId === session.user.id && (
                                  <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">You</span>
                                )}
                              </p>
                              <p className="text-xs text-neutral-400 dark:text-neutral-500">{member.user?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 capitalize">
                              {member.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-3xl border-dashed border-2 border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-12 text-center flex flex-col items-center gap-4 justify-center">
                <div className="h-14 w-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">No active organization</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mt-1">
                    Select an organization from the switcher at the top, or click the plus button to set up your team workspace.
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Action Panel / Team Invitations (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                  Invite Members
                </CardTitle>
                <CardDescription className="text-neutral-500 dark:text-neutral-400">
                  Add collaborators to your active organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email" className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Email Address
                    </Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="collaborator@example.com"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={!activeOrg || isInviting}
                      className="rounded-xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 focus:bg-white dark:focus:bg-neutral-900 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Organization Role
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={inviteRole === "member" ? "default" : "outline"}
                        onClick={() => setInviteRole("member")}
                        disabled={!activeOrg || isInviting}
                        className={`rounded-xl h-9 text-xs font-semibold border-neutral-200 dark:border-neutral-800 ${
                          inviteRole === "member" 
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        Member
                      </Button>
                      <Button
                        type="button"
                        variant={inviteRole === "admin" ? "default" : "outline"}
                        onClick={() => setInviteRole("admin")}
                        disabled={!activeOrg || isInviting}
                        className={`rounded-xl h-9 text-xs font-semibold border-neutral-200 dark:border-neutral-800 ${
                          inviteRole === "admin" 
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        Admin
                      </Button>
                    </div>
                  </div>

                  {inviteError && (
                    <p className="p-3 text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/30 rounded-xl">
                      {inviteError}
                    </p>
                  )}

                  {inviteSuccess && (
                    <p className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 rounded-xl">
                      {inviteSuccess}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={!activeOrg || isInviting || !inviteEmail.trim()}
                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isInviting ? (
                      <>
                        <Spinner size="sm" className="text-white" />
                        Sending Invite...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                  Database Tables
                </CardTitle>
                <CardDescription className="text-neutral-500 dark:text-neutral-400">
                  Local SQLite Schema Sync status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/30 dark:border-neutral-800/30">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">organization</span>
                  </div>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold uppercase">Synced</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/30 dark:border-neutral-800/30">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">member</span>
                  </div>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold uppercase">Synced</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/30 dark:border-neutral-800/30">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">user</span>
                  </div>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold uppercase">Synced</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
        </div>
      </main>
    </div>
  )
}

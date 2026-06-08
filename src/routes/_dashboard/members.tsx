import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client.ts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Spinner } from '#/components/spinner.tsx'
import { Users, UserPlus, Mail, Shield, User, Trash2, Crown, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import { useState } from 'react'

export const Route = createFileRoute('/_dashboard/members')({
  component: MembersPage,
})

const ROLE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  owner: { label: 'Owner', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40', icon: Crown },
  admin: { label: 'Admin', color: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/40', icon: Shield },
  member: { label: 'Member', color: 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-800/40', icon: User },
}

function MembersPage() {
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteOpen, setInviteOpen] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', activeOrg?.id],
    queryFn: async () => {
      const res = await authClient.organization.listMembers()
      return res.data?.members || []
    },
    enabled: !!activeOrg?.id,
  })

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: 'admin' | 'member' }) => {
      return authClient.organization.inviteMember({ email, role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', activeOrg?.id] })
      setInviteEmail('')
      setInviteOpen(false)
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return authClient.organization.removeMember({ memberIdOrEmail: memberId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', activeOrg?.id] })
    },
  })

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Members
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Manage who has access to your organization.
          </p>
        </div>
        <Button
          onClick={() => setInviteOpen(true)}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-2 shadow-sm shadow-indigo-600/20"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      {/* Invite form */}
      {inviteOpen && (
        <Card className="rounded-3xl border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base text-neutral-800 dark:text-neutral-100">Invite a new member</CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">An invitation will be sent to the email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2">
                <Button
                  onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm flex-1"
                >
                  {inviteMutation.isPending ? <Spinner size="sm" className="text-white" /> : <><Mail className="w-4 h-4 mr-1.5" />Send Invite</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-xl border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
            {inviteMutation.isError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{(inviteMutation.error as Error)?.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100">
                Team ({isLoading ? '…' : members.length})
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {activeOrg?.name || 'Your organization'}
              </CardDescription>
            </div>
            {isLoading && <Spinner size="sm" className="text-neutral-400" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {members.length === 0 && !isLoading ? (
              <div className="px-6 py-12 text-center">
                <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">No members yet</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Invite your first team member above.</p>
              </div>
            ) : members.map((member: any) => {
              const roleMeta = ROLE_META[member.role] ?? ROLE_META.member
              const RoleIcon = roleMeta.icon
              const isMe = member.userId === session?.user.id
              return (
                <div key={member.id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50/80 dark:hover:bg-neutral-950/30 transition-colors">
                  <div className="flex items-center gap-4">
                    {member.user?.image ? (
                      <img src={member.user.image} alt="" className="h-10 w-10 rounded-xl border border-neutral-200 dark:border-neutral-700 object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                        {(member.user?.name || 'A')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                          {member.user?.name || 'Anonymous'}
                        </p>
                        {isMe && (
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">YOU</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">{member.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${roleMeta.color}`}>
                      <RoleIcon className="w-3 h-3" />
                      {roleMeta.label}
                    </span>
                    {!isMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-40">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => removeMutation.mutate(member.id)}
                            className="text-rose-600 dark:text-rose-400 focus:bg-rose-50 dark:focus:bg-rose-950/40 focus:text-rose-700 rounded-lg text-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Database, Image, Send, CheckCircle2, Server, Terminal, Cpu } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/infrastructure')({
  component: InfrastructurePage,
})

function ResourceCard({
  title,
  type,
  binding,
  status,
  details,
  icon: Icon,
  color,
}: {
  title: string
  type: string
  binding: string
  status: 'connected' | 'error' | 'pending'
  details: { label: string; value: string }[]
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100">{title}</CardTitle>
            <CardDescription className="text-xs text-neutral-500">{type} Binding</CardDescription>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-800/40">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Active
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/40 dark:border-neutral-800/40 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Binding Name</span>
            <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">{binding}</span>
          </div>
          {details.map((d) => (
            <div key={d.label} className="flex justify-between text-xs">
              <span className="text-neutral-400">{d.label}</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[180px]" title={d.value}>{d.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InfrastructurePage() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <Server className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Cloudflare Infrastructure
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Monitor your D1 Database, R2 Buckets, and Message Queues configured in Wrangler.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResourceCard
          title="D1 Database"
          type="SQL Database"
          binding="DB"
          status="connected"
          icon={Database}
          color="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
          details={[
            { label: 'Database Name', value: 'shelfmind-db' },
            { label: 'Sync Adapter', value: 'drizzle-orm/better-sqlite3' },
            { label: 'Environment', value: 'Local Dev / Cloudflare Edge' },
          ]}
        />

        <ResourceCard
          title="Product Images"
          type="R2 Bucket"
          binding="PRODUCT_IMAGES"
          status="connected"
          icon={Image}
          color="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
          details={[
            { label: 'Bucket Name', value: 'shelfmind-images' },
            { label: 'Storage Class', value: 'Standard Storage' },
            { label: 'Access Control', value: 'Private / Signed URLs' },
          ]}
        />

        <ResourceCard
          title="Exports Bucket"
          type="R2 Bucket"
          binding="EXPORTS"
          status="connected"
          icon={Image}
          color="bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
          details={[
            { label: 'Bucket Name', value: 'shelfmind-exports' },
            { label: 'Storage Class', value: 'Standard Storage' },
            { label: 'Retention Policy', value: 'None (Default)' },
          ]}
        />

        <ResourceCard
          title="Image Queue"
          type="Queue Producer"
          binding="IMAGE_QUEUE"
          status="connected"
          icon={Send}
          color="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
          details={[
            { label: 'Queue Name', value: 'image-processing' },
            { label: 'Max Retries', value: '3' },
            { label: 'Dead Letter Queue', value: 'None' },
          ]}
        />
      </div>

      {/* Connection Info */}
      <Card className="rounded-3xl border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neutral-500" />
            Local Emulation & Wrangler
          </CardTitle>
          <CardDescription className="text-xs text-neutral-500">How ShelfMind integrates with Cloudflare resources during development.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-neutral-600 dark:text-neutral-400">
          <p>
            When running locally using <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px]">npm run dev</code> (Miniflare / Wrangler Dev), bindings are automatically mapped to local directories:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>DB</strong> maps to SQLite storage in your local miniflare state.</li>
            <li><strong>PRODUCT_IMAGES / EXPORTS</strong> store objects in the local filesystem sandbox.</li>
            <li><strong>IMAGE_QUEUE</strong> routes messages internally via local events.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

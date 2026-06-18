import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Database, ShieldAlert, AlertCircle, Copy, Layers } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

interface StatsCardsProps {
  stats: {
    totalProducts: number
    meanConfidence: number
    flaggedCount: number
    totalJobs: number
    pendingDuplicates: number
  }
  className?: string
}

export function StatsCards({ stats, className }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Active Products',
      value: stats.totalProducts.toLocaleString(),
      description: 'Master catalog records',
      icon: Database,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      borderColor: 'border-indigo-100 dark:border-indigo-950/40',
    },
    {
      title: 'Mean Confidence',
      value: `${(stats.meanConfidence * 100).toFixed(1)}%`,
      description: 'Average extraction quality',
      icon: ShieldAlert,
      iconColor: cn(
        stats.meanConfidence >= 0.85
          ? 'text-emerald-600 dark:text-emerald-400'
          : stats.meanConfidence >= 0.70
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-rose-600 dark:text-rose-400',
      ),
      bgColor: cn(
        stats.meanConfidence >= 0.85
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
          : stats.meanConfidence >= 0.70
            ? 'bg-amber-50/50 dark:bg-amber-950/20'
            : 'bg-rose-50/50 dark:bg-rose-950/20',
      ),
      borderColor: cn(
        stats.meanConfidence >= 0.85
          ? 'border-emerald-100 dark:border-emerald-950/40'
          : stats.meanConfidence >= 0.70
            ? 'border-amber-100 dark:border-amber-950/40'
            : 'border-rose-100 dark:border-rose-950/40',
      ),
    },
    {
      title: 'Flagged Records',
      value: stats.flaggedCount.toLocaleString(),
      description: 'Confidence below 75%',
      icon: AlertCircle,
      iconColor: stats.flaggedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500',
      bgColor: stats.flaggedCount > 0 ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'bg-neutral-50/50 dark:bg-neutral-900/20',
      borderColor: stats.flaggedCount > 0 ? 'border-amber-100 dark:border-amber-950/40' : 'border-neutral-100 dark:border-neutral-800/40',
    },
    {
      title: 'Pending Duplicates',
      value: stats.pendingDuplicates.toLocaleString(),
      description: 'Identified candidate pairs',
      icon: Copy,
      iconColor: stats.pendingDuplicates > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-500',
      bgColor: stats.pendingDuplicates > 0 ? 'bg-rose-50/50 dark:bg-rose-950/20' : 'bg-neutral-50/50 dark:bg-neutral-900/20',
      borderColor: stats.pendingDuplicates > 0 ? 'border-rose-100 dark:border-rose-950/40' : 'border-neutral-100 dark:border-neutral-800/40',
    },
    {
      title: 'Total Batches',
      value: stats.totalJobs.toLocaleString(),
      description: 'Ingestion pipeline runs',
      icon: Layers,
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50/50 dark:bg-cyan-950/20',
      borderColor: 'border-cyan-100 dark:border-cyan-950/40',
    },
  ]

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-5', className)}>
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <Card
            key={i}
            className={cn(
              'border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden',
              card.borderColor,
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase">
                {card.title}
              </CardTitle>
              <div className={cn('p-2 rounded-xl border border-transparent', card.bgColor)}>
                <Icon className={cn('h-4 w-4', card.iconColor)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                {card.value}
              </div>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

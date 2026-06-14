import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card.tsx'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select.tsx'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '#/components/ui/chart.tsx'
import { Badge } from '#/components/reui/badge.tsx'
import { HugeiconsIcon } from '@hugeicons/react'
import { TradeUpIcon, TradeDownIcon } from '@hugeicons/core-free-icons'

interface SparklineData {
  time: string
  value: number
}

interface AnalyticsSparklinesProps {
  totalProducts: number
  avgConfidence: number
  flaggedCount: number
}

// Dummy historical data for trendline visualization
const generateSparkline = (points: number, min: number, max: number, decimals: number = 0): SparklineData[] => {
  return Array.from({ length: points }).map((_, i) => ({
    time: `Day ${i + 1}`,
    value: Number((Math.random() * (max - min) + min).toFixed(decimals)),
  }))
}

const totalProductsData = generateSparkline(8, 1000, 1500, 0)
const confidenceData = generateSparkline(8, 0.8, 0.95, 2)
const flaggedData = generateSparkline(8, 20, 50, 0).sort((a, b) => b.value - a.value)

export function AnalyticsSparklines({ totalProducts, avgConfidence, flaggedCount }: AnalyticsSparklinesProps) {
  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Analytics Overview</h2>
        <Select defaultValue="today">
          <SelectTrigger className="w-[100px] h-8 bg-card border-border text-xs text-foreground rounded-lg">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        <SparklineCard 
          title="Total Products Processed"
          shortLabel="Products"
          value={totalProducts.toLocaleString()}
          subtitle="Overall volume processed"
          data={totalProductsData}
          color="var(--color-primary)"
          gradientId="sparkline-primary"
          trend="+12%"
          trendIcon={TradeUpIcon}
          trendVariant="success-light"
        />
        <SparklineCard 
          title="Avg. Extraction Confidence"
          shortLabel="Confidence"
          value={avgConfidence.toFixed(2)}
          subtitle="Hybrid AI determinism"
          data={confidenceData}
          color="var(--color-success)"
          gradientId="sparkline-success"
          trend="+3.5%"
          trendIcon={TradeUpIcon}
          trendVariant="success-light"
        />
        <SparklineCard 
          title="Flagged for Review"
          shortLabel="Flagged"
          value={flaggedCount.toString()}
          subtitle="Needs human validation"
          data={flaggedData}
          color="var(--color-warning)"
          gradientId="sparkline-warning"
          trend="-5%"
          trendIcon={TradeDownIcon}
          trendVariant="info-light"
        />
      </div>
    </div>
  )
}

import { Frame, FramePanel } from '#/components/reui/frame.tsx'

function SparklineCard({ 
  title, 
  shortLabel,
  value, 
  subtitle, 
  data, 
  color, 
  gradientId,
  trend,
  trendIcon,
  trendVariant
}: { 
  title: string, 
  shortLabel: string,
  value: string, 
  subtitle: string, 
  data: SparklineData[], 
  color: string, 
  gradientId: string,
  trend: string,
  trendIcon: any,
  trendVariant: any
}) {
  const chartConfig = {
    value: {
      label: shortLabel,
      color: color,
    },
  } satisfies ChartConfig

  return (
    <Frame spacing="xs" className="h-full w-full">
      <FramePanel className="flex flex-col w-full h-full p-0 overflow-hidden bg-card border-none shadow-none">
        <div className="p-5 pb-0">
          <div className="flex flex-row items-start justify-between gap-2">
            <span className="text-xs font-medium text-foreground leading-tight truncate">{title}</span>
            <Badge variant={trendVariant} className="shrink-0 rounded-md mt-0.5">
              <HugeiconsIcon icon={trendIcon} strokeWidth={2} aria-hidden="true" className="size-3 mr-1" />
              {trend}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-foreground mt-2 tracking-tight">
            {value}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</div>
        </div>
        <div className="pt-2 flex-1 pb-4 px-2">
          <ChartContainer config={chartConfig} className="w-full h-full min-h-[120px]">
            <AreaChart
              accessibilityLayer
              data={data}
              margin={{ top: 10, right: 10, bottom: 0, left: -15 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
                <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis 
                dataKey="time" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8} 
                className="text-[10px] fill-muted-foreground" 
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8} 
                className="text-[10px] fill-muted-foreground"
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" className="min-w-32 gap-1.5 p-2 shadow-xl" />}
              />
              <Area
                dataKey="value"
                type="monotone"
                fill={`url(#${gradientId})`}
                stroke={color}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: color,
                  strokeWidth: 2,
                  stroke: "var(--background)",
                  filter: `url(#${gradientId}-glow)`,
                }}
                activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--background)" }}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </FramePanel>
    </Frame>
  )
}

import { Pie, PieChart, Label } from 'recharts'
import { ChartContainer, type ChartConfig } from '#/components/ui/chart.tsx'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'

interface PipelineStorageProps {
  percentageUsed: number
}

export function PipelineStorage({ percentageUsed }: PipelineStorageProps) {
  const usedGB = percentageUsed * 10
  const totalGB = 1000
  const freeGB = totalGB - usedGB

  const chartData = [
    { name: "Used", value: usedGB, fill: "var(--color-primary)" },
    { name: "Free", value: freeGB, fill: "var(--color-input)" }
  ]

  const chartConfig = {
    Used: { label: "Used (GB)", color: "var(--color-primary)" },
    Free: { label: "Free (GB)", color: "var(--color-input)" }
  } satisfies ChartConfig

  return (
    <Frame spacing="xs" className="w-full h-full">
      <FramePanel className="w-full flex flex-row items-center justify-between gap-4 p-6 overflow-hidden bg-card border-none shadow-none h-full">
        <div className="flex flex-col gap-1.5 flex-1 max-w-[65%]">
          <h3 className="text-[15px] font-semibold text-foreground leading-tight">
            Pipeline Storage
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            {usedGB}GB used out of {totalGB}GB total capacity.
          </p>
        </div>

        <div className="relative flex items-center justify-center shrink-0">
          <ChartContainer
            config={chartConfig}
            className="w-24 h-24 aspect-square"
          >
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={36}
                outerRadius={42}
                stroke="none"
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold tracking-tight tabular-nums"
                            dy={8}
                          >
                            {percentageUsed}%
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </FramePanel>
    </Frame>
  )
}

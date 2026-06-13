import * as React from 'react'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { Pie, PieChart, Label } from 'recharts'
import { ChartContainer, type ChartConfig } from '#/components/ui/chart.tsx'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'

interface GlobalWorkspaceConfidenceProps {
  confidence: number
}

export function GlobalWorkspaceConfidence({ confidence }: GlobalWorkspaceConfidenceProps) {
  // To create a progress ring, we use two pie segments: 
  // one for the filled part (confidence) and one for the empty part (1 - confidence)
  const chartData = [
    { name: "Confidence", value: confidence, fill: "var(--color-primary)" },
    { name: "Remaining", value: 1 - confidence, fill: "var(--color-input)" }
  ]

  const chartConfig = {
    Confidence: { label: "Confidence", color: "var(--color-primary)" },
    Remaining: { label: "Remaining", color: "var(--color-input)" }
  } satisfies ChartConfig

  return (
    <Frame spacing="xs" className="w-full h-full">
      <FramePanel className="w-full flex items-center justify-between gap-4 p-6 overflow-hidden bg-card border-none shadow-none h-full">
        <div className="flex flex-col gap-1.5 flex-1 max-w-[65%]">
          <h3 className="text-[15px] font-semibold text-foreground leading-tight">
            Global Workspace Confidence
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            Qwen2.5-VL and ZXing determinism are running optimally for this organisation.
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
                startAngle={90}
                endAngle={-270}
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
                            {confidence.toFixed(2)}
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

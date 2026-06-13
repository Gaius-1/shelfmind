import { Badge } from "#/components/reui/badge.tsx"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import { File01Icon } from "@hugeicons/core-free-icons"

export function Pattern() {
  return (
    <div className="flex items-center justify-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <div className="flex items-center gap-1">
              <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4" aria-hidden="true" />
              <span className="text-sm">report-q4.pdf</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="p-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="bg-muted rounded-md flex size-8 shrink-0 items-center justify-center">
                  <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="text-muted-foreground size-4" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">report-q4.pdf</span>
                  <span className="opacity-80">
                    2.4 MB &middot; Uploaded 3 days ago
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="info" size="xs">
                  PDF
                </Badge>
                <Badge variant="success" size="xs">
                  Verified
                </Badge>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
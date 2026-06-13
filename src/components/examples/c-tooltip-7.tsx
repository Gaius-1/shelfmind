import { Badge } from "#/components/reui/badge.tsx"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkBadge01Icon } from "@hugeicons/core-free-icons"

export function Pattern() {
  return (
    <div className="flex items-center justify-center">
      <TooltipProvider>
        <p className="text-sm">
          Verified domain{" "}
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground align-middle">
              <HugeiconsIcon icon={CheckmarkBadge01Icon} strokeWidth={2} className="size-4 text-emerald-600" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">
                  Verified
                </Badge>
                <p>Domain ownership has been confirmed.</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </p>
      </TooltipProvider>
    </div>
  )
}
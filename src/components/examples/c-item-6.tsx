import { Badge } from "#/components/reui/badge.tsx"

import { Button } from "#/components/ui/button.tsx"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "#/components/ui/item.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import { File02Icon, GoogleSheetIcon, ImageIcon } from "@hugeicons/core-free-icons"

export function Pattern() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2">
      <Item variant="outline" size="xs">
        <ItemMedia variant="icon">
          <HugeiconsIcon icon={File02Icon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Quarterly Report.pdf</ItemTitle>
          <ItemDescription>2.4 MB &middot; Updated 2 hours ago</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="success-light" size="sm">
            Final
          </Badge>
          <Button variant="outline" size="sm" className="ml-2">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline" size="xs">
        <ItemMedia variant="icon">
          <HugeiconsIcon icon={GoogleSheetIcon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Budget 2025.xlsx</ItemTitle>
          <ItemDescription>856 KB &middot; Updated yesterday</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="warning-light" size="sm">
            Draft
          </Badge>
          <Button variant="outline" size="sm" className="ml-2">
            Open
          </Button>
        </ItemActions>
      </Item>
      <Item variant="outline" size="xs">
        <ItemMedia variant="icon">
          <HugeiconsIcon icon={ImageIcon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Hero Banner.png</ItemTitle>
          <ItemDescription>4.1 MB &middot; Updated 3 days ago</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="info-light" size="sm">
            Review
          </Badge>
          <Button variant="outline" size="sm" className="ml-2">
            Open
          </Button>
        </ItemActions>
      </Item>
    </div>
  )
}
import { Button } from "#/components/ui/button.tsx"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog.tsx"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"

export function Pattern() {
  return (
    <div className="flex items-center justify-center">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Delete Item</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="bg-destructive/10 text-destructive rounded-full flex size-10 shrink-0 items-center justify-center">
                <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5" />
              </div>
              <div className="flex flex-col gap-1">
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the
                  item and remove all associated data from our servers.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
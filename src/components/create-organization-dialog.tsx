"use client"

import React, { useState } from "react"
import { authClient } from "#/lib/auth-client.ts"
import { Spinner } from "#/components/spinner.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Label } from "#/components/ui/label.tsx"

interface CreateOrganizationDialogProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateOrganizationDialog({
  trigger,
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 48)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setName(val)
    setSlug(generateSlug(val))
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Organization name is required.")
      return
    }
    setIsLoading(true)
    setError(null)

    const { error: createError } = await authClient.organization.create({
      name: name.trim(),
      slug: slug || generateSlug(name.trim()),
    })

    setIsLoading(false)

    if (createError) {
      setError(createError.message || "Failed to create organization.")
    } else {
      setName("")
      setSlug("")
      onSuccess?.()
      onOpenChange?.(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Set up a new workspace to collaborate with your team.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              placeholder="Acme Inc."
              value={name}
              onChange={handleNameChange}
              disabled={isLoading}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-slug">
              URL slug{" "}
              <span className="text-muted-foreground text-xs font-normal">
                (auto-generated)
              </span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">
                shelfmind.app/
              </span>
              <Input
                id="org-slug"
                className="pl-[7.5rem]"
                placeholder="acme-inc"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || !name.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2 text-white" />
                Creating…
              </>
            ) : (
              "Create organization"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

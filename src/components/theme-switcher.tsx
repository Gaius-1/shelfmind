"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { Button } from "#/components/ui/button.tsx"

interface ThemeSwitcherProps {
  className?: string
  variant?: "ghost" | "outline"
}

export function ThemeSwitcher({ className, variant = "ghost" }: ThemeSwitcherProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after client mount
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="size-9 rounded-xl" />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={className}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark
        ? <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
        : <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
      }
    </Button>
  )
}

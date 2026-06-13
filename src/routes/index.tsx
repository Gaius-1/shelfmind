import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { authClient } from '#/lib/auth-client.ts'
import { LoginForm } from '#/components/login-form.tsx'
import { ThemeSwitcher } from '#/components/theme-switcher.tsx'
import { Spinner } from '#/components/spinner.tsx'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'ShelfMind - Product Catalog Data Extraction' },
      { name: 'description', content: 'Intelligent product catalog data extraction. Automatically scan barcodes and extract 13 key attributes using advanced vision language models.' }
    ]
  }),
  component: Home
})

function Home() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) {
      navigate({ to: '/dashboard' })
    }
  }, [session, navigate])

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-radial from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950">
        <Spinner size="lg" className="text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  // Prevent flash of login form if user is logged in and redirecting
  if (session) {
    return null
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-radial from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950 relative overflow-hidden transition-colors duration-300">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher className="size-10 rounded-2xl border border-neutral-200/40 dark:border-neutral-800/40 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-all flex items-center justify-center shadow-xs" />
      </div>
      
      <div className="w-full max-w-md z-10 flex flex-col gap-8 items-center">
        {/* Branding header */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-16 w-16 rounded-3xl bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-200/60 dark:border-neutral-800/60 shadow-lg p-2.5">
            <img src="/logo.png" alt="ShelfMind Logo" className="h-full w-auto rounded-xl object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 mt-4">
            Shelf<span className="text-indigo-600 dark:text-indigo-400">Mind</span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center font-medium max-w-xs leading-relaxed">
            Intelligent catalog ingestion: extract barcodes and 13 key attributes with deep-learning vision models.
          </p>
        </div>
        
        {/* Auth Box */}
        <LoginForm />
      </div>
    </div>
  )
}

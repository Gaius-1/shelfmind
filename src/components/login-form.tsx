"use client"

import React, { useState } from "react"
import { cn } from "#/lib/utils.ts"
import { Button } from "#/components/ui/button.tsx"
import { useTheme } from "next-themes"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx"
import {
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from "#/components/ui/field.tsx"
import { LabelInput } from "#/components/label-input.tsx"
import { Spinner } from "#/components/spinner.tsx"
import { authClient } from "#/lib/auth-client.ts"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isSignUp) {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: window.location.origin,
        })

        if (signUpError) {
          setError(signUpError.message || "Failed to create account.")
        } else {
          setSuccess("Account & organization successfully created! Redirecting...")
          setTimeout(() => {
            window.location.href = "/"
          }, 1500)
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
          callbackURL: window.location.origin,
        })


        if (signInError) {
          setError(signInError.message || "Failed to sign in. Please check your credentials.")
        } else {
          setSuccess("Successfully signed in! Redirecting...")
          setTimeout(() => {
            window.location.href = "/"
          }, 1000)
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: "google" | "github") => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: window.location.origin,
      })
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}.`)
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-md mx-auto", className)} {...props}>
      <Card className={cn(
        "border transition-all duration-300 shadow-2xl backdrop-blur-2xl",
        isDark 
          ? "bg-neutral-900/90 border-white/10 text-neutral-50 shadow-black/30" 
          : "bg-white/95 border-neutral-200 text-neutral-900 shadow-neutral-200/50"
      )}>
        <CardHeader className="text-center pt-8">
          <CardTitle className={cn(
            "text-2xl font-semibold tracking-tight",
            isDark ? "text-neutral-50" : "text-neutral-900"
          )}>
            {isSignUp ? "Create your account" : "Welcome back"}
          </CardTitle>
          <CardDescription className={cn(
            "mt-2",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}>
            {isSignUp
              ? "Start managing your library and organization today"
              : "Login to access your personal dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup className="gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  disabled={isLoading}
                  className={cn(
                    "rounded-xl h-10 transition-colors",
                    isDark 
                      ? "border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10 hover:text-white" 
                      : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => handleSocialLogin("github")}
                  disabled={isLoading}
                  className={cn(
                    "rounded-xl h-10 transition-colors",
                    isDark 
                      ? "border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10 hover:text-white" 
                      : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <svg className="mr-2 h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  GitHub
                </Button>
              </div>

              <FieldSeparator className={cn(
                "text-xs uppercase tracking-widest my-2",
                isDark ? "text-neutral-500" : "text-neutral-400"
              )}>
                Or continue with
              </FieldSeparator>

              {isSignUp && (
                <div className="space-y-1.5 animate-fadeIn">
                  <LabelInput
                    id="name"
                    type="text"
                    label="Full Name"
                    placeholder="John Doe"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    ringColor="indigo"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <LabelInput
                  id="email"
                  type="email"
                  label="Email Address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  ringColor="indigo"
                />
              </div>

              <div className="space-y-1.5">
                <LabelInput
                  id="password"
                  type="password"
                  label="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  ringColor="indigo"
                />
              </div>

              {error && (
                <div className={cn(
                  "p-3 text-xs border rounded-xl animate-shake",
                  isDark 
                    ? "bg-rose-950/30 text-rose-400 border-rose-800/30" 
                    : "bg-rose-50 text-rose-600 border-rose-200/50"
                )}>
                  {error}
                </div>
              )}

              {success && (
                <div className={cn(
                  "p-3 text-xs border rounded-xl",
                  isDark 
                    ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/30" 
                    : "bg-emerald-50 text-emerald-600 border-emerald-200/50"
                )}>
                  {success}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-600/10 cursor-pointer select-none active:translate-y-px"
              >
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2 text-white" />
                    Processing...
                  </>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>

              <FieldDescription className="text-center text-sm text-neutral-400 mt-2">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setError(null)
                    setSuccess(null)
                  }}
                  className="text-indigo-400 hover:underline font-medium focus:outline-none"
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className={cn(
        "px-6 text-center text-xs",
        isDark ? "text-neutral-500" : "text-neutral-400"
      )}>
        By clicking continue, you agree to our{" "}
        <a href="#" className={cn("underline", isDark ? "hover:text-neutral-300" : "hover:text-neutral-700")}>Terms of Service</a>{" "}
        and{" "}
        <a href="#" className={cn("underline", isDark ? "hover:text-neutral-300" : "hover:text-neutral-700")}>Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

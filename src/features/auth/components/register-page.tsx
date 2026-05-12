import { Link } from '@tanstack/react-router'
import { Eye, EyeOff, Lock, Mail, ScrollText, User } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'
import { useRegisterForm } from '../hooks/use-register-form'

// Página de registro — solo UI, sin integración con backend
export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { form, validators } = useRegisterForm()

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Marca / logotipo */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-(--lagoon) to-(--palm) shadow-lg shadow-(--lagoon)/20">
          <ScrollText className="size-5 text-white" aria-hidden="true" />
        </div>
        <span
          className="text-2xl font-bold tracking-tight text-(--sea-ink) dark:text-(--sea-ink)"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Questlog
        </span>
      </div>

      {/* Tarjeta de formulario con efecto glassmorphism */}
      <div className="rounded-2xl border border-(--line) bg-(--surface) px-8 py-8 shadow-[0_8px_40px_rgba(0,0,0,0.10),inset_0_1px_0_var(--inset-glint)] backdrop-blur-2xl">
        {/* Encabezado */}
        <div className="mb-6">
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Create an account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start your quest today
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          noValidate
          className="space-y-5"
        >
          {/* Campo: Nombre */}
          <form.Field name="name" validators={validators.name}>
            {(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              return (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>Full name</Label>
                  <div className="relative">
                    <User
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      aria-hidden="true"
                    />
                    <Input
                      id={field.name}
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={cn('pl-10', {
                        'border-destructive focus-visible:ring-destructive/20':
                          hasError,
                      })}
                      aria-invalid={hasError}
                      aria-describedby={
                        hasError ? `${field.name}-error` : undefined
                      }
                    />
                  </div>
                  {hasError && (
                    <p
                      id={`${field.name}-error`}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          {/* Campo: Email */}
          <form.Field name="email" validators={validators.email}>
            {(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              return (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>Email</Label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      aria-hidden="true"
                    />
                    <Input
                      id={field.name}
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={cn('pl-10', {
                        'border-destructive focus-visible:ring-destructive/20':
                          hasError,
                      })}
                      aria-invalid={hasError}
                      aria-describedby={
                        hasError ? `${field.name}-error` : undefined
                      }
                    />
                  </div>
                  {hasError && (
                    <p
                      id={`${field.name}-error`}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          {/* Campo: Contraseña */}
          <form.Field name="password" validators={validators.password}>
            {(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              return (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>Password</Label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      aria-hidden="true"
                    />
                    <Input
                      id={field.name}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={cn('pl-10 pr-10', {
                        'border-destructive focus-visible:ring-destructive/20':
                          hasError,
                      })}
                      aria-invalid={hasError}
                      aria-describedby={
                        hasError ? `${field.name}-error` : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {hasError && (
                    <p
                      id={`${field.name}-error`}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          {/* Campo: Confirmar contraseña */}
          <form.Field
            name="confirmPassword"
            validators={{
              // Revalida cuando cambia 'password' para detectar discrepancias en tiempo real
              onChangeListenTo: ['password'],
              ...validators.confirmPassword,
            }}
          >
            {(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
              return (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>Confirm password</Label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      aria-hidden="true"
                    />
                    <Input
                      id={field.name}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={cn('pl-10 pr-10', {
                        'border-destructive focus-visible:ring-destructive/20':
                          hasError,
                      })}
                      aria-invalid={hasError}
                      aria-describedby={
                        hasError ? `${field.name}-error` : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={
                        showConfirm
                          ? 'Hide confirm password'
                          : 'Show confirm password'
                      }
                    >
                      {showConfirm ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {hasError && (
                    <p
                      id={`${field.name}-error`}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          {/* Botón de envío */}
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="w-full border-0 bg-linear-to-br from-(--lagoon) to-(--palm) text-white shadow-md shadow-(--lagoon)/20 transition-opacity hover:opacity-90"
              >
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            )}
          </form.Subscribe>
        </form>

        {/* Enlace al inicio de sesión */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-(--lagoon-deep) underline-offset-4 transition-colors hover:underline dark:text-(--lagoon)"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

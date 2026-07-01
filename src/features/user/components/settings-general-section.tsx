/**
 * SettingsGeneralSection — sección "General" del Settings dialog.
 * Permite elegir el avatar y editar el nombre visible del usuario.
 */
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { useUpdateUserForm } from '../hooks/use-update-user-form'
import { AvatarPicker } from './avatar-picker'

type SettingsGeneralSectionProps = {
  // Nombre actual del usuario, precargado en el formulario
  currentName: string
  // Datos del usuario para el avatar / fallback de iniciales
  currentEmail: string | null
  currentImage: string | null
  currentAvatarId: string | null
}

export function SettingsGeneralSection({
  currentName,
  currentEmail,
  currentImage,
  currentAvatarId,
}: SettingsGeneralSectionProps) {
  const { form, validators, serverError } = useUpdateUserForm(currentName)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* Sección: Avatar — texto descriptivo a la izquierda, trigger redondo
          a la derecha (mismo patrón label/control que el resto de ajustes) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label>Avatar</Label>
          <p className="text-sm text-muted-foreground">
            Click your avatar to pick a character portrait.
          </p>
        </div>
        <AvatarPicker
          currentAvatarId={currentAvatarId}
          name={currentName || null}
          email={currentEmail}
          image={currentImage}
        />
      </div>

      {/* Campo: Name */}
      <form.Field name="name" validators={validators.name}>
        {(field) => {
          const hasError =
            field.state.meta.isTouched && field.state.meta.errors.length > 0
          return (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Your name"
                aria-invalid={hasError}
              />
              {hasError && (
                <p className="text-xs text-destructive" role="alert">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )
        }}
      </form.Field>

      {/* Error de servidor */}
      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      {/* Acciones */}
      <div className="flex justify-end pt-1">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

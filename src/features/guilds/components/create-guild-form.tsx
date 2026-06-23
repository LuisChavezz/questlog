/**
 * CreateGuildForm — formulario para crear un guild.
 * La lógica (validación, derivación del slug y mutación) vive en
 * useCreateGuildForm, separada del UI.
 */
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'

import { useCreateGuildForm } from '../hooks/use-create-guild-form'

type CreateGuildFormProps = {
  // Se invoca tras crear el guild correctamente (cierra el modal)
  onSuccess?: () => void
  // Se invoca al cancelar (cierra el modal sin crear)
  onCancel?: () => void
}

export function CreateGuildForm({ onSuccess, onCancel }: CreateGuildFormProps) {
  const { form, validators, serverError, handleNameChange, handleSlugChange } =
    useCreateGuildForm(onSuccess)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      noValidate
      className="flex flex-col gap-5 pt-2"
    >
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
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Name your guild..."
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

      {/* Campo: Slug */}
      <form.Field name="slug" validators={validators.slug}>
        {(field) => {
          const hasError =
            field.state.meta.isTouched && field.state.meta.errors.length > 0
          return (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-guild"
                aria-invalid={hasError}
              />
              <p className="text-xs text-muted-foreground">
                Used in your guild URL. Derived from the name, but you can edit
                it.
              </p>
              {hasError && (
                <p className="text-xs text-destructive" role="alert">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )
        }}
      </form.Field>

      {/* Campo: Description */}
      <form.Field name="description" validators={validators.description}>
        {(field) => {
          const hasError =
            field.state.meta.isTouched && field.state.meta.errors.length > 0
          return (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Description</Label>
              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value ?? ''}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="What is this guild about? (optional)"
                rows={3}
                aria-invalid={hasError}
                className="resize-none"
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
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Guild'}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

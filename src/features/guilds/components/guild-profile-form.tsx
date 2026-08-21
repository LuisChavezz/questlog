/**
 * GuildProfileForm — edición del nombre y la descripción del guild desde
 * Settings. La lógica (validación y mutación) vive en useUpdateGuildForm.
 *
 * El slug NO se edita: es inmutable tras la creación porque cuelga de él la URL
 * del guild y los links de invitación ya repartidos.
 */
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'

import { useUpdateGuildForm } from '../hooks/use-update-guild-form'

type GuildProfileFormProps = {
  slug: string
  // Valores actuales del guild: alimentan el estado inicial del formulario y
  // son la referencia contra la que se decide si hay cambios que guardar.
  name: string
  description: string | null
}

export function GuildProfileForm({
  slug,
  name,
  description,
}: GuildProfileFormProps) {
  const {
    form,
    validators,
    hasChanges,
    handleFieldChange,
    serverError,
    isSaved,
  } = useUpdateGuildForm(slug, name, description)

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
                onChange={(e) => handleFieldChange('name', e.target.value)}
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

      {/* Campo: Description — vaciarlo es la forma de borrar la descripción */}
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
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  handleFieldChange('description', e.target.value)
                }
                placeholder="What is this guild about? (optional)"
                rows={3}
                aria-invalid={hasError}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Leave this empty to remove the guild description.
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

      {/* Error de servidor — mismo criterio que el resto de Settings: inline,
          bajo la acción que lo produjo (no hay sistema de toasts en la app) */}
      {serverError && (
        <p className="text-xs text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
          values: state.values,
        })}
      >
        {({ canSubmit, isSubmitting, values }) => {
          const changed = hasChanges(values)
          return (
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                className="w-fit"
                disabled={!canSubmit || isSubmitting || !changed}
              >
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </Button>
              {/* La confirmación se retira en cuanto el usuario vuelve a tocar
                  algo: con cambios sin guardar en pantalla, un "Saved" colgado
                  diría justo lo contrario de lo que hay en la BD. */}
              {isSaved && !changed && !serverError && (
                <p className="text-xs text-muted-foreground">
                  Guild profile saved.
                </p>
              )}
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}

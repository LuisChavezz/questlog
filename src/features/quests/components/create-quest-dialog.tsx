/**
 * CreateQuestDialog — modal con formulario para crear una nueva quest, personal
 * o de guild. En contexto de guild (prop `guild` presente) añade los selectores
 * de asignado y supervisor poblados con los miembros del guild y ajusta el
 * título; el resto de campos y la lógica son idénticos en ambos casos, por eso
 * es un único componente parametrizado y no dos casi iguales.
 * La lógica del formulario vive en useCreateQuestForm (separada del UI).
 */
import { Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { useState } from 'react'

import { useCreateQuestForm } from '../hooks/use-create-quest-form'
import { PRIORITY_OPTIONS } from './quests-columns'
import type { MemberOption } from './member-select'
import { MemberSelect } from './member-select'

// Contexto de guild para el diálogo: activa los selectores de asignado y
// supervisor y aporta lo necesario para crear la quest en el guild. Ausente en
// la vista personal.
interface CreateQuestDialogGuild {
  guildId: string
  slug: string
  // Miembros del guild — misma lista para los dos selectores
  members: MemberOption[]
}

interface CreateQuestDialogProps {
  guild?: CreateQuestDialogGuild
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CreateQuestDialog({ guild }: CreateQuestDialogProps = {}) {
  const [open, setOpen] = useState(false)

  const { form, validators, serverError, minDueDate } = useCreateQuestForm({
    guild: guild && { guildId: guild.guildId, slug: guild.slug },
    onSuccess: () => setOpen(false),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          New Quest
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {guild ? 'Create Guild Quest' : 'Create Quest'}
          </DialogTitle>
          <DialogDescription>
            New quests are always created in Backlog.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          noValidate
          className="flex flex-col gap-5 pt-2"
        >
          {/* Campo: Title */}
          <form.Field name="title" validators={validators.title}>
            {(field) => {
              const hasError =
                field.state.meta.isTouched && field.state.meta.errors.length > 0
              return (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Name your quest..."
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
                    placeholder="What needs to be done? (optional)"
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

          {/* Campo: Priority */}
          <form.Field name="priority" validators={validators.priority}>
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${field.name}-trigger`}>Priority</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) =>
                    field.handleChange(val as typeof field.state.value)
                  }
                >
                  <SelectTrigger
                    id={`${field.name}-trigger`}
                    className="w-full"
                  >
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          {/* Campos de guild: Assignee y Supervisor — misma lista de miembros.
              Solo se renderizan en contexto de guild. */}
          {guild && (
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
              <form.Field name="assigneeId">
                {(field) => (
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${field.name}-trigger`}>Assignee</Label>
                    <MemberSelect
                      id={`${field.name}-trigger`}
                      aria-label="Assignee"
                      value={field.state.value ?? null}
                      options={guild.members}
                      onChange={(userId) =>
                        field.handleChange(userId ?? undefined)
                      }
                      triggerClassName="w-full"
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="supervisorId">
                {(field) => (
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor={`${field.name}-trigger`}>Supervisor</Label>
                    <MemberSelect
                      id={`${field.name}-trigger`}
                      aria-label="Supervisor"
                      value={field.state.value ?? null}
                      options={guild.members}
                      onChange={(userId) =>
                        field.handleChange(userId ?? undefined)
                      }
                      triggerClassName="w-full"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          )}

          {/* Campo: Tags */}
          <form.Field name="tags">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Tags</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value ?? ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="design, frontend, api  (comma-separated)"
                />
              </div>
            )}
          </form.Field>

          {/* Campo: Due Date */}
          <form.Field name="dueDate" validators={validators.dueDate}>
            {(field) => {
              const hasError =
                field.state.meta.isTouched && field.state.meta.errors.length > 0

              return (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name}>Due Date</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="date"
                    min={minDueDate}
                    value={field.state.value ?? ''}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      const nextValue = e.target.value || undefined
                      field.handleChange(nextValue)
                    }}
                    onClick={(e) => {
                      e.currentTarget.showPicker()
                    }}
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
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Quest'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

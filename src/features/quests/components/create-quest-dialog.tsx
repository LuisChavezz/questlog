/**
 * CreateQuestDialog — modal con formulario para crear una nueva quest.
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

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

// ─── Componente ───────────────────────────────────────────────────────────────

export function CreateQuestDialog() {
  const [open, setOpen] = useState(false)

  const { form, validators, serverError, minDueDate } = useCreateQuestForm(() => {
    setOpen(false)
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
          <DialogTitle>Create Quest</DialogTitle>
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
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
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
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0
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
                  onValueChange={(val) => field.handleChange(val as typeof field.state.value)}
                >
                  <SelectTrigger id={`${field.name}-trigger`} className="w-full">
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
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0

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

/**
 * SettingsDialog — modal de configuración con layout de dos paneles
 * (nav lateral + contenido), estilizado con los mismos tokens que el
 * resto de dialogs de la app (Create Quest, Create Guild).
 */
import { User } from 'lucide-react'
import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { cn } from '#/lib/utils'

import { SettingsGeneralSection } from './settings-general-section'

type SettingsSectionId = string

// Config de categorías del nav lateral. Agregar nuevas secciones aquí
// no requiere reestructurar el layout.
const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId
  label: string
  icon: typeof User
}> = [{ id: 'general', label: 'General', icon: User }]

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
}

export function SettingsDialog({
  open,
  onOpenChange,
  currentName,
}: SettingsDialogProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>('general')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-128 max-h-[85vh] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Panel izquierdo: nav de categorías */}
          <nav className="w-48 shrink-0 border-r border-border bg-sidebar p-3">
            <ul className="flex flex-col gap-0.5">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon
                const isActive = section.id === activeSection
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {section.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Panel derecho: contenido de la sección activa */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeSection === 'general' && (
              <SettingsGeneralSection currentName={currentName} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

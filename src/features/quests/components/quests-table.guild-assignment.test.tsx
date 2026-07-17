// @vitest-environment jsdom
// Regresión: en la tabla de quests de un guild, el trigger avatar-only de
// asignado/supervisor abría el Select "en estado" pero el dropdown nunca
// aparecía en pantalla, y a partir de ese click la página entera dejaba de
// responder al hover (ni siquiera salía el tooltip del avatar).
//
// Causa raíz: `SelectContent` usa position="item-aligned" (el default de
// nuestro wrapper de shadcn). Ese modo alinea el dropdown contra el nodo del
// valor seleccionado y aborta el cálculo ENTERO si `context.valueNode` es null
// — y ese nodo solo existe si se renderiza `<SelectValue />`, que la variante
// avatar había quitado al pasar a avatar-only. Consecuencias encadenadas:
//   1. El wrapper del contenido quedaba en `position: fixed` sin top/left/height
//      (esos estilos SOLO se asignan dentro del cálculo) => invisible.
//   2. `onPlaced()` nunca se llamaba => `isPositioned` nunca pasaba a true.
//   3. Aun así el Select quedaba "abierto", y su DismissableLayer se monta con
//      disableOutsidePointerEvents => body con pointer-events:none => la página
//      entera queda muerta al hover, incluido el tooltip.
//
// Estos tests montan la TABLA REAL (no el componente aislado): un test del
// componente suelto que solo comprobara presencia en el DOM pasaba en verde
// mientras la funcionalidad estaba rota, porque el contenido SÍ está en el DOM
// — lo que falta es el posicionamiento. Por eso aquí se asserta el efecto
// observable (los estilos de posición), no la mera existencia del nodo.
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { TooltipProvider } from '#/components/ui/tooltip'
import type { GuildRole, Quest } from '#/db/schema'
import { QuestsTableContent } from './quests-table'
import type { GuildQuestTableMember } from './quests-table'

const CURRENT_USER_ID = 'user-1'
const GUILD_OWNER_ID = 'guild-master'

// Miembros con rol: el Guild Master (owner estructural), el usuario actual y
// dos compañeros (un member y un officer) — cubre las ramas de autorización.
const MEMBERS: GuildQuestTableMember[] = [
  { userId: GUILD_OWNER_ID, name: 'Gandalf', role: 'owner' },
  { userId: 'user-1', name: 'Ada Lovelace', role: 'member' },
  { userId: 'user-2', name: 'Grace Hopper', role: 'member' },
  { userId: 'user-3', name: 'Alan Turing', role: 'admin' },
]

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest-1',
    ownerId: CURRENT_USER_ID,
    assigneeId: null,
    supervisorId: null,
    guildId: 'guild-1',
    title: 'Slay the dragon',
    description: null,
    status: 'backlog',
    priority: 'medium',
    tags: [],
    dueDate: null,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

// El viewer por defecto es user-1 (Member); los tests de autorización lo varían.
function renderTable(
  quests: Quest[],
  viewer: { currentUserId?: string; currentUserRole?: GuildRole } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <QuestsTableContent
          quests={quests}
          guildContext={{
            slug: 'my-guild',
            currentUserId: viewer.currentUserId ?? CURRENT_USER_ID,
            currentUserRole: viewer.currentUserRole ?? 'member',
            guildOwnerId: GUILD_OWNER_ID,
            members: MEMBERS,
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

// Click de mouse tal y como lo escucha Radix Select internamente.
function mouseClick(element: Element) {
  fireEvent.pointerDown(element, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
  })
  fireEvent.click(element)
}

// Huecos de jsdom que Radix/la celda usan de verdad en el navegador:
// Pointer Capture (Radix Select la consulta sobre `event.target`),
// scrollIntoView (al enfocar el item seleccionado ya posicionado) y
// ResizeObserver (useIsTruncated remide el nombre al cambiar el ancho).
// Se instalan a nivel de módulo para que los comparta cada describe.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
})

describe('Guild quests table — celdas de asignado/supervisor', () => {
  it('posiciona el dropdown al hacer click en el avatar (no solo lo mete en el DOM)', async () => {
    renderTable([makeQuest()])

    mouseClick(screen.getByRole('combobox', { name: 'Change assignee' }))

    const content = await screen.findByRole('listbox')
    const wrapper = content.parentElement
    expect(wrapper).not.toBeNull()

    // El wrapper es `position: fixed`; sin el cálculo de posición se queda sin
    // left/minWidth y el dropdown nunca se ve. Estos estilos son la señal
    // observable de que `position()` llegó a ejecutarse.
    expect(wrapper!.style.position).toBe('fixed')
    expect(wrapper!.style.left).not.toBe('')
    expect(wrapper!.style.minWidth).not.toBe('')
  })

  it('lista a los miembros del guild al abrir el dropdown', async () => {
    renderTable([makeQuest()])

    mouseClick(screen.getByRole('combobox', { name: 'Change assignee' }))

    const listbox = await screen.findByRole('listbox')
    expect(listbox.textContent).toContain('Ada Lovelace')
    expect(listbox.textContent).toContain('Grace Hopper')
    expect(listbox.textContent).toContain('Unassigned')
  })

  it('renderiza supervisor como segundo trigger independiente', async () => {
    renderTable([makeQuest()])

    mouseClick(screen.getByRole('combobox', { name: 'Change supervisor' }))

    const content = await screen.findByRole('listbox')
    expect(content.parentElement!.style.left).not.toBe('')
  })

  it('muestra la celda en solo-lectura con avatar + nombre cuando la quest no es del usuario actual', () => {
    renderTable([makeQuest({ ownerId: 'someone-else', assigneeId: 'user-2' })])

    // Sin permiso de edición no hay combobox: se pinta MemberDisplay.
    expect(
      screen.queryByRole('combobox', { name: 'Change assignee' }),
    ).toBeNull()
    // Pero el nombre es visible igual que en la variante editable...
    expect(screen.getByText('Grace Hopper')).not.toBeNull()
    // ...junto al avatar, que sin imagen cae a las iniciales.
    expect(screen.getByText('GH')).not.toBeNull()
  })

  // ─── Nombre visible en la celda (no solo el avatar) ────────────────────────
  // El dropdown también contiene los nombres, así que se asserta contra el
  // TRIGGER concreto: si solo se buscara el texto en la página, el test pasaría
  // con el dropdown abierto aunque la celda estuviera vacía.

  it('muestra el nombre del asignado junto al avatar, con el dropdown cerrado', () => {
    renderTable([makeQuest({ assigneeId: 'user-2' })])

    const trigger = screen.getByRole('combobox', { name: 'Change assignee' })
    expect(trigger.textContent).toContain('Grace Hopper')
  })

  it('muestra "Unassigned" como texto visible cuando no hay asignación', () => {
    renderTable([makeQuest()])

    const trigger = screen.getByRole('combobox', { name: 'Change assignee' })
    expect(trigger.textContent).toContain('Unassigned')
  })

  it('trunca el nombre por CSS en vez de recortarlo en el markup', () => {
    renderTable([makeQuest({ assigneeId: 'user-2' })])

    const trigger = screen.getByRole('combobox', { name: 'Change assignee' })
    const name = screen.getByText('Grace Hopper')

    // El nombre va completo en el DOM (el recorte visual lo hace `truncate`),
    // para que el tooltip y los lectores de pantalla tengan el texto entero.
    expect(name.textContent).toBe('Grace Hopper')
    expect(name.className).toContain('truncate')
    expect(trigger.contains(name)).toBe(true)
  })
})

// ─── Autorización de dos ejes ──────────────────────────────────────────────────
// La tabla de un guild muestra quests de otros miembros (getGuildQuests no filtra
// por owner), así que los editores inline y la selección de fila deben respetar
// los mismos permisos que el servidor. Estos tests fijan ese contrato.
describe('Guild quests table — autorización de dos ejes', () => {
  it('un Member no puede editar título/estado ni seleccionar la quest de otro miembro', () => {
    // viewer por defecto: user-1 (Member); la quest es de user-2 (Member).
    renderTable([makeQuest({ ownerId: 'user-2' })])

    // El título es visible pero de solo lectura (no hay botón de edición).
    expect(screen.getByText('Slay the dragon')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Edit title/ })).toBeNull()

    // El estado también es de solo lectura (no es asignado ni supervisor).
    expect(screen.queryByRole('button', { name: /Change status/ })).toBeNull()

    // Y la fila no es seleccionable — sin checkbox de fila para acciones masivas.
    expect(screen.queryByRole('checkbox', { name: 'Select row 1' })).toBeNull()
  })

  it('el asignado puede cambiar el estado pero no gestionar la quest', () => {
    // La quest es de user-2, pero user-1 (viewer) es el asignado.
    renderTable([makeQuest({ ownerId: 'user-2', assigneeId: CURRENT_USER_ID })])

    // Eje 2: el estado es editable.
    expect(screen.getByRole('button', { name: /Change status/ })).not.toBeNull()

    // Eje 1: ni el título ni el asignado son editables.
    expect(screen.queryByRole('button', { name: /Edit title/ })).toBeNull()
    expect(
      screen.queryByRole('combobox', { name: 'Change assignee' }),
    ).toBeNull()
  })

  it('un Officer gestiona la quest de un Member', () => {
    // viewer user-1 como Officer (admin); la quest es de user-2 (Member).
    renderTable([makeQuest({ ownerId: 'user-2' })], {
      currentUserRole: 'admin',
    })

    expect(screen.getByRole('button', { name: /Edit title/ })).not.toBeNull()
  })

  it('un Officer NO gestiona la quest de otro Officer', () => {
    // viewer user-1 como Officer (admin); la quest es de user-3 (Officer).
    renderTable([makeQuest({ ownerId: 'user-3' })], {
      currentUserRole: 'admin',
    })

    expect(screen.queryByRole('button', { name: /Edit title/ })).toBeNull()
  })

  it('el Guild Master gestiona cualquier quest del guild', () => {
    // viewer = Guild Master; la quest es de un Officer.
    renderTable([makeQuest({ ownerId: 'user-3' })], {
      currentUserId: GUILD_OWNER_ID,
      currentUserRole: 'owner',
    })

    expect(screen.getByRole('button', { name: /Edit title/ })).not.toBeNull()
  })
})

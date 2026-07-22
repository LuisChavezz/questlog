// @vitest-environment jsdom
// `/quests` no es una tabla con secciones, sino una tabla INDEPENDIENTE por
// origen: la personal y una por guild. El motivo es que Assignee/Supervisor
// tienen alcance de guild —cada uno con su propio roster—, así que una sola
// toolbar compartida ofrecería opciones que no aplican a la mayoría de las
// filas y mezclaría personas de guilds distintos en un mismo desplegable.
//
// Estos tests fijan justo eso: qué columnas y qué filtros ofrece cada tabla, que
// ningún roster se cruce, y que filtrar o seleccionar en una no toque a las demás.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import { TooltipProvider } from '#/components/ui/tooltip'
import type { Quest } from '#/db/schema'
import {
  QUEST_GUILDS_QUERY_KEY,
  QUESTS_QUERY_KEY,
} from '../api/quests-query-options'
import type { QuestGuild } from '../api/get-quest-guilds'
import { QuestsTable } from './quests-table'

const CURRENT_USER_ID = 'user-1'

// Dos guilds SIN miembros en común: es la condición que hace inviable una única
// toolbar compartida, y lo que estos tests vigilan que no se mezcle.
const QUEST_GUILDS: QuestGuild[] = [
  {
    id: 'guild-dev',
    name: 'Dev Guild',
    slug: 'dev-guild',
    ownerId: 'guild-master',
    currentUserRole: 'owner',
    members: [
      {
        userId: CURRENT_USER_ID,
        name: 'Ada Lovelace',
        image: null,
        avatarId: null,
        initials: 'AL',
        role: 'owner',
      },
      {
        userId: 'user-2',
        name: 'Grace Hopper',
        image: null,
        avatarId: null,
        initials: 'GH',
        role: 'member',
      },
    ],
  },
  {
    id: 'guild-design',
    name: 'Design Co',
    slug: 'design-co',
    ownerId: CURRENT_USER_ID,
    currentUserRole: 'owner',
    members: [
      {
        userId: CURRENT_USER_ID,
        name: 'Ada Lovelace',
        image: null,
        avatarId: null,
        initials: 'AL',
        role: 'owner',
      },
      {
        userId: 'user-3',
        name: 'Alan Turing',
        image: null,
        avatarId: null,
        initials: 'AT',
        role: 'member',
      },
    ],
  },
]

let createdAtCounter = 0

function makeQuest(overrides: Partial<Quest> & { id: string }): Quest {
  createdAtCounter += 1

  return {
    ownerId: CURRENT_USER_ID,
    assigneeId: null,
    supervisorId: null,
    guildId: null,
    title: 'Untitled quest',
    description: null,
    status: 'backlog',
    priority: 'medium',
    tags: [],
    dueDate: null,
    completedAt: null,
    createdAt: new Date(2026, 0, createdAtCounter),
    updatedAt: new Date(2026, 0, createdAtCounter),
    ...overrides,
  }
}

function renderQuests(
  quests: Quest[],
  questGuilds: QuestGuild[] = QUEST_GUILDS,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  // Sembrar las cachés evita que `useSuspenseQuery` suspenda y llame al server
  // fn real: con datos recién escritos, ambas queries están dentro de su
  // `staleTime` y no se refetchean.
  queryClient.setQueryData(QUESTS_QUERY_KEY, quests)
  queryClient.setQueryData(QUEST_GUILDS_QUERY_KEY, questGuilds)

  // Se devuelve junto al resultado de `render`: algunos tests (recuperación
  // del roster de guild) necesitan manipular la caché de `['quest-guilds']`
  // directamente después de montar, para simular que el roster se pone al
  // día y luego vuelve a quedarse atrás.
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <QuestsTable currentUserId={CURRENT_USER_ID} />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
    queryClient,
  }
}

// Las secciones se pintan como <section> en orden: Personal y luego un guild
// por cada uno con quests visibles.
function getSections() {
  return Array.from(document.querySelectorAll('section'))
}

function getSectionByLabel(label: string) {
  const section = getSections().find((candidate) =>
    candidate
      .querySelector('button[aria-expanded]')
      ?.textContent.includes(label),
  )

  if (!section) throw new Error(`No section labelled "${label}"`)

  return section
}

// Click de mouse tal y como lo escuchan los dropdowns de Radix, que abren en
// `pointerdown` y no en `click`.
function mouseClick(element: Element) {
  fireEvent.pointerDown(element, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
  })
  fireEvent.click(element)
}

// Abre la fila de filtros de una tabla y despliega su menú "Add filter", que es
// donde se ve exactamente qué filtros ofrece ESA toolbar.
function openAddFilterMenu(section: HTMLElement) {
  fireEvent.click(within(section).getByRole('button', { name: 'Show filters' }))
  mouseClick(within(section).getByRole('button', { name: 'Add filter' }))
}

function searchWithin(section: HTMLElement, text: string) {
  fireEvent.click(within(section).getByRole('button', { name: 'Open search' }))
  fireEvent.change(within(section).getByPlaceholderText('Search quests...'), {
    target: { value: text },
  })
}

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

describe('Quests page — una tabla por origen', () => {
  it('pinta la sección personal y una por cada guild con quests', () => {
    renderQuests([
      makeQuest({ id: 'q-personal', title: 'Buy milk' }),
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
      makeQuest({
        id: 'q-design',
        guildId: 'guild-design',
        title: 'Redraw the map',
      }),
    ])

    // Una tabla independiente por sección, no una sola con filas de encabezado.
    expect(screen.getAllByRole('table')).toHaveLength(3)
    expect(
      getSections().map(
        (section) =>
          section.querySelector('button[aria-expanded]')?.textContent,
      ),
    ).toEqual(['Personal', 'Dev Guild', 'Design Co'])
  })

  it('omite la sección de un guild sin quests visibles', () => {
    renderQuests([
      makeQuest({ id: 'q-personal', title: 'Buy milk' }),
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
    ])

    expect(screen.getAllByRole('table')).toHaveLength(2)
    expect(screen.queryByText('Design Co')).toBeNull()
  })

  it('mantiene la sección personal aunque no haya quests personales', () => {
    renderQuests([
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
    ])

    const personal = getSectionByLabel('Personal')
    // Es donde vive el botón de crear, así que no puede desaparecer.
    expect(within(personal).getByText('No results found.')).not.toBeNull()
    expect(
      within(personal).getByRole('button', { name: /New quest/i }),
    ).not.toBeNull()
  })

  it('reparte cada quest en la tabla de su origen', () => {
    renderQuests([
      makeQuest({ id: 'q-personal', title: 'Buy milk' }),
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
    ])

    const personal = getSectionByLabel('Personal')
    const devGuild = getSectionByLabel('Dev Guild')

    expect(within(personal).getByText('Buy milk')).not.toBeNull()
    expect(within(personal).queryByText('Slay the dragon')).toBeNull()
    expect(within(devGuild).getByText('Slay the dragon')).not.toBeNull()
    expect(within(devGuild).queryByText('Buy milk')).toBeNull()
  })
})

describe('Quests page — columnas y filtros por origen', () => {
  it('la tabla personal no tiene columnas ni filtros de asignación', async () => {
    renderQuests([
      makeQuest({ id: 'q-personal', title: 'Buy milk' }),
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
    ])

    const personal = getSectionByLabel('Personal')

    // Asignado/supervisor no aplican a una quest personal — no se pintan como
    // "Unassigned", simplemente no existen.
    expect(within(personal).queryByText('Assignee')).toBeNull()
    expect(within(personal).queryByText('Supervisor')).toBeNull()

    openAddFilterMenu(personal)

    expect(
      (await screen.findAllByRole('menuitem')).map((item) => item.textContent),
    ).toEqual(['Status', 'Priority'])
  })

  it('la tabla de un guild trae el juego completo de columnas y filtros', async () => {
    renderQuests([
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
    ])

    const devGuild = getSectionByLabel('Dev Guild')

    expect(within(devGuild).getByText('Assignee')).not.toBeNull()
    expect(within(devGuild).getByText('Supervisor')).not.toBeNull()

    openAddFilterMenu(devGuild)

    expect(
      (await screen.findAllByRole('menuitem')).map((item) => item.textContent),
    ).toEqual(['Status', 'Priority', 'Assignee', 'Supervisor'])
  })

  it('cada toolbar ofrece SOLO los miembros de su propio guild', async () => {
    renderQuests([
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
      makeQuest({
        id: 'q-design',
        guildId: 'guild-design',
        title: 'Redraw the map',
      }),
    ])

    openAddFilterMenu(getSectionByLabel('Dev Guild'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Assignee' }))

    // El chip recién creado abre su propio desplegable de valores. Se busca por
    // subcadena porque cada opción lleva delante el avatar del miembro, que sin
    // imagen cae a sus iniciales — también texto ("GHGrace Hopper").
    const options = (await screen.findAllByRole('menuitemcheckbox'))
      .map((option) => option.textContent)
      .join('|')

    expect(options).toContain('Grace Hopper')
    // Alan Turing es de Design Co: no puede aparecer en el filtro de Dev Guild.
    expect(options).not.toContain('Alan Turing')
  })
})

describe('Quests page — estado independiente por tabla', () => {
  it('filtrar en una tabla no toca a las demás', () => {
    renderQuests([
      makeQuest({ id: 'q-personal', title: 'Buy milk' }),
      makeQuest({
        id: 'q-dev-1',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
      makeQuest({
        id: 'q-dev-2',
        guildId: 'guild-dev',
        title: 'Polish the sword',
      }),
    ])

    searchWithin(getSectionByLabel('Dev Guild'), 'dragon')

    const devGuild = getSectionByLabel('Dev Guild')
    expect(within(devGuild).getByText('Slay the dragon')).not.toBeNull()
    expect(within(devGuild).queryByText('Polish the sword')).toBeNull()
    // La tabla personal conserva sus filas: su filtro es otro estado.
    expect(
      within(getSectionByLabel('Personal')).getByText('Buy milk'),
    ).not.toBeNull()
  })

  it('la selección para acciones masivas no cruza de tabla', () => {
    renderQuests([
      makeQuest({ id: 'q-personal', title: 'Buy milk' }),
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
    ])

    const personal = getSectionByLabel('Personal')
    const devGuild = getSectionByLabel('Dev Guild')

    fireEvent.click(
      within(personal).getByRole('checkbox', { name: 'Select row 1' }),
    )
    fireEvent.click(
      within(devGuild).getByRole('checkbox', { name: 'Select row 1' }),
    )

    // Cada barra de acciones masivas cuenta solo lo suyo: al ser tablas
    // distintas, la selección queda acotada sin lógica extra.
    expect(within(personal).getByText('1 selected')).not.toBeNull()
    expect(within(devGuild).getByText('1 selected')).not.toBeNull()
  })

  it('plegar una sección conserva el filtro de su tabla al reabrirla', () => {
    renderQuests([
      makeQuest({
        id: 'q-dev-1',
        guildId: 'guild-dev',
        title: 'Slay the dragon',
      }),
      makeQuest({
        id: 'q-dev-2',
        guildId: 'guild-dev',
        title: 'Polish the sword',
      }),
    ])

    const devGuild = getSectionByLabel('Dev Guild')
    searchWithin(devGuild, 'dragon')

    const toggle = within(devGuild).getByRole('button', { name: /Dev Guild/ })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    // La tabla no se desmonta al plegar, así que el filtro sigue aplicado.
    expect(within(devGuild).getByText('Slay the dragon')).not.toBeNull()
    expect(within(devGuild).queryByText('Polish the sword')).toBeNull()
  })
})

describe('Quests page — permisos heredados de la tabla de guild', () => {
  it('deja en solo lectura la quest que el usuario solo supervisa', () => {
    // El usuario es Member de este guild y no creó la quest: solo puede mover
    // el estado (eje 2). Se usa un guild donde NO es el dueño estructural.
    renderQuests(
      [
        makeQuest({
          id: 'q-dev',
          guildId: 'guild-dev',
          ownerId: 'user-2',
          supervisorId: CURRENT_USER_ID,
          title: 'Slay the dragon',
        }),
      ],
      [{ ...QUEST_GUILDS[0], currentUserRole: 'member' }],
    )

    const devGuild = getSectionByLabel('Dev Guild')

    expect(
      within(devGuild).getByRole('button', { name: /Change status/ }),
    ).not.toBeNull()
    expect(
      within(devGuild).queryByRole('button', { name: /Edit title/ }),
    ).toBeNull()
  })

  it('permite reasignar en la tabla del guild — su roster sí está disponible', () => {
    renderQuests([
      makeQuest({
        id: 'q-dev',
        guildId: 'guild-dev',
        assigneeId: 'user-2',
        title: 'Slay the dragon',
      }),
    ])

    const devGuild = getSectionByLabel('Dev Guild')

    expect(within(devGuild).getByText('Grace Hopper')).not.toBeNull()
    expect(
      within(devGuild).getByRole('combobox', { name: 'Change assignee' }),
    ).not.toBeNull()
  })
})

describe('Quests page — recuperación del roster de guild perdido', () => {
  // `['quests']` puede traer una quest de un guild que `['quest-guilds']`
  // todavía no conoce; QuestsTable lo detecta y refresca el roster. Este test
  // fija que, si el MISMO guild vuelve a faltar más tarde (una incidencia
  // nueva, después de que el roster ya se había puesto al día), se detecta y
  // refresca de nuevo — no se da por ya intentada para siempre solo porque
  // coincide con un conjunto de ids visto antes.
  it('refresca de nuevo si el mismo guild reaparece como faltante tras resolverse', async () => {
    const lostGuildQuest = makeQuest({
      id: 'q-lost',
      guildId: 'guild-lost',
      title: 'Explore the ruins',
    })
    const lostGuild: QuestGuild = {
      id: 'guild-lost',
      name: 'Lost Guild',
      slug: 'lost-guild',
      ownerId: CURRENT_USER_ID,
      currentUserRole: 'owner',
      members: [],
    }

    // El roster ya trae 'guild-lost' al montar, para que no haya incidencia
    // (ni refresco) todavía y el spy quede en pie antes de que se dispare la
    // primera — `render` ya vació los effects de montaje para cuando retorna.
    const { queryClient } = renderQuests(
      [lostGuildQuest],
      [...QUEST_GUILDS, lostGuild],
    )
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(async () => undefined)

    // 'guild-lost' desaparece del roster: primera incidencia, primer refresco.
    act(() => {
      queryClient.setQueryData(QUEST_GUILDS_QUERY_KEY, QUEST_GUILDS)
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: QUEST_GUILDS_QUERY_KEY,
      })
    })
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    // El roster se pone al día: 'guild-lost' aparece, nada falta. Se espera a
    // que la sección de "Lost Guild" se pinte (prueba observable de que el
    // render con el roster resuelto ya ocurrió) antes de romperlo de nuevo —
    // si no, dos `setQueryData` seguidos podrían resolverse en un solo render
    // final y saltarse por completo el estado intermedio "resuelto" que este
    // test necesita ejercitar.
    act(() => {
      queryClient.setQueryData(QUEST_GUILDS_QUERY_KEY, [
        ...QUEST_GUILDS,
        lostGuild,
      ])
    })
    await screen.findByText('Lost Guild')

    // 'guild-lost' vuelve a faltar del roster — mismo conjunto de ids que la
    // primera vez, pero una incidencia distinta porque ya se había resuelto.
    act(() => {
      queryClient.setQueryData(QUEST_GUILDS_QUERY_KEY, QUEST_GUILDS)
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(2)
    })
  })
})

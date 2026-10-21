// @vitest-environment jsdom
// Comentarios dentro del drawer de detalle, montados desde la lista real de
// `/quests` (tabla personal + tabla por guild) y abiertos con el trigger de la
// fila. Fija que la sección solo existe en quests de guild, que las acciones
// siguen los permisos que manda el servidor, que el borrador sobrevive a
// cambiar de quest, que Escape en el composer no cierra el drawer y que un
// error de borrado se pinta en la sección.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
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
} from '#/features/quests/api/quests-query-options'
import type { QuestGuild } from '#/features/quests/api/get-quest-guilds'
import { QuestsTable } from '#/features/quests/components/quests-table'
import type {
  QuestCommentCacheItem,
  QuestCommentsCache,
} from '../api/quest-comments-query-options'
import { setCommentDraft } from '../comment-drafts'

const { deleteQuestCommentMock, getQuestCommentsMock } = vi.hoisted(() => ({
  deleteQuestCommentMock: vi.fn(),
  getQuestCommentsMock: vi.fn(),
}))
vi.mock('../api/delete-quest-comment', () => ({
  deleteQuestComment: deleteQuestCommentMock,
}))
// Cada mutación invalida el hilo al asentarse: el refetch no debe llegar al
// server fn real, que fuera del runtime de Start no tiene contexto.
vi.mock('../api/get-quest-comments', () => ({
  getQuestComments: getQuestCommentsMock,
}))

const CURRENT_USER_ID = 'user-1'

const QUEST_GUILDS: QuestGuild[] = [
  {
    id: 'guild-dev',
    name: 'Dev Guild',
    slug: 'dev-guild',
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
        userId: 'user-2',
        name: 'Grace Hopper',
        image: null,
        avatarId: null,
        initials: 'GH',
        role: 'member',
      },
    ],
  },
]

function makeQuest(overrides: Partial<Quest> & { id: string }): Quest {
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
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides,
  }
}

const QUESTS: Quest[] = [
  makeQuest({ id: 'q-personal', title: 'Buy milk' }),
  makeQuest({ id: 'q-dragon', guildId: 'guild-dev', title: 'Slay the dragon' }),
  makeQuest({ id: 'q-caves', guildId: 'guild-dev', title: 'Map the caves' }),
]

function makeComment(
  overrides: Partial<QuestCommentCacheItem> & { id: string },
): QuestCommentCacheItem {
  return {
    body: 'A comment',
    createdAt: new Date('2026-07-20T10:00:00.000Z'),
    editedAt: null,
    author: {
      id: CURRENT_USER_ID,
      name: 'Ada Lovelace',
      image: null,
      avatarId: null,
      initials: 'AL',
    },
    canEdit: true,
    canDelete: true,
    ...overrides,
  }
}

function singlePage(items: QuestCommentCacheItem[]): QuestCommentsCache {
  return {
    pages: [{ items, hasMore: false, nextCursor: null }],
    pageParams: [null],
  }
}

// Hilo de la quest del dragón, de más nuevo a más viejo (como la página 0).
const DRAGON_THREAD = singlePage([
  makeComment({ id: 'c-mine', body: 'On my way' }),
  makeComment({
    id: 'c-grace',
    body: 'Bring a shield\nand a torch',
    editedAt: new Date('2026-07-19T12:00:00.000Z'),
    author: {
      id: 'user-2',
      name: 'Grace Hopper',
      image: null,
      avatarId: null,
      initials: 'GH',
    },
    // El observador es el Guild Master: borra, pero no edita, lo ajeno.
    canEdit: false,
    canDelete: true,
  }),
  makeComment({
    id: 'c-orphan',
    body: 'From a deleted account',
    author: null,
    canEdit: false,
    canDelete: false,
  }),
])

function renderQuests() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  // Con datos recién sembrados todas las queries están dentro de su
  // `staleTime`: ni la lista ni los hilos llaman al server fn real.
  queryClient.setQueryData(QUESTS_QUERY_KEY, QUESTS)
  queryClient.setQueryData(QUEST_GUILDS_QUERY_KEY, QUEST_GUILDS)
  queryClient.setQueryData(['quest-comments', 'q-dragon'], DRAGON_THREAD)
  queryClient.setQueryData(['quest-comments', 'q-caves'], singlePage([]))

  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <QuestsTable currentUserId={CURRENT_USER_ID} />
      </TooltipProvider>
    </QueryClientProvider>,
  )

  return queryClient
}

function openQuest(title: string) {
  fireEvent.click(
    screen.getByRole('button', { name: `Open details: ${title}` }),
  )
  return screen.getByRole('dialog')
}

function getComposer(drawer: HTMLElement) {
  return within(drawer).getByRole('textbox', { name: 'Write a comment' })
}

function getComment(drawer: HTMLElement, authorName: string) {
  return within(drawer).getByRole('article', {
    name: `Comment by ${authorName}`,
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
  deleteQuestCommentMock.mockReset()
  getQuestCommentsMock.mockReset()
  setCommentDraft('q-dragon', '')
  setCommentDraft('q-caves', '')
})

// Cada test monta la página `/quests` completa (tabla personal + tabla de guild,
// con DataTable y Radix) y abre el drawer: en solitario tarda ~1 s, pero con la
// suite entera en paralelo supera los 5 s por defecto. El margen es de tiempo
// de pared, no de lógica asíncrona pendiente.
describe('Comentarios en el drawer de detalle', { timeout: 20_000 }, () => {
  it('una quest personal no tiene sección de comentarios ni composer', () => {
    renderQuests()

    const drawer = openQuest('Buy milk')

    expect(
      within(drawer).queryByRole('region', { name: 'Comments' }),
    ).toBeNull()
    expect(
      within(drawer).queryByRole('textbox', { name: 'Write a comment' }),
    ).toBeNull()
    expect(within(drawer).queryByText('Comments coming soon')).toBeNull()
  })

  it('una quest de guild pinta el hilo de más antiguo a más reciente', () => {
    renderQuests()

    const drawer = openQuest('Slay the dragon')
    const thread = within(drawer).getByRole('region', { name: 'Comments' })

    expect(
      within(thread)
        .getAllByRole('article')
        .map((article) => article.getAttribute('aria-label')),
    ).toEqual([
      'Comment by Unknown user',
      'Comment by Grace Hopper',
      'Comment by Ada Lovelace',
    ])
    // Texto plano con saltos de línea, y la marca "edited".
    const grace = getComment(drawer, 'Grace Hopper')
    expect(within(grace).getByText(/Bring a shield/).textContent).toBe(
      'Bring a shield\nand a torch',
    )
    expect(within(grace).getByText('· edited')).toBeTruthy()
    expect(getComposer(drawer)).toBeTruthy()
  })

  it('muestra Edit/Delete solo cuando el permiso del comentario lo permite', () => {
    renderQuests()
    const drawer = openQuest('Slay the dragon')

    const mine = getComment(drawer, 'Ada Lovelace')
    expect(
      within(mine).queryByRole('button', { name: 'Edit comment' }),
    ).not.toBeNull()
    expect(
      within(mine).queryByRole('button', { name: 'Delete comment' }),
    ).not.toBeNull()

    const grace = getComment(drawer, 'Grace Hopper')
    expect(
      within(grace).queryByRole('button', { name: 'Edit comment' }),
    ).toBeNull()
    expect(
      within(grace).queryByRole('button', { name: 'Delete comment' }),
    ).not.toBeNull()

    const orphan = getComment(drawer, 'Unknown user')
    expect(
      within(orphan).queryByRole('button', { name: 'Edit comment' }),
    ).toBeNull()
    expect(
      within(orphan).queryByRole('button', { name: 'Delete comment' }),
    ).toBeNull()
  })

  it('una quest de guild sin comentarios muestra el estado vacío', () => {
    renderQuests()

    const drawer = openQuest('Map the caves')

    expect(within(drawer).getByText(/No comments yet/)).toBeTruthy()
  })

  it('el borrador sobrevive a cambiar de quest y volver', () => {
    renderQuests()

    fireEvent.change(getComposer(openQuest('Slay the dragon')), {
      target: { value: 'Half-written plan' },
    })

    // Otra quest: su propio composer, vacío.
    expect(getComposer(openQuest('Map the caves'))).toHaveProperty('value', '')

    // De vuelta: el borrador sigue ahí.
    expect(getComposer(openQuest('Slay the dragon'))).toHaveProperty(
      'value',
      'Half-written plan',
    )
  })

  it('Escape en el composer no cierra el drawer; fuera de él, sí', async () => {
    renderQuests()
    const drawer = openQuest('Slay the dragon')
    const composer = getComposer(drawer)

    composer.focus()
    fireEvent.keyDown(composer, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeNull()

    fireEvent.keyDown(
      within(drawer).getByRole('region', { name: 'Comments' }),
      {
        key: 'Escape',
      },
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('un error al borrar se pinta en la sección y el comentario vuelve', async () => {
    // El refetch posterior al rollback devuelve el hilo intacto.
    getQuestCommentsMock.mockResolvedValue(DRAGON_THREAD.pages[0])
    deleteQuestCommentMock.mockRejectedValue(
      new Error(
        'Conflict: the comment changed while deleting — please refresh and try again',
      ),
    )
    renderQuests()
    const drawer = openQuest('Slay the dragon')

    fireEvent.click(
      within(getComment(drawer, 'Grace Hopper')).getByRole('button', {
        name: 'Delete comment',
      }),
    )
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))

    // El diálogo se cierra en el acto (borrado optimista): el error NO se pinta
    // ahí. Mientras está abierto, Radix oculta el resto a la accesibilidad.
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    const thread = within(drawer).getByRole('region', { name: 'Comments' })
    expect((await within(thread).findByRole('alert')).textContent).toContain(
      'Conflict: the comment changed while deleting',
    )
    // Rollback del borrado optimista.
    expect(getComment(drawer, 'Grace Hopper')).toBeTruthy()
  })
})

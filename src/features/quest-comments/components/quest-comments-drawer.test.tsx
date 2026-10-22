// @vitest-environment jsdom
// Comentarios dentro del drawer de detalle (el mismo QuestDetailsDrawer que
// montan las tablas), abierto con triggers marcados como los de la fila. Fija que la sección solo existe en quests de guild, que las acciones
// siguen los permisos que manda el servidor, que el borrador sobrevive a
// cambiar de quest, que Escape en el composer no cierra el drawer, que cada
// error de una mutación se pinta en el drawer —también con mutaciones
// solapadas— y que el flujo de borrado no deja el foco fuera del drawer.
import { useState } from 'react'
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
import { QuestDetailsDrawer } from '#/features/quests/components/quest-details-drawer'
import { QUEST_OPEN_TRIGGER_ATTR } from '#/features/quests/components/quests-columns'
import type { QuestsColumnsGuildContext } from '#/features/quests/components/quests-columns'
import type {
  QuestCommentCacheItem,
  QuestCommentsCache,
} from '../api/quest-comments-query-options'
import {
  discardUnsentComment,
  getUnsentComments,
  keepFailedComment,
  setCommentDraft,
  setCommentError,
} from '../comment-drafts'
import { deferred } from '../hooks/quest-comment-test-fixtures'

const { createQuestCommentMock, deleteQuestCommentMock, getQuestCommentsMock } =
  vi.hoisted(() => ({
    createQuestCommentMock: vi.fn(),
    deleteQuestCommentMock: vi.fn(),
    getQuestCommentsMock: vi.fn(),
  }))
vi.mock('../api/create-quest-comment', () => ({
  createQuestComment: createQuestCommentMock,
}))
vi.mock('../api/delete-quest-comment', () => ({
  deleteQuestComment: deleteQuestCommentMock,
}))
// El autor del comentario optimista sale de la sesión de Better Auth.
vi.mock('#/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          image: null,
          avatarId: null,
        },
      },
    }),
  },
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

// Contexto de guild que la tabla pasaría al drawer en una quest de guild.
const GUILD_CONTEXT: QuestsColumnsGuildContext = {
  members: QUEST_GUILDS[0].members,
  onAssignmentChange: () => {},
  canManageQuest: () => true,
  canUpdateQuestStatus: () => true,
}

// Host mínimo del drawer: el MISMO QuestDetailsDrawer que montan las tablas,
// con un trigger "Open details" por quest marcado con QUEST_OPEN_TRIGGER_ATTR
// (como los de la fila). No monta `QuestsTable` entera: con DataTable y Radix
// por test, la suite completa en paralelo hacía agotar el timeout a otros tests
// pesados de jsdom.
function DrawerHost() {
  const [openId, setOpenId] = useState<string | null>(null)
  const quest = QUESTS.find((candidate) => candidate.id === openId) ?? null

  return (
    <>
      {QUESTS.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          {...{ [QUEST_OPEN_TRIGGER_ATTR]: 'true' }}
          onClick={() => setOpenId(candidate.id)}
        >
          {`Open details: ${candidate.title}`}
        </button>
      ))}
      <QuestDetailsDrawer
        quest={quest}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
        onUpdate={() => {}}
        guildContext={quest?.guildId ? GUILD_CONTEXT : undefined}
      />
    </>
  )
}

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
        <DrawerHost />
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

function getCommentForm(drawer: HTMLElement) {
  return within(drawer).getByRole('form', { name: 'Add a comment' })
}

// Pide borrar el comentario de `authorName` y confirma en el diálogo.
async function confirmDelete(drawer: HTMLElement, authorName: string) {
  fireEvent.click(
    within(getComment(drawer, authorName)).getByRole('button', {
      name: 'Delete comment',
    }),
  )
  const confirm = await screen.findByRole('alertdialog')
  fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
  // Mientras el diálogo está abierto, Radix oculta el resto a la accesibilidad.
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
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
  createQuestCommentMock.mockReset()
  deleteQuestCommentMock.mockReset()
  getQuestCommentsMock.mockReset()
  for (const questId of ['q-dragon', 'q-caves']) {
    setCommentDraft(questId, '')
    setCommentError(questId, null)
    while (getUnsentComments(questId).length > 0) {
      discardUnsentComment(questId)
    }
  }
})

describe('Comentarios en el drawer de detalle', () => {
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

  it('un error al borrar se pinta en el drawer y el comentario vuelve', async () => {
    // El refetch posterior al rollback devuelve el hilo intacto.
    getQuestCommentsMock.mockResolvedValue(DRAGON_THREAD.pages[0])
    deleteQuestCommentMock.mockRejectedValue(
      new Error(
        'Conflict: the comment changed while deleting — please refresh and try again',
      ),
    )
    renderQuests()
    const drawer = openQuest('Slay the dragon')

    // El diálogo se cierra en el acto (borrado optimista): el error NO se pinta
    // ahí sino en el pie del drawer, junto al composer.
    await confirmDelete(drawer, 'Grace Hopper')

    expect(
      (await within(getCommentForm(drawer)).findByRole('alert')).textContent,
    ).toContain('Conflict: the comment changed while deleting')
    expect(getComment(drawer, 'Grace Hopper')).toBeTruthy()
  })

  it('tras confirmar un borrado el foco queda dentro del drawer, que sigue abierto', async () => {
    deleteQuestCommentMock.mockReturnValue(new Promise(() => {}))
    renderQuests()
    const drawer = openQuest('Slay the dragon')

    await confirmDelete(drawer, 'Grace Hopper')

    // El botón Delete que abrió el diálogo ya no existe (borrado optimista): el
    // foco va al contenedor del hilo en vez de perderse en <body>.
    const thread = within(drawer)
      .getByRole('region', { name: 'Comments' })
      .querySelector('[tabindex="-1"]')
    await waitFor(() => expect(document.activeElement).toBe(thread))
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })

  it('dos borrados solapados: el fallo del primero se ve y el segundo se mantiene', async () => {
    const first = deferred()
    const second = deferred()
    deleteQuestCommentMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    // Estado real del servidor tras ambos: solo cayó el comentario propio.
    getQuestCommentsMock.mockResolvedValue({
      ...DRAGON_THREAD.pages[0],
      items: DRAGON_THREAD.pages[0].items.filter(
        (item) => item.id !== 'c-mine',
      ),
    })
    renderQuests()
    const drawer = openQuest('Slay the dragon')

    await confirmDelete(drawer, 'Grace Hopper')
    await confirmDelete(drawer, 'Ada Lovelace')

    first.reject(new Error('Conflict: first delete failed'))
    second.resolve({ id: 'c-mine', questId: 'q-dragon' })

    expect(
      (await within(getCommentForm(drawer)).findByRole('alert')).textContent,
    ).toBe('Conflict: first delete failed')
    await waitFor(() => expect(getComment(drawer, 'Grace Hopper')).toBeTruthy())
    expect(
      within(drawer).queryByRole('article', {
        name: 'Comment by Ada Lovelace',
      }),
    ).toBeNull()
  })

  it('el comentario optimista se pinta con el autor de la sesión', async () => {
    createQuestCommentMock.mockReturnValue(new Promise(() => {}))
    renderQuests()
    const drawer = openQuest('Map the caves')

    fireEvent.change(getComposer(drawer), {
      target: { value: 'Torches ready' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Comment' }))

    const posted = await within(drawer).findByRole('article', {
      name: 'Comment by Ada Lovelace',
    })
    expect(within(posted).getByText('Posting…')).toBeTruthy()
    expect(getComposer(drawer)).toHaveProperty('value', '')
  })

  it('una publicación fallida vuelve al textarea visible y muestra su error', async () => {
    getQuestCommentsMock.mockResolvedValue(singlePage([]).pages[0])
    createQuestCommentMock.mockRejectedValue(
      new Error('Forbidden: you are not a member of this guild'),
    )
    renderQuests()
    const drawer = openQuest('Map the caves')

    fireEvent.change(getComposer(drawer), {
      target: { value: 'Torches ready' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Comment' }))

    expect(
      (await within(getCommentForm(drawer)).findByRole('alert')).textContent,
    ).toBe('Forbidden: you are not a member of this guild')
    expect(getComposer(drawer)).toHaveProperty('value', 'Torches ready')
  })

  it('dos publicaciones solapadas: el fallo de la primera se ve y no pisa lo que se escribe', async () => {
    const first = deferred()
    const second = deferred()
    createQuestCommentMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    getQuestCommentsMock.mockResolvedValue(singlePage([]).pages[0])
    renderQuests()
    const drawer = openQuest('Map the caves')
    const post = (text: string) => {
      fireEvent.change(getComposer(drawer), { target: { value: text } })
      fireEvent.click(within(drawer).getByRole('button', { name: 'Comment' }))
    }

    post('First')
    post('Second')
    // El usuario ya escribe un tercero mientras ambos están en vuelo.
    fireEvent.change(getComposer(drawer), {
      target: { value: 'Third draft' },
    })

    first.reject(new Error('Conflict: first post failed'))
    second.resolve({
      id: 'c-second',
      body: 'Second',
      createdAt: new Date('2026-07-21T10:00:00.000Z'),
      editedAt: null,
      author: null,
      canEdit: true,
      canDelete: true,
    })

    expect(
      (await within(getCommentForm(drawer)).findByRole('alert')).textContent,
    ).toBe('Conflict: first post failed')
    // Lo que se está escribiendo no se pisa con el texto de la fallida.
    expect(getComposer(drawer)).toHaveProperty('value', 'Third draft')

    // El texto fallido queda apartado: Restore lo recupera intercambiándolo
    // con lo escrito, que pasa a no enviados en vez de perderse.
    const form = getCommentForm(drawer)
    expect(within(form).getByText('Unsent comment')).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Restore' }))
    expect(getComposer(drawer)).toHaveProperty('value', 'First')
    fireEvent.click(within(form).getByRole('button', { name: 'Restore' }))
    expect(getComposer(drawer)).toHaveProperty('value', 'Third draft')

    // × descarta el que se muestra; sin no enviados, desaparece la acción.
    fireEvent.click(
      within(form).getByRole('button', { name: 'Discard unsent comment' }),
    )
    expect(within(form).queryByRole('button', { name: 'Restore' })).toBeNull()
    expect(getComposer(drawer)).toHaveProperty('value', 'Third draft')
  })

  it('el aviso muestra el recuento de no enviados y cada quest los suyos', () => {
    // La acumulación en sí la cubre comment-drafts.test.ts: aquí solo se siembra
    // el store como lo dejarían dos fallos y se mira lo que pinta el drawer.
    setCommentDraft('q-caves', 'Typing')
    keepFailedComment('q-caves', 'Failure one')
    keepFailedComment('q-caves', 'Failure two')
    renderQuests()

    let drawer = openQuest('Map the caves')
    expect(
      within(getCommentForm(drawer)).getByText('2 unsent comments'),
    ).toBeTruthy()

    // Otra quest no ve los no enviados de esta.
    drawer = openQuest('Slay the dragon')
    expect(
      within(getCommentForm(drawer)).queryByRole('button', { name: 'Restore' }),
    ).toBeNull()

    // Y al volver siguen ahí; Restore trae el más reciente.
    drawer = openQuest('Map the caves')
    fireEvent.click(
      within(getCommentForm(drawer)).getByRole('button', { name: 'Restore' }),
    )
    expect(getComposer(drawer)).toHaveProperty('value', 'Failure two')
    expect(
      within(getCommentForm(drawer)).getByText('2 unsent comments'),
    ).toBeTruthy()
  })

  it('si falla la carga del hilo, muestra un mensaje propio y no "Failed to fetch"', async () => {
    getQuestCommentsMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const queryClient = renderQuests()
    // Sin hilo en caché: el drawer tiene que pedirlo y la petición falla.
    queryClient.removeQueries({ queryKey: ['quest-comments', 'q-caves'] })
    const drawer = openQuest('Map the caves')

    const region = within(drawer).getByRole('region', { name: 'Comments' })
    expect((await within(region).findByRole('alert')).textContent).toBe(
      "Couldn't load comments. Check your connection and try again.",
    )
    expect(within(drawer).queryByText(/Failed to fetch/)).toBeNull()
  })
})

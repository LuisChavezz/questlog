# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Questlog is a Linear/Notion-style task manager ("quests") built on the TanStack Start stack (SSR React 19), Drizzle ORM + PostgreSQL, and Better Auth. The `README.md` has exhaustive reference tables (full route list, env vars, schema fields, scripts); this file focuses on the architecture and conventions that require reading multiple files to understand.

## Commands

Package manager is **pnpm** (an `npm`-equivalent also works for scripts).

```bash
pnpm dev                 # dev server on http://localhost:3000
pnpm build               # production build
pnpm test                # run Vitest once (jsdom + Testing Library are configured; no tests exist yet)
pnpm exec vitest <file>  # run/watch a single test file
pnpm exec vitest run -t "name"   # run a single test by name
pnpm lint                # ESLint
pnpm format              # Prettier --write + eslint --fix
pnpm check               # Prettier --check (no writes)
```

Database (Drizzle Kit — reads `DATABASE_URL` from `.env.local` then `.env`):

```bash
pnpm db:generate   # generate a migration after editing src/db/schema.ts
pnpm db:migrate    # apply migrations
pnpm db:push       # push schema directly (dev only)
pnpm db:studio     # GUI browser
pnpm db:seed       # wipe auth tables + create test user (test@questlog.dev / Test1234!)
```

Required env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, optional `BETTER_AUTH_URL` (defaults to `http://localhost:3000`).

## Conventions

- **Path aliases:** `#/*` and `@/*` both map to `src/*`. `#/` is the canonical one (it's the Node `imports` entry in `package.json`); prefer it.
- **Code style:** no semicolons, single quotes, trailing commas (Prettier). TypeScript is `strict` with `noUnusedLocals`/`noUnusedParameters` — unused symbols fail the build.
- **Language:** code comments and commit messages are in **Spanish**; all user-facing UI strings are in **English**. Match this when editing.
- **`src/routeTree.gen.ts` is auto-generated** by the TanStack Router plugin — never edit it by hand.
- **Tailwind v4:** use CSS-variable tokens (`bg-background`, `text-foreground`, `border-border`, …), never hardcoded colors. Palette is Nord, defined in `src/styles.css`. UI primitives in `src/components/ui/` are shadcn-style (new-york) over Radix + CVA.

## Architecture

### Feature-sliced layout
Domain code lives in `src/features/<name>/` split into `api/` (server functions + query options), `components/`, `hooks/`, and `schemas/`. `quests` is the reference feature; `auth` follows the same shape; `dashboard` is a placeholder. Shared building blocks live in `src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`.

### Data flow (server functions, not REST)
There is no API layer beyond Better Auth's catch-all. All reads/writes go through TanStack Start **server functions** (`createServerFn`) that run on the server even when called from the client:

1. A server fn in `features/*/api/*.ts` calls `getRequest()` + `auth.api.getSession({ headers })` and **throws if unauthenticated** — every server fn re-checks the session itself; there is no shared middleware.
2. Authorization is enforced in the query: every quest query/mutation filters by `userId` (e.g. `update` uses `and(eq(quests.id, …), eq(quests.userId, session.user.id))`) so users can never touch another user's rows.
3. Mutations validate input with `.inputValidator(zodSchema)` before the handler runs.
4. Routes preload data in their `loader` via `queryClient.ensureQueryData(questsQueryOptions)` (SSR), and components read it with `useQuery`. The query key is `['quests']`.
5. Mutation hooks (`use-update-quest`, `use-bulk-update-quests`, etc.) use the **optimistic-update pattern**: `onMutate` cancels in-flight `['quests']` queries, snapshots the cache, and patches it; `onError` rolls back to the snapshot; `onSettled` invalidates `['quests']`. Replicate this pattern for new quest mutations.

### Auth & route guards
- Server config: `src/lib/auth.ts` (Better Auth + Drizzle adapter + `tanstackStartCookies()`). Browser client: `src/lib/auth-client.ts`. The HTTP handler is mounted at the catch-all route `src/routes/api/auth/$.ts`.
- `getServerSession()` (`src/lib/server/session.ts`) is a server fn that reads the session from request cookies.
- Two **pathless layout routes** gate everything by running `beforeLoad` on the server: `routes/_app.tsx` redirects to `/login` when there's no session (and exposes `session` on route context); `routes/_auth.tsx` redirects logged-in users to `/dashboard`. Put authenticated pages under `_app/`, guest pages under `_auth/`.

### Database schema
`src/db/schema.ts` defines the `quests` table + `quest_status`/`quest_priority` enums and re-exports everything from `auth-schema.ts`. **`src/db/auth-schema.ts` is owned by Better Auth — don't hand-edit it.** Inferred types (`Quest`, `NewQuest`, `QuestStatus`, `QuestPriority`) come from the table and are the source of truth across the app. After changing `schema.ts`, run `pnpm db:generate` then `pnpm db:migrate`.

### Validation: single source of truth for quests
`src/features/quests/schemas/quest-schemas.ts` holds reusable per-field Zod schemas (`questTitleSchema`, `questDueDateSchema`, …) composed into `createQuestSchema` and `updateQuestSchema`. The **same** schemas are reused by the create form (field-level validators), the inline table editors, and the server-side `inputValidator`. Add/extend fields here, not inline at call sites.

**Date handling gotcha:** due dates are stored as **UTC midnight** and compared as `YYYY-MM-DD` strings (never as `Date` objects) specifically to avoid timezone drift between client and server. Use the helpers in this file (`parseQuestDueDateValue`, `getQuestDateInputValue`, `getTodayDateString`, `isQuestDueDateOverdue`, `formatQuestDueDate`) — don't reimplement date math.

### Theme (Zustand + anti-FOUC)
Theme is a `persist`-ed Zustand store (`src/stores/theme-store.ts`) under localStorage key `questlog-theme`. An inline `<script>` in `routes/__root.tsx` reads that exact key before first paint to add the `dark` class with no flash. **If you rename the store key or change its shape, update that inline script too** — they are coupled by hand.

### Reusable DataTable
`src/components/ui/data-table.tsx` is a generic TanStack Table wrapper (sorting, global filter, pagination, resizable+persisted column widths, Notion-style hover/selection checkboxes, bulk-actions bar). The quests table (`features/quests/components/`) wires it up via a `createQuestsColumns(onUpdate)` factory whose cells render the inline editors. New tables should reuse `DataTable` rather than calling `useReactTable` directly.

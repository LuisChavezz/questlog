# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Questlog is a Linear/Notion-style task manager ("quests") on the TanStack Start stack (SSR React 19), Drizzle ORM + PostgreSQL (Supabase), and Better Auth. Two kinds of quests coexist: **personal** quests (`guild_id` NULL) and **guild** quests, shared inside a guild and governed by a role-based permission model. This file covers the architecture and conventions that require reading several files to reconstruct.

`QUESTLOG_CONTEXT.md` (repo root) is the same knowledge written for chats **without** repo access — it is the document uploaded to the Claude Project context, so it carries full schema/route tables and the current feature inventory. Keep the two in step when a decision changes. `README.md` is user-facing and **stale on the package manager** (it says pnpm; see below).

## Commands

**The package manager is `npm`, not pnpm.** `.cta.json` records it, the lockfile is `package-lock.json`, and the `pnpm.onlyBuiltDependencies` block in `package.json` is vestigial. Running pnpm here has already corrupted `node_modules` once and produced resolution failures that looked like source bugs — if module resolution breaks inexplicably, suspect a mixed install before suspecting the code, and never repair it with a second package manager.

```bash
npm run dev      # vite dev on http://localhost:3000
npm run build    # production build
npm test         # vitest run (one-shot)
npm run lint     # eslint
npm run format   # prettier --write . && eslint --fix
npm run check    # prettier --check . (no writes)
```

Single test file / single test by name:

```bash
npx vitest run src/features/quests/api/update-quest.handler.test.ts
```

```bash
npx vitest run -t "nombre del test"
```

Database (drizzle-kit reads `DATABASE_URL` from `.env.local`, then `.env`; schema entry point is `src/db/schema/index.ts`):

```bash
npx drizzle-kit generate
```

Other scripts: `db:migrate` (apply), `db:push`, `db:pull`, `db:studio`, `db:seed` (wipes auth tables, creates `test@questlog.dev` / `Test1234!`). Required env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`; optional `BETTER_AUTH_URL` (defaults to `http://localhost:3000`).

### Standing constraint

Do not start the dev server, do not issue localhost requests, and do not run seed / reset / migration-apply commands. **Generating** a migration file is fine; applying it is the human's call. Verification here is read-only: types, tests, and code review — not a running app.

## Conventions

- **Path alias:** `#/*` → `src/*` is canonical (it is the Node `imports` entry, so it resolves at runtime too). `@/*` also resolves via `tsconfig.json` but is not for new code. Relative imports inside a feature slice (`../schemas/…`) are normal.
- **Prettier:** `semi: false`, `singleQuote: true`, `trailingComma: 'all'` — trailing commas _everywhere_ Prettier can place them, function parameter and argument lists included. That `prettier.config.js` and `eslint.config.js` themselves use semicolons and double quotes is not a precedent: they are ESLint-ignored config, not source.
- **Language split** (the most frequently botched convention here): identifiers, types, filenames → **English**; code comments and commit messages → **Spanish**; user-facing UI strings and thrown error messages that reach the UI → **English**. Filenames are kebab-case, components PascalCase, hooks `use-*.ts`. Residual violations survive in `features/guilds/api/get-guild.ts` (`inicioSemana`, `inicioDeHoy`) and a Spanish throw in `create-guild.ts` — fix opportunistically, don't copy.
- **TypeScript:** `strict` + `noUnusedLocals` + `noUnusedParameters` (an unused symbol fails the build) and `verbatimModuleSyntax` (type-only imports must be written `import type`).
- **Tailwind v4, tokens only** (`bg-background`, `text-foreground`, `border-border`, `text-destructive`, …). Never hardcode colors. There is no `tailwind.config.*` — tokens live in `src/styles.css` under `:root` / `.dark` with `@custom-variant dark (&:is(.dark *))`. The palette is **Claude warm-grays + violet accent**; the `--nord-*` variable _names_ are leftovers from the original Nord palette and no longer hold Nord values. Default typeface is Anthropic Serif (`anthropic-fonts`).
- **UI primitives** in `src/components/ui/` are shadcn-style (new-york) over Radix + CVA. Add new ones there with the same CVA + `cn()` shape.
- **Generated / owned files:** `src/routeTree.gen.ts` is emitted by the TanStack Router plugin, and `src/db/auth-schema.ts` is owned by Better Auth. Never hand-edit either. Back-relations onto `user` from app tables are declared in the app's own schema files under a distinct export name (e.g. `guildMembersUserRelations`), because `auth-schema.ts` already exports `userRelations` and the barrel needs unique names.

## Architecture

### Feature-sliced layout

Domain code lives in `src/features/<name>/` split into `api/` (server functions + query options), `components/`, `hooks/`, `schemas/`. Features: `quests` (reference feature and landing destination), `guilds`, `auth`, `user`. Shared building blocks in `src/components/`, `src/lib/`, `src/hooks/`, `src/stores/`, `src/config/`.

### Data flow: server functions, not REST

There is no API layer beyond Better Auth's catch-all. Every read/write goes through a TanStack Start server function (`createServerFn`) that re-checks the session itself via `getRequest()` + `auth.api.getSession({ headers })` and throws if unauthenticated — there is no shared middleware. Mutations validate with `.inputValidator(zodSchema)` before the handler runs. Routes preload through `loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(...)`; components read with `useQuery` / `useSuspenseQuery`.

### The `.handler.ts` split

TanStack Start's plugin transform is **not** active under Vitest, so calling a `createServerFn` directly in a test resolves to `undefined`. The fix is a file pair, and it is why the pattern exists — don't "fix" a test by trying to call the wrapper:

```
update-quest.ts            ← thin RPC wrapper: createServerFn + inputValidator + session
update-quest.handler.ts    ← all business logic; takes already-authenticated userId + already-validated data
update-quest.handler.test.ts
```

12 handlers are extracted today (all mutating quest/guild endpoints plus the two activity readers). Read-only server fns without a handler (`get-quests`, `get-guild`, `create-guild`, `join-guild`, …) have no unit tests. New mutating endpoints should follow the pair.

### Authorization model

Authority lives in **shared predicates**, not in `WHERE` clauses. `features/guilds/role-labels.ts` is the single source of truth used by both the UI (to show/hide actions) and the server (final authority); everything derives from `isGuildOwner(guilds.owner_id, userId)` — ownership is structural, never inferred from `guild_members.role`, so a role drift can't become a bypass.

- **Personal quests** (`guildId` NULL): only the creator may touch them, and they may not carry an assignee or supervisor.
- **Guild quests, two axes.** Axis 1 (`canManageGuildQuest`) covers title/description/priority/tags/due date/delete/reassign — creator, Guild Master (owner), or an Officer (`admin`) over quests created by a _strictly lower_ rank (`ROLE_RANK`: owner 0, admin 1, member 2 — lower number, higher authority). Axis 2 (`canUpdateGuildQuestStatus`) adds the assignee and supervisor, status only. `canCreateGuildQuest` is owner/admin only.
- `updateQuestHandler` deliberately reads the quest row **without** an owner filter, because the predicates — not the query — hold the authority.
- **What a user sees in `/quests`** is defined once in `features/quests/api/visible-quests-filter.ts`: own personal quests, plus guild quests where they are creator/assignee/supervisor **and** still a member. `get-quests` and `get-quest-guilds` must describe exactly the same row set or the UI paints sections with no quests, or quests with no section.

### Concurrency: pre-check, locked re-check, deadlock retry

Every mutating guild handler authorizes **twice**:

1. Against an unlocked read — this decides the user-facing error (`Forbidden: …`, `Not Found: …`).
2. Again inside the transaction against `SELECT … FOR UPDATE` rows. Since step 1 just passed, a failure here can only mean concurrent change, so it raises `Conflict: … — please refresh and try again`.

Helpers: `resolveGuildQuestAuth` (unlocked) and `resolveLockedGuildQuestAuth` (locked) in `features/guilds/api/resolve-guild-quest-auth.ts`, both returning `{ viewer, roleByUserId }`.

> **Gotcha:** `roleByUserId` holds only the viewer plus the ids explicitly passed in `relatedUserIds` (locking every membership row would serialize all guild writes). Anyone whose role you later read out of that map **must** be in `relatedUserIds`, or they silently read back as "not a member" — an authorization bug, not an error.

**Lock ordering.** All quest endpoints lock `quests → guild_members`, so they cannot deadlock against each other; `deleteQuestsHandler` resolves per-guild locked auth in sorted guild-id order for the same reason. `resolveLockedGuildQuestAuth` re-reads `guilds.owner_id` _without_ a lock (MVCC) after taking the membership locks, deliberately, to avoid inverting the `guilds → guild_members` order used by `transfer-guild-ownership` / `delete-guild`.

**One cycle survives and is absorbed by retrying, not reordering** (`lib/server/deadlock-retry.ts`): `delete-guild` takes `guilds` then reaches `quests` through its DELETE cascade, while `update-quest` takes `quests` then reaches `guilds` through the activity-log FK trigger. `isDeadlockError` walks the `cause` chain (Drizzle wraps the `pg` error, so SQLSTATE isn't at the root) looking for exactly `40P01` — widening that would mask real failures. `withDeadlockRetry(run, conflictMessage)` re-runs the whole transaction once and, if it deadlocks again, throws the handler's generic conflict message so Postgres's raw text never reaches the UI.

### Query keys, caches and optimistic updates

| Key                                                                                        | Source                         |
| ------------------------------------------------------------------------------------------ | ------------------------------ |
| `['quests']` (`QUESTS_QUERY_KEY`)                                                          | personal list, `getQuests`     |
| `['quest-guilds']` (`QUEST_GUILDS_QUERY_KEY`)                                              | guild composition of that list |
| `['guilds']`                                                                               | guild directory                |
| `['guild', slug]` + `…, 'quests'` / `…, 'activity', 'recent'` / `…, 'activity', 'history'` | everything guild-scoped        |

`staleTime` is 20 s everywhere except `['quest-guilds']` (60 s).

- `['quest-guilds']` is a **sibling** of `['quests']`, not a child: mutation hooks patch and invalidate `['quests']` assuming it holds a `Quest[]`, and a nested key would be swept up by prefix invalidation.
- Everything guild-scoped hangs off the `['guild', slug]` prefix, so invalidating that prefix refreshes stats, members, recent activity and history in one call.
- `invalidateGuildQuestCaches(queryClient, slug, { includePersonalQuests })` (`features/quests/api/invalidate-guild-quest-caches.ts`) is the single answer to "what goes stale when a guild quest changes"; both the quests table and the guild activity drawer call it so they can't drift.
- **Optimistic-update pattern**, used by every quest mutation hook and to be replicated by new ones: `onMutate` cancels in-flight queries for the target key, snapshots the cache, patches it; `onError` restores the snapshot; `onSettled` invalidates. `useUpdateQuest(queryKey)` takes the key as an argument because the same hook drives both the personal cache and a guild cache.
- **Which cache a table mutates:** `QuestsTableContent` takes an optional `questsQueryKey`, defaulting to `['guild', slug, 'quests']` when a `guildContext` is present. `/quests` overrides it to `QUESTS_QUERY_KEY` for _all_ its tables, guild ones included, because there the sections are partitions of one query rather than independent queries.

### Database schema

`src/db/schema/` is a directory with a barrel (`index.ts`) that re-exports `auth-schema` + `quests` + `guilds` + `guild-members` + `guild-quest-activity-log`; drizzle-kit points at that barrel. Inferred types (`Quest`, `NewQuest`, `QuestStatus`, `QuestPriority`, `GuildRole`, …) come from the tables and are the source of truth app-wide.

Cascade decisions that carry meaning:

- **`quests.guild_id` is `CASCADE`, not `set null`** — deleting a guild deletes its quests. `set null` would silently drop guild quests into their creator's personal list carrying an assignee and supervisor from a guild that no longer exists. Migration `0012` made the change; `src/db/schema/guild-cascade.test.ts` pins it by reflecting over the Drizzle schema.
- **Activity log** (`guild_quest_activity_log`): guild quests only, written in the _same transaction_ as the insert/update. Exactly four audited fields — `status`, `assigneeId`, `supervisorId`, `dueDate` (title/description/priority/tags are excluded by decision). Deletion is never logged; rows die with the quest via `quest_id CASCADE`. Diffing lives in the pure `computeGuildQuestFieldChanges` — widening the audit means editing that function _and_ the `GuildQuestActivityField` union.
- Reads go through `guild-activity-log-query.ts`, shared by the Recent Activity card and the history modal. Its `ORDER BY created_at DESC, id DESC` tiebreaker is **load-bearing**: rows a multi-field update inserts in one transaction share `created_at` (`defaultNow()` resolves once per statement), and without the tiebreaker offset pagination skips or duplicates rows at a page boundary.

### Validation: single source of truth

Per-field Zod schemas are defined once per feature (`features/quests/schemas/quest-schemas.ts`, `features/guilds/schemas/guild-schemas.ts`, …) and reused by the create forms, the inline editors, and the server `.inputValidator`. Extend them there, never inline at a call site.

**Date gotcha:** due dates are stored as **UTC midnight** and compared as `YYYY-MM-DD` strings, never as `Date` objects, to avoid client/server timezone drift. Use the helpers (`parseQuestDueDateValue`, `getQuestDateInputValue`, `getTodayDateString`, `isQuestDueDateOverdue`, `isQuestDueDateSoon`, `formatQuestDueDate`) — don't reimplement date math. "Overdue" is a single predicate: due date in the past **and** status not in `['done', 'cancelled']`; `get-guild.ts` replicates it in SQL and must stay in step.

### Routing & guards

File-based routes under `src/routes/`. Two **pathless layout routes** gate everything with a server-side `beforeLoad`: `_app.tsx` redirects to `/login` without a session (and puts `session` on route context), `_auth.tsx` bounces logged-in users to `/quests`. Authenticated pages go under `_app/`, guest pages under `_auth/`; `/invite/$code` is deliberately outside both (public invite preview). `_app/guilds/$slug.tsx` is itself a layout route: it preloads `guildQueryOptions(slug)` and renders the shared header + `<Outlet/>` for `index` / `members` / `quests` / `settings`.

Auth wiring: `lib/auth.ts` (server) ↔ `lib/auth-client.ts` (browser) — the client's `inferAdditionalFields` mirrors the server's `user.additionalFields` **by hand**, so adding a user field means editing both. `getServerSession()` (`lib/server/session.ts`) is what the guards call; the HTTP handler is mounted at `routes/api/auth/$.ts`.

### UI patterns worth knowing before adding UI

- **`DataTable`** (`components/ui/data-table.tsx`) is the generic TanStack Table wrapper — sorting, global filter, pagination, resizable + persisted column widths, hover/selection checkboxes, bulk-actions bar, `stickyLeadingColumnIds`, `initialColumnFilters`, loading skeleton. Reuse it instead of calling `useReactTable`. Its Notion-style filter bar takes `filters: DataTableFilterDef[]` as **data**, never a mounted component; each filter column's `filterFn` takes `string[]` (multiple values = OR).
  - `initialColumnFilters` is read **once at mount**: seeding filters from search params needs a remount `key` combining _every_ seeding param, or a second navigation silently keeps the first seed.
- **`/quests` renders N independent tables** (personal + one per guild), not one sectioned table, because assignee/supervisor rosters are guild-scoped and a shared toolbar would mix people from different guilds.
- **Quest detail drawer** is a `<Sheet modal={false}>` so it coexists with the table; open-triggers are tagged with `QUEST_OPEN_TRIGGER_ATTR` and excluded from Radix's outside-click handling, otherwise switching rows closes and reopens with a visible flicker. It reuses the same inline editors as the table, so both paths share one optimistic cache.
- **Coat of arms** (`features/guilds/api/armoria-client.ts`): generated once at guild creation from a deterministic seed and **persisted as SVG** — the app never calls Armoria again. Failure at creation is normal (`coatOfArmsSvg` stays NULL, the guild is still created); failure on owner-triggered regeneration throws, because the user is waiting on a visible result.
- **Theme:** `persist`-ed Zustand store (`stores/theme-store.ts`) under localStorage key `questlog-theme`. An inline `<script>` in `routes/__root.tsx` parses that exact key before first paint to add `.dark` with no flash. **Key and persisted shape are hand-coupled to that script — change one, change the other.**

### Testing

28 test files, Vitest 4. There is **no global Vitest config**: each file declares its environment with a line-1 pragma — `// @vitest-environment node` for handlers and logic, `// @vitest-environment jsdom` for components and hooks.

- `src/test/drizzle-stub.ts` is a chainable, _thenable_ Drizzle fake. Mock with `vi.mock('#/db', async () => ({ db: (await import('#/test/drizzle-stub')).dbStub }))`, then `enqueueSelect/Update/Insert/Delete` results in the order the handler issues its queries (one queue per operation; `transaction(cb)` calls `cb(dbStub)`, so locked reads share the queues). `enqueueError('update', err)` simulates an engine failure mid-sequence — that's how the deadlock paths are covered.
- `getDbCalls()` returns `{ op, table, set, values, where, orderBy, locked, returning }` per operation, which is how tests assert on things absent from the return value: that a re-read used `.for('update')`, what the audit log wrote, the `WHERE` scope of a DELETE, or that a paginated query carried its tiebreaker.
- Auth resolvers are mocked **separately** from the db stub (they have their own tests), keeping per-test queues short.
- Component tests seed **both** `QUESTS_QUERY_KEY` and `QUEST_GUILDS_QUERY_KEY` before render so `useSuspenseQuery` never suspends or hits a real server fn, and wrap in `QueryClientProvider` + `TooltipProvider`. Because `/quests` renders several tables, scope assertions with `within(table)` — global `screen.getByText` is ambiguous there.
- Limits to keep in mind: no database is ever touched (the stub validates no SQL, ordering or constraints), server functions have no end-to-end coverage, and there is no E2E, migration or SSR-render layer.

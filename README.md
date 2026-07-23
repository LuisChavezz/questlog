# Questlog

A modern task management application built with the TanStack ecosystem. Think of each task as a "quest" — track, prioritize, and complete your work with an intuitive interface inspired by tools like Notion and Linear.

---

## Features

- **Authentication** — Register, login, and session management powered by Better Auth with email/password authentication.
- **Quests Table** — Full-featured data table with sorting, filtering, pagination, column resizing, and inline editing.
- **Inline Editing** — Edit quest titles, status, priority, tags, and due dates directly from the table rows.
- **Row Selection** — Notion-style checkbox visibility (appears on row hover or when selected) with bulk action support.
- **Bulk Actions** — Select multiple quests and apply status or priority changes in one click. Extensible for future actions.
- **Dark Mode** — Full dark/light theme toggle persisted via Zustand with a Nord color palette.
- **Collapsible Sidebar** — Fixed expand/collapse with overlay hover mode.

---

## Tech Stack

| Layer            | Technology                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Framework**    | [TanStack Start](https://tanstack.com/start/latest) (SSR)                                    |
| **UI Library**   | React 19                                                                                     |
| **Language**     | TypeScript 6.0                                                                               |
| **Routing**      | [TanStack Router](https://tanstack.com/router/latest) with file-based routes                 |
| **Data Fetching**| [TanStack Query](https://tanstack.com/query/latest)                                          |
| **Tables**       | [TanStack Table](https://tanstack.com/table/latest)                                          |
| **Forms**        | [TanStack Form](https://tanstack.com/form/latest)                                            |
| **ORM**          | [Drizzle ORM](https://orm.drizzle.team) with PostgreSQL                                      |
| **Auth**         | [Better Auth](https://www.better-auth.com)                                                   |
| **Validation**   | [Zod](https://zod.dev)                                                                       |
| **Styling**      | [Tailwind CSS v4](https://tailwindcss.com) + [Radix UI](https://www.radix-ui.com) primitives |
| **State**        | [Zustand](https://github.com/pmndrs/zustand) (theme persistence)                             |
| **Icons**        | [Lucide](https://lucide.dev)                                                                 |
| **Tooling**      | Vite, ESLint, Prettier, Vitest                                                               |

---

## Architecture

```
src/
├── components/          # Shared UI components
│   ├── layouts/         # App layout, auth layout, sidebar, header
│   ├── providers/       # Theme provider
│   └── ui/              # Radix-based component library (shadcn-style)
├── config/              # Navigation items configuration
├── db/                  # Database schema, client, seed script
│   ├── auth-schema.ts   # Better Auth tables (user, session, account, verification)
│   ├── schema.ts        # Quest table + enums + re-exports auth schema
│   ├── index.ts         # Drizzle client
│   └── seed.ts          # Test data seeder
├── features/            # Domain modules (feature-sliced)
│   ├── auth/            # Login, register, schemas, hooks
│   └── quests/          # Quests CRUD, table, inline editors, bulk actions (primary landing route)
├── hooks/               # Shared hooks (use-sidebar)
├── integrations/        # TanStack Query setup (SSR, devtools)
├── lib/                 # Shared utilities
│   ├── auth.ts          # Better Auth server config
│   ├── auth-client.ts   # Better Auth browser client
│   ├── server/session.ts# Server function to read session
│   └── utils.ts         # cn() helper (clsx + tailwind-merge)
├── routes/              # File-based TanStack Router routes
│   ├── __root.tsx       # Root layout, SEO, anti-FOUC script
│   ├── index.tsx        # Redirect / → /quests
│   ├── _auth.tsx        # Guest layout (redirects to quests if logged in)
│   ├── _auth/login.tsx  # Login page
│   ├── _auth/register.tsx# Register page
│   ├── _app.tsx         # Protected layout (redirects to login if not authenticated)
│   ├── _app/quests.tsx  # Quests page with SSR data preload — primary landing destination
│   └── api/auth/$       # Better Auth API handler (catch-all)
├── stores/              # Zustand stores (theme)
├── router.tsx           # Router factory (SSR + Query integration)
├── routeTree.gen.ts     # Auto-generated route tree
└── styles.css           # Global styles, Nord palette, Tailwind imports
```

### Route Design

| Path              | Layout    | Auth Required | Description                              |
| ----------------- | --------- | ------------- | ----------------------------------------- |
| `/`               | None      | —             | Redirects to quests                       |
| `/login`          | `_auth`   | No            | Sign in                                   |
| `/register`       | `_auth`   | No            | Create account                            |
| `/quests`         | `_app`    | Yes           | Quest management table (primary landing) |
| `/api/auth/$`     | None      | —             | Better Auth API                           |

### Authentication Flow

- Better Auth is configured with a Drizzle (PostgreSQL) adapter and email/password strategy.
- Server-side session validation uses `getServerSession()` — a `createServerFn` that reads cookies and returns the session.
- Route guards in `_auth.tsx` and `_app.tsx` run `beforeLoad` on the server to redirect unauthenticated/authenticated users appropriately.
- The client-side auth client (`auth-client.ts`) dynamically resolves `baseURL` from `window.location.origin`.
- Logout clears the TanStack Query cache and invalidates the router to force re-evaluation of guards.

---

## Project Structure

```
questlog/
├── public/                  # Static assets
├── drizzle/                 # Drizzle Kit migrations (auto-generated)
│   ├── 0000_*.sql
│   ├── 0001_*.sql
│   └── meta/                # Migration snapshots
├── src/
│   ├── components/
│   │   ├── layouts/
│   │   │   ├── app-layout.tsx
│   │   │   ├── auth-layout.tsx
│   │   │   ├── header/
│   │   │   └── sidebar/
│   │   ├── providers/
│   │   └── ui/              # 18 Radix-based components
│   ├── features/
│   │   ├── auth/
│   │   └── quests/          # CRUD, hooks, schemas, inline editors
│   └── routes/              # TanStack Router file-based routes
├── components.json          # shadcn/ui configuration
├── drizzle.config.ts        # Drizzle Kit configuration
├── eslint.config.js
├── prettier.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) (recommended) or npm
- PostgreSQL database

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your database connection string and auth secrets

# Run database migrations
pnpm db:migrate

# (Optional) Seed the database with a test user
pnpm db:seed

# Start the development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

| Variable              | Required | Default                | Description                         |
| --------------------- | -------- | ---------------------- | ----------------------------------- |
| `DATABASE_URL`        | Yes      | —                      | PostgreSQL connection string        |
| `BETTER_AUTH_SECRET`  | Yes      | —                      | Secret key for auth token signing   |
| `BETTER_AUTH_URL`     | No       | `http://localhost:3000`| Base URL of the application         |

Generate a strong auth secret with:

```bash
npx -y @better-auth/cli secret
```

---

## Available Scripts

| Script             | Description                                  |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | Start development server on port 3000        |
| `pnpm build`       | Build for production                         |
| `pnpm preview`     | Preview production build                     |
| `pnpm test`        | Run tests with Vitest                        |
| `pnpm lint`        | Lint all files with ESLint                   |
| `pnpm format`      | Format code (Prettier) and fix lint errors   |
| `pnpm check`       | Check formatting with Prettier               |
| `pnpm db:generate` | Generate a new Drizzle Kit migration         |
| `pnpm db:migrate`  | Apply pending migrations                     |
| `pnpm db:push`     | Push schema changes directly (dev only)      |
| `pnpm db:pull`     | Pull database schema into Drizzle files      |
| `pnpm db:studio`   | Open Drizzle Studio (GUI database browser)   |
| `pnpm db:seed`     | Seed database with test data                 |

---

## Database

The project uses **PostgreSQL** with **Drizzle ORM** for type-safe database access.

### Schema

- **Auth tables** (`auth-schema.ts`) — `user`, `session`, `account`, `verification`. Managed by Better Auth; do not modify directly.
- **Quest table** (`schema.ts`) — `quests` with fields:
  - `id` (UUID, auto-generated)
  - `user_id` (FK → user, cascade delete)
  - `title`, `description`
  - `status` (enum: `backlog`, `todo`, `in_progress`, `done`, `cancelled`)
  - `priority` (enum: `low`, `medium`, `high`, `critical`)
  - `tags` (text array)
  - `due_date`, `completed_at`
  - `created_at`, `updated_at` (with auto-timestamps)

### Migrations and Seeders

```bash
# Generate a new migration after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Seed test data (creates a test user)
pnpm db:seed
```

The seed script creates a user with:
- Email: `test@questlog.dev`
- Password: `Test1234!`
- Name: `Test User`

> **Note:** The seed script uses `dotenv` to load environment variables before dynamically importing the Better Auth configuration.

---

## Authentication

Authentication is handled by **[Better Auth](https://www.better-auth.com)** with:

- **Email/password** strategy
- **Drizzle adapter** for PostgreSQL
- **TanStack Start cookies** plugin for SSR-compatible session management
- **Shared Zod schemas** for client and server-side validation

### Key files

| File                        | Purpose                               |
| --------------------------- | ------------------------------------- |
| `src/lib/auth.ts`           | Server-side Better Auth configuration |
| `src/lib/auth-client.ts`    | Browser-side auth client              |
| `src/lib/server/session.ts` | Server function to retrieve session   |
| `src/features/auth/`        | Login/register forms, hooks, schemas  |
| `src/db/auth-schema.ts`     | Drizzle table definitions for auth    |

---

## Development Conventions

- **Path aliases** — `#/` maps to `src/` (configured in `tsconfig.json` and `vite.config.ts`).
- **Feature structure** — Domain logic lives in `src/features/<name>/` with subdirectories: `components/`, `hooks/`, `schemas/`, `api/`.
- **UI components** — Radix-based primitives in `src/components/ui/`, styled with Tailwind CSS v4 and CVA variants.
- **Tailwind classes** — Always use CSS variable tokens (`bg-background`, `text-foreground`, `border-border`, etc.) over hardcoded colors.
- **Color system** — [Nord palette](https://www.nordtheme.com/) with CSS custom properties for light and dark themes.
- **Icons** — Lucide React icons, imported individually for tree-shaking.
- **Forms** — TanStack Form with field-level Zod validation, not uncontrolled forms.
- **Data mutations** — TanStack Query `useMutation` with optimistic updates and rollback on error.
- **Linting** — ESLint with `@tanstack/eslint-config`. Formatting with Prettier (no semicolons, single quotes, trailing commas).

---

## Deployment

### Build

```bash
pnpm build
```

The output is a production-ready build suitable for deployment to any Node.js hosting platform (Vercel, Netlify, Railway, Fly.io, etc.).

### Environment

Ensure the following environment variables are set in production:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

---

## Troubleshooting

| Problem                          | Solution                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| `Invalid origin` on auth         | Set `BETTER_AUTH_URL` to the correct deployment URL                  |
| Migrations fail                  | Ensure `DATABASE_URL` points to a reachable PostgreSQL instance      |
| Fonts not loading                | The app loads Fraunces + Manrope from Google Fonts — check network   |
| Dark mode flashes on load        | The anti-FOUC script in `__root.tsx` reads Zustand's persisted theme |
| Build fails with import errors   | Run `pnpm install` and ensure all dependencies are in `package.json` |

---

## License

MIT

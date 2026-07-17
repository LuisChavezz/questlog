// Stub encadenable de Drizzle para tests de handlers de server functions.
//
// Cada método intermedio (.from/.where/.limit/.for/.set/.values/.returning…)
// devuelve la misma cadena, y la cadena es "thenable", así que
// `await db.select()...limit(1)` resuelve a la siguiente fila-resultado encolada.
// Hay una cola por operación (select/update/insert/delete) que se consume en el
// orden en que el handler ejecuta sus queries. Los helpers de resolución
// (resolve-guild-quest-auth, resolve-guild-or-throw) se mockean aparte, así que
// aquí solo entran las lecturas/escrituras propias de la función bajo prueba y
// las colas quedan cortas y estables.
//
// Uso: mockear `#/db` con `db: dbStub` (vía factory async que importe este
// módulo), encolar resultados con enqueue*, y limpiar en afterEach con
// resetDbStub. `transaction` ejecuta el callback pasándole el propio stub como
// `tx`, de modo que las lecturas bloqueadas comparten las mismas colas.

type Row = Record<string, unknown>

// Cadena encadenable y "thenable". Los tipos son explícitos (interfaces con
// nombre) para romper la auto-referencia de `transaction` sobre `typeof dbStub`.
interface Chain {
  from: () => Chain
  where: () => Chain
  limit: () => Chain
  for: () => Chain
  set: () => Chain
  values: () => Chain
  returning: () => Chain
  orderBy: () => Chain
  innerJoin: () => Chain
  then: (
    onF: (v: Row[]) => unknown,
    onR?: (e: unknown) => unknown,
  ) => Promise<unknown>
}

interface DbStub {
  select: () => Chain
  update: () => Chain
  insert: () => Chain
  delete: () => Chain
  transaction: <T>(cb: (tx: DbStub) => Promise<T>) => Promise<T>
}

const queues = {
  select: [] as Row[][],
  update: [] as Row[][],
  insert: [] as Row[][],
  delete: [] as Row[][],
}

function makeChain(resolve: () => Row[]): Chain {
  const chain: Chain = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    for: () => chain,
    set: () => chain,
    values: () => chain,
    returning: () => chain,
    orderBy: () => chain,
    innerJoin: () => chain,
    then: (onF, onR) => Promise.resolve(resolve()).then(onF, onR),
  }
  return chain
}

export const dbStub: DbStub = {
  select: () => makeChain(() => queues.select.shift() ?? []),
  update: () => makeChain(() => queues.update.shift() ?? []),
  insert: () => makeChain(() => queues.insert.shift() ?? []),
  delete: () => makeChain(() => queues.delete.shift() ?? []),
  transaction: (cb) => cb(dbStub),
}

export function enqueueSelect(rows: Row[]) {
  queues.select.push(rows)
}

export function enqueueUpdate(rows: Row[]) {
  queues.update.push(rows)
}

export function enqueueInsert(rows: Row[]) {
  queues.insert.push(rows)
}

export function enqueueDelete(rows: Row[]) {
  queues.delete.push(rows)
}

export function resetDbStub() {
  queues.select.length = 0
  queues.update.length = 0
  queues.insert.length = 0
  queues.delete.length = 0
}

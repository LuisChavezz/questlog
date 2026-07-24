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
//
// Además registra cada operación (ver `DbCall` / `getDbCalls`), para poder
// afirmar sobre escrituras que no se reflejan en el valor de retorno del
// handler — p. ej. la limpieza en cascada de un borrado— o sobre el hecho de
// que una relectura se hizo con bloqueo.

type Row = Record<string, unknown>

// Registro de una operación ejecutada contra el stub. Permite afirmar sobre lo
// que el handler ESCRIBIÓ (tabla y payload de `.set`) y sobre cómo lo leyó
// (`.for('update')` = relectura bloqueada, `.returning()` = confirmación de
// filas afectadas) — evidencia que el valor de retorno por sí solo no da, y que
// hace falta para cubrir rutas como la limpieza en cascada o la reverificación
// TOCTOU dentro de la transacción.
export interface DbCall {
  op: 'select' | 'update' | 'insert' | 'delete'
  // Tabla objetivo: el argumento de update/insert/delete, o el de `.from()` en
  // un select (que recibe la proyección, no la tabla, en su primera llamada).
  table: unknown
  set?: Row
  // Payload de `.values(...)` en un insert: una fila (objeto) o varias (array).
  // Permite afirmar sobre lo que un INSERT escribió —p. ej. las filas de la
  // bitácora de auditoría— sin depender del valor de retorno del handler.
  values?: unknown
  // Argumentos de `.orderBy(...)`: uno por clave de orden. Permite afirmar que
  // una consulta paginada lleva un desempate estable (p. ej. createdAt + id) sin
  // depender de que el stub —que devuelve las filas tal cual se encolan— ordene.
  orderBy?: unknown[]
  locked: boolean
  returning: boolean
}

// Cadena encadenable y "thenable". Los tipos son explícitos (interfaces con
// nombre) para romper la auto-referencia de `transaction` sobre `typeof dbStub`.
interface Chain {
  from: (table?: unknown) => Chain
  where: (condition?: unknown) => Chain
  limit: (count?: number) => Chain
  offset: (count?: number) => Chain
  for: (strength?: string) => Chain
  set: (values?: Row) => Chain
  values: (rows?: unknown) => Chain
  returning: (projection?: unknown) => Chain
  orderBy: (...order: unknown[]) => Chain
  innerJoin: (table?: unknown, on?: unknown) => Chain
  leftJoin: (table?: unknown, on?: unknown) => Chain
  then: (
    onF: (v: Row[]) => unknown,
    onR?: (e: unknown) => unknown,
  ) => Promise<unknown>
}

interface DbStub {
  select: (projection?: unknown) => Chain
  update: (table?: unknown) => Chain
  insert: (table?: unknown) => Chain
  delete: (table?: unknown) => Chain
  transaction: <T>(cb: (tx: DbStub) => Promise<T>) => Promise<T>
}

const queues = {
  select: [] as Row[][],
  update: [] as Row[][],
  insert: [] as Row[][],
  delete: [] as Row[][],
}

// Orden real de ejecución de las operaciones, compartido por db y tx (la
// transacción reusa el mismo stub), así que refleja también lo escrito dentro.
const calls: DbCall[] = []

function makeChain(call: DbCall, resolve: () => Row[]): Chain {
  const chain: Chain = {
    from: (table) => {
      call.table = table
      return chain
    },
    where: () => chain,
    limit: () => chain,
    offset: () => chain,
    for: () => {
      call.locked = true
      return chain
    },
    set: (values) => {
      call.set = values
      return chain
    },
    values: (values) => {
      call.values = values
      return chain
    },
    returning: () => {
      call.returning = true
      return chain
    },
    orderBy: (...order) => {
      call.orderBy = order
      return chain
    },
    innerJoin: () => chain,
    leftJoin: () => chain,
    then: (onF, onR) => Promise.resolve(resolve()).then(onF, onR),
  }
  return chain
}

// Registra la operación en el momento en que se abre la cadena, de modo que
// `calls` conserve el orden de ejecución; los métodos posteriores la completan.
function startCall(op: DbCall['op'], table: unknown, resolve: () => Row[]) {
  const call: DbCall = { op, table, locked: false, returning: false }
  calls.push(call)
  return makeChain(call, resolve)
}

export const dbStub: DbStub = {
  select: () =>
    startCall('select', undefined, () => queues.select.shift() ?? []),
  update: (table) =>
    startCall('update', table, () => queues.update.shift() ?? []),
  insert: (table) =>
    startCall('insert', table, () => queues.insert.shift() ?? []),
  delete: (table) =>
    startCall('delete', table, () => queues.delete.shift() ?? []),
  transaction: (cb) => cb(dbStub),
}

// Operaciones ejecutadas desde el último reset, en orden.
export function getDbCalls(): readonly DbCall[] {
  return calls
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
  calls.length = 0
}

// Piezas compartidas por los formularios de TanStack Form. La decisión de
// CUÁNDO se valida vive aquí, una sola vez; QUÉ se valida sigue en los esquemas
// de Zod de cada feature (features/*/schemas).
import { formOptions, revalidateLogic } from '@tanstack/react-form'
import type { z } from 'zod'

// Validación diferida al envío: ningún error antes del primer intento; a
// partir de ahí cada cambio revalida. `revalidateLogic` solo gobierna los
// validadores `onDynamic`, por eso los campos los declaran así y no como
// `onChange`. Con `canSubmitWhenInvalid` cada envío vuelve a validar y muestra
// los errores vigentes en lugar de salir en silencio; `onSubmit` sigue sin
// correr mientras haya un campo inválido. Se combina con los `defaultValues` y
// el `onSubmit` propios de cada formulario: `useForm({ ...submitGatedFormOptions, … })`.
export const submitGatedFormOptions = formOptions({
  validationLogic: revalidateLogic(),
  canSubmitWhenInvalid: true,
})

// Adapta un esquema de Zod a validador de campo: devuelve el mensaje del
// primer issue, o undefined si el valor es válido.
export function zodFieldValidator<TSchema extends z.ZodType>(schema: TSchema) {
  return ({ value }: { value: z.input<TSchema> }) => {
    const result = schema.safeParse(value)
    return result.success ? undefined : result.error.issues[0]?.message
  }
}

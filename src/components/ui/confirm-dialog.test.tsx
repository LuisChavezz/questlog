// @vitest-environment jsdom
// Confirmación TECLEADA de ConfirmDialog — la puerta que protege el borrado de
// un guild (la única acción que hoy pasa `confirmationPhrase`). Lo que se fija
// aquí es que el botón de confirmar NO se habilita hasta que lo tecleado
// coincide exactamente con el nombre del guild, con el mismo criterio de
// normalización que el diálogo de transferencia de propiedad: sensible a
// mayúsculas y recortando espacios de los extremos en ambos lados.
//
// El nombre del guild se guarda tal cual se escribió (`guildNameSchema` no
// normaliza mayúsculas ni recorta), así que la comparación se hace contra el
// valor almacenado, sin inventar reglas nuevas.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { ConfirmDialog } from './confirm-dialog'

const GUILD_NAME = 'Dev Guild'

function renderDialog(
  props: { confirmationPhrase?: string; open?: boolean } = {},
) {
  const onConfirm = vi.fn()
  const { open = true, ...rest } = props

  const result = render(
    <ConfirmDialog
      open={open}
      onOpenChange={() => {}}
      title={`Delete ${GUILD_NAME}?`}
      confirmLabel="Delete Guild"
      variant="destructive"
      onConfirm={onConfirm}
      {...rest}
    />,
  )

  return { ...result, onConfirm }
}

function confirmButton() {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Delete Guild' })
}

function typeConfirmation(value: string) {
  fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value } })
}

afterEach(() => {
  cleanup()
})

describe('ConfirmDialog — confirmación tecleada', () => {
  it('arranca deshabilitado y solo se habilita con el nombre exacto', () => {
    renderDialog({ confirmationPhrase: GUILD_NAME })

    expect(confirmButton().disabled).toBe(true)

    // Un prefijo del nombre no basta.
    typeConfirmation('Dev')
    expect(confirmButton().disabled).toBe(true)

    typeConfirmation(GUILD_NAME)
    expect(confirmButton().disabled).toBe(false)
  })

  it('no dispara la acción mientras lo tecleado no coincide', () => {
    const { onConfirm } = renderDialog({ confirmationPhrase: GUILD_NAME })

    typeConfirmation('Dev Guil')
    fireEvent.click(confirmButton())

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('dispara la acción una vez el nombre coincide', () => {
    const { onConfirm } = renderDialog({ confirmationPhrase: GUILD_NAME })

    typeConfirmation(GUILD_NAME)
    fireEvent.click(confirmButton())

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('distingue mayúsculas de minúsculas', () => {
    renderDialog({ confirmationPhrase: GUILD_NAME })

    typeConfirmation('dev guild')
    expect(confirmButton().disabled).toBe(true)

    typeConfirmation('DEV GUILD')
    expect(confirmButton().disabled).toBe(true)
  })

  it('ignora los espacios de los extremos de lo tecleado', () => {
    renderDialog({ confirmationPhrase: GUILD_NAME })

    typeConfirmation(`  ${GUILD_NAME}  `)
    expect(confirmButton().disabled).toBe(false)
  })

  it('exige el espacio interior del nombre tal cual', () => {
    // Solo se recortan los extremos: colapsar espacios interiores sería una
    // regla de normalización nueva que el nombre del guild no tiene.
    renderDialog({ confirmationPhrase: GUILD_NAME })

    typeConfirmation('Dev  Guild')
    expect(confirmButton().disabled).toBe(true)
  })

  it('compara contra el nombre recortado cuando el guardado trae espacios', () => {
    renderDialog({ confirmationPhrase: `  ${GUILD_NAME}  ` })

    typeConfirmation(GUILD_NAME)
    expect(confirmButton().disabled).toBe(false)
  })

  it('bloquea la confirmación si la frase esperada está en blanco', () => {
    // Sin este guard, un campo vacío "coincidiría" con una frase vacía y la
    // confirmación tecleada se saltaría sola.
    renderDialog({ confirmationPhrase: '   ' })

    expect(confirmButton().disabled).toBe(true)

    typeConfirmation('')
    expect(confirmButton().disabled).toBe(true)
  })

  it('vacía el campo al reabrir, sin heredar lo tecleado antes', () => {
    const { rerender } = renderDialog({ confirmationPhrase: GUILD_NAME })

    typeConfirmation(GUILD_NAME)
    expect(confirmButton().disabled).toBe(false)

    const dialog = (open: boolean) => (
      <ConfirmDialog
        open={open}
        onOpenChange={() => {}}
        title={`Delete ${GUILD_NAME}?`}
        confirmLabel="Delete Guild"
        variant="destructive"
        confirmationPhrase={GUILD_NAME}
        onConfirm={() => {}}
      />
    )

    rerender(dialog(false))
    rerender(dialog(true))

    expect(confirmButton().disabled).toBe(true)
  })
})

describe('ConfirmDialog — sin confirmación tecleada', () => {
  it('mantiene el comportamiento de un clic cuando no se pasa la frase', () => {
    // Regresión de las confirmaciones que ya existían (regenerar invite code,
    // salir del guild, expulsar a un miembro): la nueva prop es opt-in.
    const { onConfirm } = renderDialog()

    expect(screen.queryByLabelText(/to confirm/i)).toBeNull()
    expect(confirmButton().disabled).toBe(false)

    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

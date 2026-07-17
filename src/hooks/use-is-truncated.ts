import { useCallback, useEffect, useState } from 'react'

// Detecta si el contenido de un elemento está recortado por overflow (p. ej.
// por la clase `truncate`). Sirve para mostrar el texto completo en un tooltip
// solo cuando de verdad hace falta, en vez de repetir texto ya visible.
//
// Devuelve una *callback ref*, no una ref normal, a propósito: el llamador
// típico envuelve el elemento en un <Tooltip> según el resultado, y ese cambio
// de árbol remonta el nodo. Con una ref normal el ResizeObserver seguiría
// observando el nodo viejo ya desconectado; guardando el nodo en estado, el
// efecto se vuelve a ejecutar y re-observa el nodo nuevo.
//
// `content` es el texto que el llamador pinta dentro del elemento observado.
// Se recibe explícitamente porque un cambio de texto (p. ej. reasignar una
// quest a otro miembro) no siempre cambia el tamaño de la caja — en una columna
// de ancho fijo el nodo ni se redimensiona ni se remonta, así que ResizeObserver
// nunca dispara y la medición quedaría con el texto anterior.
//
// Se mide en useEffect (no useLayoutEffect) porque la app hace SSR y la
// decisión del tooltip no necesita resolverse antes del primer paint.
export function useIsTruncated<T extends HTMLElement>(content: unknown) {
  const [element, setElement] = useState<T | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  // Memoizado en `element` para poder reutilizarlo desde ambos efectos: el que
  // arma el ResizeObserver y el que remide ante un cambio de `content`.
  const measure = useCallback(() => {
    if (!element) return

    const truncated = element.scrollWidth > element.clientWidth
    // Comparar antes de escribir evita re-renders en cada medición.
    setIsTruncated((current) => (current === truncated ? current : truncated))
  }, [element])

  useEffect(() => {
    if (!element) return

    measure()

    // El ancho de la celda cambia si el usuario redimensiona la columna.
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [element, measure])

  // El DOM ya refleja el `content` nuevo cuando este efecto corre (los efectos
  // se ejecutan después de que React confirma los cambios), así que remedir
  // aquí basta — no hace falta esperar a un resize que puede no llegar nunca.
  useEffect(() => {
    measure()
  }, [content, measure])

  return [setElement, isTruncated] as const
}

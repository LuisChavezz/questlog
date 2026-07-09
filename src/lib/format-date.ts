// Formateador de fecha compartido — usado para mostrar fechas legibles (ej. "9 Jul 2026")
export const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

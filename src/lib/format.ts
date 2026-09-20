const jaDate = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

export function formatDateJa(iso: string): string {
  if (!iso) return ''
  return jaDate.format(new Date(`${iso}T00:00:00`))
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

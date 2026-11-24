export const defaults = Object.freeze({theme:'system', size:'regular', measure:'regular', leading:'regular'})
const values = {
  theme: ['system','light','dark'],
  size: ['small','regular','large','extra'],
  measure: ['narrow','regular','wide'],
  leading: ['compact','regular','airy'],
}
export function normalizeSettings(raw) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
    key, values[key].includes(raw?.[key]) ? raw[key] : fallback,
  ]))
}
export function readingStats(entry) {
  const body = entry.sections.flatMap(section => [section.title, ...section.paragraphs]).filter(Boolean).join(' ')
  const words = body.match(/[\p{L}\p{N}]+(?:[\u200c\u200d'’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  return {words, minutes: words ? Math.ceil(words / 180) : 0}
}
export function visibleEntries(entries) {
  return entries.filter(entry => entry && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)
    && typeof entry.title === 'string' && entry.title.trim()
    && typeof entry.description === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && Number.isFinite(Date.parse(entry.date)) && new Date(entry.date).toISOString().slice(0,10) === entry.date && Array.isArray(entry.sections) && entry.sections.length
    && entry.sections.every(section => section && (section.title == null || typeof section.title === 'string') && Array.isArray(section.paragraphs)
      && section.paragraphs.length && section.paragraphs.every(p => typeof p === 'string' && p.trim())))
    .sort((a, b) => b.date.localeCompare(a.date))
}

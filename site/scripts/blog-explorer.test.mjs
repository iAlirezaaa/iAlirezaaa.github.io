import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesDiscovery, compareDiscovery } from '../../garden/src/site/scripts/blog-explorer.js'
import { entries } from '../public/fa/blog/entries.js'
import { topics, entryTopics, getTopicId } from './blog-taxonomy.mjs'

// Exercise the shipped filter/sort functions, not a duplicate search model.
const article = Object.freeze({
  kind: 'article', category: 'papers', topics: 'diffusion ai-basics',
  search: 'یادگیری مدل‌های تصویری، کتاب ۱۲۳، DDPM و دیفیوژن',
  title: 'مدل‌های دیفیوژن', minutes: '12', date: '2026-11-25', index: 0,
})
const note = Object.freeze({
  kind: 'note', category: 'fundamentals', topics: 'ai-basics diffusion',
  search: 'نویز در مدل دیفیوژن و نقطهٔ شروع تصویر',
  title: 'نویز', minutes: '2', date: '2026-11-24', index: 1,
})

test('empty filters preserve the server-rendered catalogue', () => {
  assert.equal(matchesDiscovery(article), true)
  assert.equal(matchesDiscovery(note, { q: '  ' }), true)
})

test('Persian, Arabic, joiner and numeric query variants find the same record', () => {
  for (const q of ['يادگيري', 'كِتاب', 'مدلهاي تصويري', 'مدل های تصویری', 'مدل‌های تصویری', '123', '١٢٣', 'DDPM']) {
    assert.equal(matchesDiscovery(article, { q }), true, q)
  }
})

test('all search words must belong to one record', () => {
  assert.equal(matchesDiscovery(article, { q: 'دیفیوژن کتاب' }), true)
  assert.equal(matchesDiscovery(article, { q: 'کتاب نویز' }), false)
  assert.equal(matchesDiscovery(note, { q: 'کتاب نویز' }), false)
})

test('kind, section, subject and text combine rather than overriding each other', () => {
  const filters = { kind: 'note', category: 'fundamentals', topic: 'diffusion', q: 'نويز' }
  assert.equal(matchesDiscovery(note, filters), true)
  assert.equal(matchesDiscovery(article, filters), false)
  assert.equal(matchesDiscovery(note, { ...filters, category: 'papers' }), false)
  assert.equal(matchesDiscovery(note, { ...filters, topic: 'python' }), false)
})

test('topic matching uses complete IDs and cannot match an unrelated substring', () => {
  const item = { ...note, topics: 'latent-diffusion' }
  assert.equal(matchesDiscovery(item, { topic: 'diffusion' }), false)
  assert.equal(matchesDiscovery(item, { topic: 'latent-diffusion' }), true)
})

test('reading-time ordering is numeric and equal values preserve source order', () => {
  assert.deepEqual([article, note].toSorted((a, b) => compareDiscovery(a, b, 'shortest')), [note, article])
  const tied = { ...note, minutes: '12' }
  assert.ok(compareDiscovery(article, tied, 'shortest') < 0)
})

test('newest ordering uses publication dates and a stable tie-breaker', () => {
  assert.deepEqual([note, article].toSorted((a, b) => compareDiscovery(a, b, 'newest')), [article, note])
  const tied = { ...note, date: article.date }
  assert.ok(compareDiscovery(article, tied, 'newest') < 0)
})

test('alphabetical ordering respects Persian titles without mutating records', () => {
  const first = Object.freeze({ ...note, title: 'ابر', index: 4 })
  const second = Object.freeze({ ...article, title: 'بذر', index: 2 })
  const source = [second, first]
  const ordered = source.toSorted((a, b) => compareDiscovery(a, b, 'title'))
  assert.deepEqual(ordered, [first, second])
  assert.deepEqual(source, [second, first])
})

test('all previously published topic IDs survive the vocabulary update', () => {
  const existing = ['ai-basics', 'diffusion', 'ai-image-making', 'paper-explainer', 'comfyui', 'workflow', 'python', 'dreambooth', 'character-continuity', 'rife', 'frame-interpolation', 'cfg', 'controlnet', 'depth-map', 'ddpm']
  assert.deepEqual(Object.keys(topics).sort(), [...existing, 'image-control', 'animation'].sort())
  for (const entry of entries) {
    const sourceTopics = [...entry.tags]
    const discoverable = entryTopics(entry, { includeLegacy: true })
    assert.ok(sourceTopics.every(id => discoverable.includes(id)), 'Authored topic dropped: ' + entry.slug)
    assert.deepEqual(entry.tags, sourceTopics, 'Topic lookup modified authored metadata: ' + entry.slug)
  }
})

test('named methods and tools resolve to their own subject pages', () => {
  for (const [query, id] of [['DreamBooth', 'dreambooth'], ['RIFE', 'rife'], ['CFG', 'cfg'], ['DDPM', 'ddpm'], ['ControlNet', 'controlnet'], ['راکورد', 'character-continuity'], ['نقشهٔ عمق', 'depth-map']]) {
    assert.equal(getTopicId(query), id, query)
  }
})

test('an unregistered source tag fails visibly instead of losing its route silently', () => {
  assert.throws(() => entryTopics({ slug: 'new-article', tags: ['diffusion', 'missing-topic'] }), /Unknown topic IDs in new-article: missing-topic/)
})

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { entries } from '../public/fa/blog/entries.js'
import { visibleEntries } from '../public/fa/blog/reader-model.js'
import { readNotes } from '../../garden/scripts/publishing.mjs'
import {
  categories, topics, topicNames, topicGroups, blogCopy, noteTaxonomy,
  normalizeBlogQuery, getTopicId, entryTopics,
} from './blog-taxonomy.mjs'

// Verify the built discovery experience against its publishable source records.
// Article prose, figures, SEO and legacy redirects have separate existing gates.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const dist = path.resolve(process.argv[2] || path.join(repoRoot, 'site/dist'))
const require = createRequire(path.join(repoRoot, 'garden/package.json'))
const { parse } = require('node-html-parser')
const root = '/fa/blog/'
const sourceArticles = visibleEntries(entries)
const sourceNotes = readNotes(path.join(repoRoot, 'garden/src/site/notes'))
  .filter(note => !note.frontmatter.hide && !note.frontmatter['dg-hide'])
const noteRoute = note => note.frontmatter.permalink
const articleRoute = entry => root + entry.slug + '/'
const noteClassification = note => noteTaxonomy[note.frontmatter.id] || {
  categoryId: note.frontmatter.categoryId || 'fundamentals',
  topics: (note.frontmatter.tags || []).map(getTopicId).filter(Boolean),
}
const numbers = new Intl.NumberFormat('fa-IR')
const load = route => parse(fs.readFileSync(path.join(dist, route.replace(/^\//, ''), 'index.html'), 'utf8'))
const getCardURL = card => card.querySelector('a[href]')?.getAttribute('href')
const sorted = values => [...values].sort()
const cardURLs = (document, kind) => document.querySelectorAll('[data-explorer-item][data-kind="' + kind + '"]').map(getCardURL)
const tokens = value => (value || '').trim().split(/\s+/u).filter(Boolean)
const readJSON = relative => JSON.parse(fs.readFileSync(path.join(dist, relative), 'utf8'))

// Stable route IDs can acquire better labels without breaking old bookmarks.
assert.deepEqual(Object.keys(categories), ['papers', 'repo-analysis', 'fundamentals'])
assert.deepEqual(Object.values(categories).map(item => item.name), ['خوانش پژوهش', 'ابزارها و کد', 'مبانی و مفاهیم'])
assert.equal(blogCopy.categories.title, 'بخش‌های وبلاگ')
assert.equal(blogCopy.topics.title, 'موضوع‌ها')
assert.equal(normalizeBlogQuery('يادگيري كِتاب ۱۲۳ ٤٥٦'), normalizeBlogQuery('یادگیری کتاب 123 456'))
assert.equal(normalizeBlogQuery('مدل‌های دیفیوژن'), normalizeBlogQuery('مدل های دیفیوژن'))
assert.equal(getTopicId('دیفیوژن'), 'diffusion')
assert.equal(getTopicId('کامفی يو آي'), 'comfyui')
assert.equal(getTopicId('CFG'), 'cfg')
assert.equal(getTopicId('RIFE'), 'rife')
assert.equal(getTopicId('DreamBooth'), 'dreambooth')
assert.equal(getTopicId('DDPM'), 'ddpm')
assert.equal(getTopicId('ControlNet'), 'controlnet')
assert.equal(getTopicId('موضوع ناشناخته'), null)
const sample = { slug: 'dreambooth-character-continuity', tags: ['diffusion', 'paper-explainer', 'diffusion'] }
const originalSample = structuredClone(sample)
assert.deepEqual(entryTopics(sample), ['diffusion', 'character-continuity'])
assert.deepEqual(entryTopics(sample, { includeLegacy: true }), ['diffusion', 'paper-explainer', 'character-continuity'])
assert.deepEqual(sample, originalSample, 'Taxonomy lookup mutates authored metadata')
assert.equal(new Set(topicGroups.map(group => group.id)).size, topicGroups.length)
for (const [id, topic] of Object.entries(topics)) {
  assert.ok(topic.name && topic.description && topic.aliases.length, 'Incomplete topic vocabulary: ' + id)
  assert.ok(topicGroups.some(group => group.id === topic.group), 'Topic has no reader-facing group: ' + id)
}

const index = load(root)
for (const selector of ['[data-search-open]','[data-global-graph-open]','[data-settings-open]','[data-panel-open="navigation"]']) assert.equal(index.querySelectorAll(selector).length,1,'Duplicate primary action: '+selector)
for (const selector of ['.workspace-ribbon','.workspace-strip','.garden-directory-nav','.garden-search-button','[data-tree-filter]','[data-recent-reading]']) assert.equal(index.querySelectorAll(selector).length,0,'Duplicate navigation remains: '+selector)
assert.ok(index.querySelector('body.is-directory'), 'Blog index should use the spacious directory layout')
assert.equal(index.querySelector('h1')?.text.trim(), blogCopy.index.title)
assert.equal(index.querySelector('#garden-context'), null, 'Directory still renders a competing context sidebar')
const form = index.querySelector('form[data-blog-explorer]')
assert.ok(form && form.hasAttribute('hidden'), 'Enhancement controls should stay hidden until the script initializes')
assert.equal(form.getAttribute('aria-label'), 'فیلتر نوشته‌ها')
assert.equal(form.querySelector('[name="q"]')?.getAttribute('type'), 'hidden', 'Only the global search should expose a text search field')
for (const name of ['kind', 'category', 'topic', 'sort']) {
  const control = form.querySelector('[name="' + name + '"]')
  assert.ok(control?.getAttribute('id'), 'Unnamed discovery control: ' + name)
  assert.ok(form.querySelector('label[for="' + control.getAttribute('id') + '"]'), 'Discovery control lacks a label: ' + name)
}
assert.ok(form.querySelector('[data-explorer-count][role="status"][aria-live="polite"]'), 'Result changes need a live announcement')
assert.ok(form.querySelector('button[type="reset"]'), 'Filter reset is missing')
assert.ok(index.querySelector('#blog-results'), 'Search input has no result target')
assert.ok(index.querySelector('[data-explorer-empty][hidden]'), 'Empty result guidance must initially be hidden')
// node-html-parser treats noscript as raw text, matching a scripting-enabled
// parse. Parse its fallback markup separately to inspect the no-script route.
assert.ok(index.querySelectorAll('noscript').some(element => parse(element.innerHTML).querySelector('a[href="/fa/blog/tags/"]')), 'No-JavaScript subject navigation missing')
for (const kind of ['articles', 'notes']) assert.ok(index.querySelector('[data-explorer-list="' + kind + '"]'), 'Unified list is missing ' + kind)

const items = index.querySelectorAll('[data-explorer-item]')
assert.equal(items.length, sourceArticles.length + sourceNotes.length, 'Index and publishable source counts disagree')
assert.deepEqual(sorted(cardURLs(index, 'article')), sorted(sourceArticles.map(articleRoute)), 'Published article missing or duplicated in unified index')
assert.deepEqual(sorted(cardURLs(index, 'note')), sorted(sourceNotes.map(noteRoute)), 'Published note missing or duplicated in unified index')
const allURLs = items.map(getCardURL)
assert.equal(new Set(allURLs).size, allURLs.length, 'Discovery lists repeat canonical content')
for (const item of items) {
  assert.ok(['article', 'note'].includes(item.getAttribute('data-kind')), 'Unknown content type')
  for (const attribute of ['data-category', 'data-topics', 'data-search', 'data-title', 'data-minutes', 'data-date']) {
    assert.ok(item.hasAttribute(attribute), 'Missing filter/sort field ' + attribute)
  }
  assert.ok(categories[item.getAttribute('data-category')], 'Card has unknown category')
  assert.ok(tokens(item.getAttribute('data-topics')).every(id => topics[id] && !topics[id].legacy), 'Card exposes unknown or redundant format tags')
  assert.ok(Number(item.getAttribute('data-minutes')) > 0, 'Estimated reading time must be positive')
  const title = item.getAttribute('data-title')
  assert.ok(title?.trim() && item.getAttribute('data-search').includes(title), 'Visible title is not searchable')
  assert.ok(getCardURL(item)?.startsWith(root), 'Card points outside the unified blog')
  assert.ok(!item.hasAttribute('hidden'), 'Server-rendered content must remain available without JavaScript')
}
for (const slug of ['start', 'diffusion', 'noise', 'seed', 'latent-diffusion', 'ddpm']) {
  assert.ok(allURLs.includes(root + 'notes/' + slug + '/'), 'Existing concept/study route disappeared: ' + slug)
}
for (const link of index.querySelectorAll('a[href]')) {
  assert.ok(!link.getAttribute('href').startsWith('/fa/garden/'), 'Public index still navigates through a legacy Garden content route')
}

const directoryPages = [index, load(root + 'categories/'), load(root + 'tags/')]
const categoryIndex = directoryPages[1]
assert.equal(categoryIndex.querySelector('h1')?.text.trim(), blogCopy.categories.title)
for (const [id, category] of Object.entries(categories)) {
  const url = root + 'categories/' + id + '/'
  const page = load(url)
  directoryPages.push(page)
  const articleURLs = sourceArticles.filter(entry => entry.categoryId === id).map(articleRoute)
  const noteURLs = sourceNotes.filter(note => noteClassification(note).categoryId === id).map(noteRoute)
  assert.deepEqual(sorted(cardURLs(page, 'article')), sorted(articleURLs), 'Category article membership mismatch: ' + id)
  assert.deepEqual(sorted(cardURLs(page, 'note')), sorted(noteURLs), 'Category note membership mismatch: ' + id)
  assert.equal(page.querySelector('h1')?.text.trim(), category.name)
  const categoryCard = categoryIndex.querySelector('.garden-category-list a[href="' + url + '"]')
  assert.equal(categoryCard?.querySelector('.directory-count')?.text.trim(), numbers.format(articleURLs.length) + ' مقاله · ' + numbers.format(noteURLs.length) + ' یادداشت', 'Category total is not based on published records: ' + id)
}

const legacyTopicIDs = ['ai-basics', 'diffusion', 'ai-image-making', 'paper-explainer', 'comfyui', 'workflow', 'python', 'dreambooth', 'character-continuity', 'rife', 'frame-interpolation', 'cfg', 'controlnet', 'depth-map', 'ddpm']
const newTopicIDs = ['image-control']
assert.deepEqual(sorted(Object.keys(topics)), sorted([...legacyTopicIDs, ...newTopicIDs]), 'Existing topic IDs must remain available after vocabulary changes')
assert.equal(Object.values(topics).filter(topic => !topic.legacy).length, 15)
const topicIndex = directoryPages[2]
assert.equal(topicIndex.querySelector('h1')?.text.trim(), blogCopy.topics.title)
for (const id of [...legacyTopicIDs, ...newTopicIDs]) {
  const url = root + 'tags/' + id + '/'
  const page = load(url)
  directoryPages.push(page)
  assert.equal(page.querySelector('h1')?.text.trim(), topicNames[id])
  const articleURLs = sourceArticles.filter(entry => entryTopics(entry, { includeLegacy: true }).includes(id)).map(articleRoute)
  const noteURLs = sourceNotes.filter(note => noteClassification(note).topics.includes(id)).map(noteRoute)
  assert.deepEqual(sorted(cardURLs(page, 'article')), sorted(articleURLs), 'Topic article membership mismatch: ' + id)
  assert.deepEqual(sorted(cardURLs(page, 'note')), sorted(noteURLs), 'Topic note membership mismatch: ' + id)
  assert.ok(articleURLs.length + noteURLs.length > 0, 'Active topic contains no published content: ' + id)
  const topicCard = topicIndex.querySelector('.topic-directory-grid a[href="' + url + '"]')
  if (topics[id].legacy) {
    assert.equal(topicCard, null, 'Format label should not compete with subject navigation')
  } else {
    assert.ok(topicCard, 'Active subject missing from topic directory: ' + id)
    assert.equal(topicCard.querySelector('span')?.text.trim(), numbers.format(articleURLs.length + noteURLs.length) + ' نوشته', 'Topic total is not based on published records: ' + id)
  }
}
for (const page of directoryPages) {
  assert.ok(page.querySelector('body.is-directory'), 'Archive does not use the directory layout')
  assert.equal(page.querySelector('.note-header [data-reading-time]'), null, 'Directory has a misleading reading estimate')
  assert.equal(page.querySelector('.note-header .note-meta'), null, 'Directory still shows article-only metadata')
}

const graph = readJSON('fa/garden/graph.json')
const search = readJSON('fa/garden/searchIndex.json')
const tree = parse(fs.readFileSync(path.join(dist, 'fa/garden/filetree.html'), 'utf8'))
assert.ok(!graph.nodes[root], 'Blog landing page appears as a knowledge node')
assert.ok(!search.some(record => record.url === root), 'Blog landing page appears as a duplicate search result')
assert.ok(!tree.querySelector('a[href="/fa/blog/"]'), 'Blog landing page appears in the note tree')
assert.ok(tree.querySelector('a[href="/fa/blog/notes/start/"]'), 'Study guide does not link directly to its canonical route')
assert.ok(!tree.querySelector('a[href="/fa/garden/"]'), 'File tree still forces the legacy home route')

console.log('PASS blog discovery: ' + sourceArticles.length + ' articles + ' + sourceNotes.length + ' notes, published once in one index')
console.log('PASS taxonomy: 3 sections, 16 stable/new topic routes (15 prominent), exact memberships/counts and Persian query aliases')
console.log('PASS progressive enhancement: labelled controls, readable no-JS lists, clean directories, canonical tree/search/graph')
console.log('Browser interaction, responsive layout and reduced motion are separate checks; this gate does not claim them.')

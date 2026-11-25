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
const cardURLs = (document, kind) => document.querySelectorAll('[data-content-item][data-kind="' + kind + '"]').map(getCardURL)
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
for (const selector of ['[data-search-open]', '[data-global-graph-open]', '[data-settings-open]', '[data-panel-open="navigation"]']) {
  assert.equal(index.querySelectorAll(selector).length, 1, 'Primary action must appear once: ' + selector)
}
for (const selector of ['.workspace-ribbon', '.workspace-strip', '.garden-directory-nav', '[data-tree-filter]', '[data-recent-reading]', '[data-reading-history]', '[data-workspace-panes]', '[data-blog-explorer]', '[data-explorer-empty]', '[data-atlas-preview]']) {
  assert.equal(index.querySelectorAll(selector).length, 0, 'Removed interface remains in the DOM: ' + selector)
}
assert.ok(index.querySelector('body.is-directory'), 'Blog index should use the directory layout')
assert.equal(index.querySelector('h1')?.text.trim(), 'از اینجا شروع کن')
assert.equal(index.querySelectorAll('#garden-context [data-local-graph]').length, 1, 'The landing page needs one sidebar graph')
assert.equal(index.querySelectorAll('main [data-local-graph], main [data-global-graph], main [data-atlas-preview]').length, 0, 'A graph still competes with the reading column')
assert.ok(index.querySelector('#articles'), 'Recent writing section missing')
assert.equal(index.querySelectorAll('.garden-post-cover, main .garden-tags, .blog-index-overview').length, 0, 'Landing page still includes repeated covers, topic panels, or totals')

const startLinks = index.querySelectorAll('#notes .start-links a[href]')
assert.deepEqual(sorted(startLinks.map(link => link.getAttribute('href'))), [root + 'notes/diffusion/', root + 'notes/start/'], 'Start page must provide exactly the two existing study entry points')
const items = index.querySelectorAll('[data-content-item]')
assert.equal(items.length, sourceArticles.length, 'Landing page should list each article once')
assert.deepEqual(sorted(cardURLs(index, 'article')), sorted(sourceArticles.map(articleRoute)), 'Published article missing or duplicated on the start page')
assert.equal(cardURLs(index, 'note').length, 0, 'Start page repeats the sidebar note directory')
const allURLs = items.map(getCardURL)
assert.equal(new Set(allURLs).size, allURLs.length, 'Article list repeats canonical content')
for (const item of items) {
  const source = sourceArticles.find(entry => articleRoute(entry) === getCardURL(item))
  assert.ok(source, 'Article link points outside the published source records')
  assert.equal(item.querySelector('h3 a')?.text.trim(), source.title, 'Article title changed in the directory')
  assert.equal(item.querySelector('.post-card-summary')?.text.trim(), source.description, 'Article summary changed in the directory')
  assert.equal(item.querySelector('time')?.getAttribute('datetime'), source.date, 'Article date changed in the directory')
  assert.ok(item.querySelector('.post-card-meta')?.text.includes('دقیقه مطالعه'), 'Reading time is missing')
  assert.equal(item.querySelectorAll('a[href]').length, 1, 'A directory row exposes duplicate destinations')
  assert.ok(!item.hasAttribute('hidden'), 'Server-rendered article must remain readable without JavaScript')
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
const expectedURLs = sorted([...sourceArticles.map(articleRoute), ...sourceNotes.map(noteRoute)])
const treeURLs = tree.querySelectorAll('.tree-note a[href]').map(link => link.getAttribute('href'))
assert.equal(new Set(treeURLs).size, treeURLs.length, 'The file tree duplicates a canonical note')
assert.deepEqual(sorted(treeURLs), expectedURLs, 'Every published article and note must remain available in the single file tree')
assert.deepEqual(sorted(Object.keys(graph.nodes)), expectedURLs, 'The graph and published content disagree')
assert.deepEqual(sorted(search.map(record => record.url)), expectedURLs, 'The shared search and published content disagree')
// The fallback remains navigable if fetching or scripting is unavailable.
const fallbackLinks = index.querySelectorAll('noscript').flatMap(element => parse(element.innerHTML).querySelectorAll('a[href]').map(link => link.getAttribute('href')))
for (const url of expectedURLs) {
  assert.ok(fallbackLinks.includes(url) || index.querySelector('#workspace-filetree a[href="' + url + '"]'), 'No-script navigation lost a published page: ' + url)
}

assert.ok(!graph.nodes[root], 'Blog landing page appears as a knowledge node')
assert.ok(!search.some(record => record.url === root), 'Blog landing page appears as a duplicate search result')
assert.ok(!tree.querySelector('a[href="/fa/blog/"]'), 'Blog landing page appears in the note tree')
assert.ok(tree.querySelector('a[href="/fa/blog/notes/start/"]'), 'Study guide does not link directly to its canonical route')
assert.ok(!tree.querySelector('a[href="/fa/garden/"]'), 'File tree still forces the legacy home route')

console.log('PASS start page: two study entry points, ' + sourceArticles.length + ' unique article rows; all ' + expectedURLs.length + ' pages accessible in the file tree and shared search')
console.log('PASS taxonomy: 3 sections, 16 stable/new topic routes (15 prominent), exact memberships/counts and Persian query aliases')
console.log('PASS simplified navigation: one entry per primary action, sidebar graph, no filter/workspace/history clutter, complete no-JS links')
console.log('Browser interaction, responsive layout and reduced motion are separate checks; this gate does not claim them.')

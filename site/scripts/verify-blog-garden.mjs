import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { entries } from '../public/fa/blog/entries.js'

// Verify built pages, not equality between old Vite input shells and pages now
// rendered by the original Eleventy Digital Garden template.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const dist = path.resolve(process.argv[2] || path.join(repoRoot, 'site/dist'))
const require = createRequire(path.join(repoRoot, 'garden/package.json'))
const { parse } = require('node-html-parser')
const matter = require('gray-matter')
const matterOptions = require(path.join(repoRoot, 'garden/src/helpers/matterOptions.js'))
const origin = 'https://ialirezaaa.github.io'
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const read = relative => fs.readFileSync(path.join(dist, relative), 'utf8')
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(directory, item.name)) : [path.join(directory, item.name)])
const routeForFile = file => '/' + path.relative(dist, file).split(path.sep).join('/').replace(/index\.html$/, '')
const normalizePath = value => decodeURI(new URL(value, origin).pathname)

function localFile(url) {
  const pathname = decodeURIComponent(new URL(url, origin).pathname)
  const target = path.resolve(dist, '.' + pathname)
  assert.ok(target === dist || target.startsWith(dist + path.sep), 'Local URL escapes build directory: ' + url)
  const candidates = [target, path.join(target, 'index.html')]
  if (!path.extname(target)) candidates.push(target + '.html')
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
}

const htmlFiles = ['fa/garden', 'fa/blog'].flatMap(route => walk(path.join(dist, route)).filter(file => file.endsWith('index.html')))
assert.ok(htmlFiles.length > entries.length + 5, 'Knowledge pages were not generated')
const documents = new Map(htmlFiles.map(file => [routeForFile(file), parse(fs.readFileSync(file, 'utf8'))]))
const manifest = JSON.parse(read('fa/garden/manifest.json'))
const publishedRoutes = new Set(manifest.notes.map(note => note.url))
const garden = documents.get('/fa/blog/')
assert.ok(garden, 'Missing unified blog home')
assert.equal(manifest.redirects['/fa/garden/'], '/fa/blog/')

for (const [route, document] of documents) {
  const identifiers = document.querySelectorAll('[id]').map(element => element.getAttribute('id'))
  assert.equal(new Set(identifiers).size, identifiers.length, 'Duplicate DOM id: ' + route)
  const html = document.querySelector('html')
  assert.equal(html?.getAttribute('lang'), 'fa', 'Persian language missing: ' + route)
  assert.equal(html?.getAttribute('dir'), 'rtl', 'RTL document missing: ' + route)
  if (Object.hasOwn(manifest.redirects,route)) {
    assert.match(document.querySelector('meta[name="robots"]')?.getAttribute('content')||'', /noindex/)
    assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'),origin+manifest.redirects[route])
    assert.ok(document.querySelector('a[href="'+manifest.redirects[route]+'"]'), 'Legacy redirect needs fallback link')
    assert.ok(localFile(manifest.redirects[route]), 'Legacy redirect target missing')
    continue
  }
  if (!publishedRoutes.has(route)) {
    assert.ok(['/fa/garden/404/','/fa/garden/~random/'].includes(route), 'Unexpected stale or unlisted page: ' + route)
    assert.match(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '', /noindex/, 'Auxiliary page must not be indexed: ' + route)
    continue
  }
  assert.match(document.querySelector('meta[name="generator"]')?.getAttribute('content') || '', /digitalgarden|digital garden/i, 'Original template provenance missing: ' + route)
  assert.ok(document.querySelector('main#content [data-note-body]'), 'Readable server-rendered note body missing: ' + route)
  assert.ok(document.querySelector('main h1')?.text.trim(), 'Note title missing: ' + route)
  const directory = Boolean(document.querySelector('main.blog-directory'))
  const featureSelectors = ['#garden-navigation', '[data-filetree]', '#garden-search', '#garden-search-input', '#garden-search-results', '#garden-settings', '#garden-graph', '#garden-context', '[data-local-graph]']
  if (!directory) featureSelectors.push('[data-copy-link]', 'progress#reading-progress')
  else assert.equal(document.querySelector('[data-copy-link]'), null, 'Directory includes an article-only share action: ' + route)
  for (const selector of featureSelectors) {
    assert.ok(document.querySelector(selector), 'Garden feature missing ' + selector + ': ' + route)
  }
  for (const setting of ['theme', 'size']) {
    assert.ok(document.querySelector('[data-setting="' + setting + '"]'), 'Reading setting missing: ' + setting)
  }
  for (const dialog of document.querySelectorAll('dialog')) {
    const label = dialog.getAttribute('aria-labelledby')
    assert.ok(label && document.getElementById(label)?.text.trim(), 'Unlabelled dialog: ' + route)
  }
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''
  assert.match(robots, /(?:noindex|index),\s*follow/, 'Explicit crawler policy missing: ' + route)
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
  assert.ok(canonical?.startsWith(origin + '/fa/'), 'Wrong canonical origin: ' + route)
  if (!robots.includes('noindex')) assert.equal(normalizePath(canonical), normalizePath(route), 'Indexable page canonical mismatch: ' + route)
  assert.ok(document.querySelector('[data-note-body]')?.text.trim().length > 30, 'Empty note content: ' + route)
}

// Assert the template's native graph schema and consistency, including articles.
const graph = JSON.parse(read('fa/garden/graph.json'))
assert.ok(graph.nodes && !Array.isArray(graph.nodes) && Array.isArray(graph.links), 'Expected upstream Digital Garden graph schema')
const nodes = Object.values(graph.nodes)
const ids = new Map(nodes.map(node => [node.id, node]))
assert.equal(ids.size, nodes.length, 'Duplicate graph node id')
assert.ok(nodes.length >= entries.length + 5, 'Published note graph is incomplete')
assert.ok(graph.links.length >= 6, 'Note relationships are missing')
for (const [key, node] of Object.entries(graph.nodes)) {
  assert.equal(key, node.url, 'Graph key and URL differ')
  assert.ok(localFile(node.url), 'Graph target missing: ' + node.url)
  assert.ok(node.url.startsWith('/fa/blog/'), 'Unprefixed graph URL: ' + node.url)
  for (const backlink of node.backLinks) {
    assert.ok(graph.nodes[backlink], 'Dangling backlink: ' + backlink)
    assert.ok(graph.nodes[backlink].outBound.includes(node.url), 'Backlink has no source link: ' + backlink)
  }
}
for (const link of graph.links) {
  const source = ids.get(link.source)
  const target = ids.get(link.target)
  assert.ok(source && target, 'Dangling graph edge')
  assert.ok(source.outBound.includes(target.url), 'Graph edge has no outgoing link')
  assert.ok(target.backLinks.includes(source.url), 'Graph edge missing backlink')
}
for (const entry of entries) assert.ok(nodes.some(node => node.url === '/fa/blog/' + entry.slug + '/'), 'Article absent from graph: ' + entry.slug)

// The sidebar lists real public incoming references and stays absent when a
// page has none; an isolated note must not acquire a placeholder section.
for (const node of nodes.filter(node => !node.private)) {
  const document = documents.get(node.url)
  assert.ok(document, 'Public graph note has no reading page: ' + node.url)
  const expected = node.backLinks.filter(url => url !== node.url && graph.nodes[url] && !graph.nodes[url].private).sort()
  const actual = document.querySelectorAll('[data-backlinks] a[href]').map(link => link.getAttribute('href')).sort()
  assert.deepEqual(actual, expected, 'Incoming reference list differs from the published graph: ' + node.url)
  assert.equal(document.querySelectorAll('[data-backlinks]').length, expected.length ? 1 : 0, 'Incoming reference section must appear exactly when useful: ' + node.url)
}

// Editorial index and reader regression: exercise real generated markup.
const editorialIndex = documents.get('/fa/blog/')
assert.ok(editorialIndex, 'Blog index missing')
assert.equal(editorialIndex.querySelectorAll('.garden-wordmark[href="/fa/blog/"]').length, 1, 'The branded blog entry must appear once')
assert.ok(!editorialIndex.querySelector('.topbar-links a[href="/fa/garden/"]'), 'Parallel garden landing in top navigation')
assert.ok(editorialIndex.querySelector('#articles'))
assert.ok(editorialIndex.querySelector('#notes'), 'Existing study-entry anchor must remain usable')
const knowledgeLinks = new Set(editorialIndex.querySelectorAll('#notes .start-links a').map(link => link.getAttribute('href')))
assert.deepEqual([...knowledgeLinks].sort(), ['/fa/blog/notes/animation/', '/fa/blog/notes/diffusion/', '/fa/blog/notes/start/'], 'Start page must expose the guide and learning paths')
for (const href of knowledgeLinks) assert.ok(localFile(href), 'Broken study entry link: ' + href)
const editorialCards = editorialIndex.querySelectorAll('.garden-post-list > li[data-content-item]')
assert.equal(editorialCards.length, entries.length, 'Start page lost an approved article')
for (const card of editorialCards) {
  assert.equal(card.querySelectorAll('a[href]').length, 1, 'Article row repeats a destination')
  assert.ok(card.querySelector('h3 a')?.text.trim(), 'Article row needs a named title link')
  assert.ok(localFile(card.querySelector('h3 a')?.getAttribute('href')), 'Article row points to an unbuilt route')
  assert.equal(card.querySelector('img'), null, 'Directory image competes with the simplified reading list')
  assert.match(card.querySelector('time')?.getAttribute('datetime') || '', /^\d{4}-\d{2}-\d{2}$/, 'Article row has no publication date')
}
const figureNumbers = new Intl.NumberFormat('fa-IR')
for (const [route, doc] of documents) {
  if (!doc.querySelector('main.blog-article')) continue
  const figures = doc.querySelectorAll('.article-prose .article-figure')
  for (const [index, figure] of figures.entries()) {
    const caption = figure.querySelector('figcaption')
    assert.ok(caption, 'Missing accessible figure caption: ' + route)
    assert.equal(caption.querySelector('.figure-index')?.text.trim(), 'تصویر در این نوشته · ' + figureNumbers.format(index + 1), 'Figure order mismatch: ' + route)
    const src = figure.querySelector('img')?.getAttribute('src') || ''
    const open = caption.querySelector('.figure-open')
    if (src.startsWith('/fa/blog/media/') || src.startsWith('https://arxiv.org/')) {
      assert.equal(open?.getAttribute('href'), src, 'Original-image destination mismatch: ' + route)
      assert.ok(open?.getAttribute('aria-label')?.includes(figureNumbers.format(index + 1)), 'Missing named image link: ' + route)
    }
  }
}

const search = JSON.parse(read('fa/garden/searchIndex.json'))
assert.ok(Array.isArray(search) && search.length >= entries.length + 5, 'Search corpus missing published notes')
assert.ok(search.some(item => /[\u0600-\u06ff]/.test(item.title) && /[\u0600-\u06ff]/.test(item.content)), 'Search corpus lost Persian Unicode')
const searchURLs = new Set()
for (const item of search) {
  assert.equal(typeof item.title, 'string')
  assert.equal(typeof item.content, 'string')
  assert.ok(!searchURLs.has(item.url), 'Duplicate search result URL')
  searchURLs.add(item.url)
  assert.ok(graph.nodes[item.url] && !graph.nodes[item.url].private, 'Search exposes a hidden or unknown note: ' + item.url)
  assert.ok(localFile(item.url), 'Search target does not exist: ' + item.url)
}
for (const node of nodes.filter(node => !node.private)) assert.ok(searchURLs.has(node.url), 'Public graph node absent from search: ' + node.url)

// Exercise the published Persian search implementation, not a duplicate model.
const { normalizeSearchText, searchNotes } = await import(pathToFileURL(path.join(dist, 'fa/garden/scripts/hades.js')).href)
assert.equal(normalizeSearchText('يادگيري كَتاب ۱۲۳ ٤٥٦'), normalizeSearchText('یادگیری کتاب 123 456'))
assert.equal(normalizeSearchText('مدل‌های'), normalizeSearchText('مدل های'))
const searchFixture = [
  {title:'یادگیری مدل‌های تصویری', content:'آموزش شبکه', tags:['هوش مصنوعی'], aliases:['تصویرساز'], url:'/a/'},
  {title:'کتاب', content:'روایت و انیمیشن', tags:[], aliases:[], url:'/b/'},
]
for (const query of ['يادگيري','مدلهای','مدل های','تصويرساز','هوش مصنوعي']) {
  assert.equal(searchNotes(searchFixture,query)[0]?.url,'/a/','Persian search variant failed: ' + query)
}
assert.equal(searchNotes(searchFixture,'شبکه کتاب').length,0,'Multiword search must match one record')
assert.ok(searchNotes(search,'نویز').some(note => note.url === '/fa/blog/notes/noise/'),'Published Persian note is not findable')


assert.equal(manifest.version, 2)
assert.equal(manifest.generator, 'oleeskild/digitalgarden')
assert.equal(manifest.language, 'fa')
assert.equal(manifest.direction, 'rtl')
assert.equal(manifest.basePath, '/fa/garden/')
assert.match(manifest.sourceDigest, /^[a-f0-9]{64}$/)
assert.ok(manifest.notes.length >= entries.length + 5)
const manifestURLs = new Set(manifest.notes.map(note => note.url))
for (const node of nodes) assert.ok(manifestURLs.has(node.url), 'Graph node absent from publication manifest')
for (const note of manifest.notes) {
  assert.ok(note.url.startsWith('/fa/blog/'), 'Separate public knowledge route: '+note.url)
  if (note.legacyUrl) assert.ok(Object.hasOwn(manifest.redirects,note.legacyUrl), 'Missing compatibility redirect: '+note.legacyUrl)
  assert.ok(localFile(note.url), 'Published manifest note has no built page: ' + note.url)
  if (note.hidden) assert.ok(!graph.nodes[note.url], 'Hidden directory appears in discovery graph: ' + note.url)
  else assert.ok(graph.nodes[note.url], 'Manifest note is missing from native graph: ' + note.url)
}
assert.ok(Object.keys(manifest.assets).length > 5, 'Build manifest lacks asset hashes')
for (const [url, expected] of Object.entries(manifest.assets)) {
  const file = localFile(url)
  assert.ok(file, 'Manifest asset missing: ' + url)
  assert.equal(sha256(fs.readFileSync(file)), expected, 'Manifest asset hash mismatch: ' + url)
}

// Verify a real self-hosted font binary with its original redistribution licence.
const font = fs.readFileSync(path.join(dist, 'fa/garden/fonts/mikhak.woff2'))
assert.equal(font.toString('ascii', 0, 4), 'wOF2', 'Font is not a WOFF2 binary')
assert.equal(sha256(font), '18e507e1ae85db40fac1ae651655ebdf5b7ec990835328bdede753ce6654007a', 'Mikhak differs from the pinned original')
assert.match(read('fa/garden/fonts/OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/)
assert.ok(garden.querySelector('link[rel="preload"][as="font"]')?.getAttribute('href')?.includes('/fa/garden/fonts/mikhak.woff2'))

// Inspect every same-site destination referenced by the rendered reading pages.
let checkedReferences = 0
for (const [route, document] of documents) {
  for (const element of document.querySelectorAll('a[href],img[src],script[src],link[href],source[src],iframe[src]')) {
    const value = element.getAttribute('href') ?? element.getAttribute('src')
    if (!value || /^(?:data:|mailto:|tel:|javascript:|obsidian:)/i.test(value)) continue
    const url = new URL(value, origin + route)
    if (url.origin !== origin) continue
    const target = localFile(url.href)
    assert.ok(target, 'Broken local reference ' + value + ' on ' + route)
    if (url.hash && target.endsWith('.html')) {
      const targetDocument = normalizePath(url.href) === normalizePath(route) ? document : parse(fs.readFileSync(target, 'utf8'))
      assert.ok(targetDocument.getElementById(decodeURIComponent(url.hash.slice(1))), 'Broken anchor ' + value + ' on ' + route)
    }
    checkedReferences++
  }
}
const tree = parse(read('fa/garden/filetree.html'))
assert.deepEqual(tree.querySelectorAll('.tree-note a[href]').map(link => link.getAttribute('href')).sort(), nodes.filter(node => !node.private).map(node => node.url).sort(), 'Filetree must contain every public graph page once')
for (const link of tree.querySelectorAll('a[href]')) assert.ok(localFile(link.getAttribute('href')), 'Broken filetree link')

// Published input to the template must be explicitly allowed, never an entire
// private vault. Other unpublished authoring files may exist outside this stage.
const notesRoot = path.join(repoRoot, 'garden/.cache/publish-stage/src/site/notes')
const markdownFiles = walk(notesRoot).filter(file => file.endsWith('.md'))
assert.equal(markdownFiles.length, manifest.notes.length, 'Published staging set and manifest disagree')
for (const file of markdownFiles) {
  const { data } = matter(fs.readFileSync(file, 'utf8'), matterOptions)
  assert.equal(data['dg-publish'], true, 'Note lacks explicit publication flag: ' + path.relative(repoRoot, file))
  assert.notEqual(data.public, false, 'Explicitly private note reached publishing stage: ' + path.relative(repoRoot, file))
  assert.notEqual(data.draft, true, 'Draft note reached publishing stage: ' + path.relative(repoRoot, file))
}

console.log('PASS: original Digital Garden template; ' + documents.size + ' Persian RTL pages; reading/search/navigation controls')
console.log('PASS: graph ' + nodes.length + ' nodes/' + graph.links.length + ' edges; ' + search.length + ' search records; publication manifest and Markdown')
console.log('PASS: original Mikhak WOFF2 and OFL licence; ' + checkedReferences + ' local resource/anchor references')

import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// A fresh build is the expected release. HTML includes build-time timestamps,
// so compare deterministic source provenance first, then validate each hosted
// asset against the deployed manifest's hashes instead of hashing old shells.
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(path.join(repoRoot, 'garden/package.json'))
const { parse } = require('node-html-parser')
const dist = path.resolve(process.argv[2] || path.join(repoRoot, 'site/dist'))
const live = new URL(process.env.GARDEN_LIVE_URL || 'https://ialirezaaa.github.io/')
const expected = JSON.parse(fs.readFileSync(path.join(dist, 'fa/garden/manifest.json'), 'utf8'))
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
assert.equal(expected.generator, 'oleeskild/digitalgarden', 'Build the actual garden before live verification')
assert.match(expected.sourceDigest, /^[a-f0-9]{64}$/)

async function fetchVerified(route, check, label = route) {
  let last
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const url = new URL(route, live)
      url.searchParams.set('garden-release', expected.sourceDigest.slice(0, 16))
      url.searchParams.set('attempt', String(attempt))
      const response = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(15000),
      })
      assert.equal(response.status, 200, 'HTTP ' + response.status + ': ' + label)
      const bytes = Buffer.from(await response.arrayBuffer())
      await check(response, bytes)
      return bytes
    } catch (error) {
      last = error
      if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 4000))
    }
  }
  throw new Error('Live verification failed for ' + label + ': ' + String(last))
}

let manifest
await fetchVerified('/fa/garden/manifest.json', (response, bytes) => {
  assert.ok((response.headers.get('content-type') || '').includes('json'), 'Manifest MIME')
  const candidate = JSON.parse(bytes)
  assert.equal(candidate.version, 2)
  assert.equal(candidate.generator, 'oleeskild/digitalgarden')
  assert.equal(candidate.sourceDigest, expected.sourceDigest, 'Deployed source digest differs from this build')
  assert.equal(candidate.language, 'fa')
  assert.equal(candidate.direction, 'rtl')
  assert.equal(candidate.basePath, '/fa/garden/')
  assert.deepEqual(candidate.notes.map(note => note.url).sort(), expected.notes.map(note => note.url).sort(), 'Published note set differs')
  assert.deepEqual(candidate.redirects, expected.redirects, 'Published legacy redirect map differs')
  assert.equal(candidate.redirects?.['/fa/garden/'], '/fa/blog/', 'Legacy Garden root must lead to the unified blog')
  manifest = candidate
})
console.log('PASS live release provenance', expected.sourceDigest)

const mimeFor = route => {
  if (/\.html$/.test(route) || route.endsWith('/')) return /text\/html/i
  if (/\.css$/.test(route)) return /text\/css/i
  if (/\.m?js$/.test(route)) return /(?:javascript|ecmascript)/i
  if (/\.json$/.test(route)) return /(?:application|text)\/(?:[^;]+\+)?json/i
  if (/\.woff2$/.test(route)) return /(?:font\/woff2|application\/(?:font-woff2|octet-stream))/i
  return null
}
const required = new Set([
  '/fa/garden/index.html',
  '/fa/blog/index.html',
  '/fa/garden/graph.json',
  '/fa/garden/searchIndex.json',
  '/fa/garden/filetree.html',
  '/fa/garden/fonts/mikhak.woff2',
])
// Follow the release's actual compiled front end rather than hardcode obsolete
// reader.css/reader.js paths. Include every published note and article document.
for (const route of Object.keys(manifest.assets)) {
  if (/\/(?:scripts|styles)\//.test(route) && /\.(?:css|m?js)$/.test(route)) required.add(route)
}
for (const note of manifest.notes) required.add(note.url.endsWith('/') ? note.url + 'index.html' : note.url)
for (const route of Object.keys(manifest.redirects)) required.add(route.endsWith('/') ? route + 'index.html' : route)
for (const route of required) assert.match(manifest.assets[route] || '', /^[a-f0-9]{64}$/, 'Required asset absent from release manifest: ' + route)

const received = new Map()
const queue = [...required]
for (let start = 0; start < queue.length; start += 4) {
  await Promise.all(queue.slice(start, start + 4).map(async route => {
    const bytes = await fetchVerified(route, (response, body) => {
      const mime = mimeFor(route)
      if (mime) assert.match(response.headers.get('content-type') || '', mime, 'Wrong MIME: ' + route)
      assert.equal(hash(body), manifest.assets[route], 'Hosted content differs from release hash: ' + route)
      if (route.endsWith('.html') && route !== '/fa/garden/filetree.html') {
        const text = body.toString('utf8')
        assert.match(text, /<html[^>]*lang="fa"[^>]*dir="rtl"/i, 'RTL page missing: ' + route)
        const redirectTarget = manifest.redirects[route.replace(/index\.html$/, '')]
        if (redirectTarget) {
          // Compatibility pages deliberately have no reading shell: requiring
          // one would reject every correctly deployed Garden-to-blog redirect.
          const document = parse(text)
          assert.match(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '', /noindex/, 'Legacy page must not be indexed: ' + route)
          assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), new URL(redirectTarget, 'https://ialirezaaa.github.io').href, 'Legacy canonical mismatch: ' + route)
          assert.equal(document.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content'), '0; url=' + redirectTarget, 'Legacy automatic destination mismatch: ' + route)
          assert.ok(document.querySelectorAll('a[href]').some(link => link.getAttribute('href') === redirectTarget), 'Legacy redirect lacks a usable fallback link: ' + route)
          assert.ok(!document.querySelector('[data-note-body]'), 'Legacy URL still publishes duplicate content: ' + route)
        } else {
          assert.match(text, /name="generator"[^>]*digital.?garden/i, 'Original template marker missing: ' + route)
          assert.ok(text.includes('id="garden-search"') && text.includes('data-note-body'), 'Published reading shell missing: ' + route)
        }
      }
    })
    received.set(route, bytes)
    console.log('PASS HTTP 200 MIME SHA', route)
  }))
}

const graph = JSON.parse(received.get('/fa/garden/graph.json'))
const nodes = Object.values(graph.nodes)
const ids = new Set(nodes.map(node => node.id))
assert.ok(nodes.length >= 5 && graph.links.length >= 6)
assert.ok(graph.links.every(link => ids.has(link.source) && ids.has(link.target)), 'Published graph has dangling edges')
const search = JSON.parse(received.get('/fa/garden/searchIndex.json'))
assert.ok(nodes.every(note => note.url.startsWith('/fa/blog/')), 'Legacy content URL remains in the public graph')
assert.ok(search.every(note => note.url.startsWith('/fa/blog/')), 'Legacy content URL remains in public search')
assert.ok(search.some(note => /[\u0600-\u06ff]/.test(note.title)), 'Persian search text is missing')
assert.ok(search.every(note => graph.nodes[note.url] && !graph.nodes[note.url].private), 'Search and graph publication sets disagree')
const font = received.get('/fa/garden/fonts/mikhak.woff2')
assert.equal(font.toString('ascii', 0, 4), 'wOF2')
assert.equal(hash(font), '18e507e1ae85db40fac1ae651655ebdf5b7ec990835328bdede753ce6654007a')
const diffusion = received.get('/fa/blog/diffusion-from-noise/index.html')?.toString('utf8')
assert.ok(diffusion?.includes('BlogPosting') && diffusion.includes('id="prose"') && diffusion.includes('/fa/garden/'), 'Article metadata/content integration missing')
console.log('PASS live original template, Persian corpus, public graph, real Mikhak and article integration')
console.log('Browser layout, focus and actual font rendering are verified separately; HTTP checks do not establish them.')

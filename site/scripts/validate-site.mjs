import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphNodes, projects, routes } from '../src/data.js'
import { alternateLocaleUrl, isPersianPath, officialLinks, pathnameFor, translate } from '../src/i18n.js'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = 'https://ialirezaaa.github.io/'
const endpoints = ['', 'about', 'work', 'systems', 'contact']
const pageUrl = (route, lang) => origin + (lang === 'fa' ? 'fa/' : '') + (route ? route + '/' : '')
const fileFor = (route, lang) => path.join(dist, lang === 'fa' ? 'fa' : '', route, 'index.html')
const read = file => fs.readFileSync(file, 'utf8')
const robots = read(path.join(dist, 'robots.txt'))
const sitemap = read(path.join(dist, 'sitemap.xml'))
const titles = new Set()

assert.match(robots, /User-agent:\s*\*/)
assert.match(robots, /Allow:\s*\//)
assert.ok(robots.includes(origin + 'sitemap.xml'))
assert.equal([...sitemap.matchAll(/<loc>/g)].length, endpoints.length * 2)
assert.equal([...sitemap.matchAll(/hreflang="fa"/g)].length, endpoints.length * 2)
assert.equal([...sitemap.matchAll(/hreflang="en"/g)].length, endpoints.length * 2)

for (const route of endpoints) {
  for (const lang of ['en', 'fa']) {
    const url = pageUrl(route, lang)
    const html = read(fileFor(route, lang))
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
    assert.ok(title, 'Missing title on ' + url)
    assert.ok(!titles.has(title), 'Duplicate title: ' + title)
    titles.add(title)
    assert.ok(html.includes('lang="' + lang + '"'), 'Language missing: ' + url)
    assert.ok(html.includes('href="' + url + '"'), 'Canonical URL missing: ' + url)
    assert.ok(html.includes('hreflang="en" href="' + pageUrl(route, 'en') + '"'), 'English hreflang missing')
    assert.ok(html.includes('hreflang="fa" href="' + pageUrl(route, 'fa') + '"'), 'Persian hreflang missing')
    assert.ok(html.includes('property="og:url" content="' + url + '"'), 'Wrong Open Graph URL')
    assert.match(html, /name="description" content="[^"]{40,}"/)
    assert.match(html, /name="robots" content="index, follow/)
    assert.ok(html.includes('علیرضا عسگرپور'), 'Missing Persian full name')
    assert.ok(html.includes('Alireza Asgarpour'), 'Missing English full name')
    assert.ok(html.includes('<noscript>'), 'Missing no-JS text fallback')
    const match = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)
    assert.ok(match, 'Missing structured data: ' + url)
    const schema = JSON.parse(match[1])
    const person = schema['@graph'].find(node => node['@type'] === 'Person')
    const profile = schema['@graph'].find(node => node['@type'] === 'ProfilePage')
    assert.equal(person.name, 'Alireza Asgarpour')
    assert.ok(person.alternateName.includes('علیرضا عسگرپور'))
    assert.equal(profile.url, url)
    assert.equal(profile.inLanguage, lang)
    for (const link of officialLinks) {
      assert.ok(html.includes(link.href), 'Missing public social link ' + link.name + ': ' + url)
      if (link.personal) assert.ok(person.sameAs.includes(link.href), 'Missing sameAs: ' + link.name)
      else assert.ok(!person.sameAs.includes(link.href), 'News channel is not a personal sameAs')
    }
  }
}
const home = read(fileFor('', 'en'))
const entry = home.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
const style = home.match(/href="(\/assets\/[^"]+\.css)"/)?.[1]
assert.ok(entry && style, 'Missing compiled Vite assets')
for (const asset of [entry, style]) assert.ok(fs.existsSync(path.join(dist, asset.slice(1))), 'Asset not written: ' + asset)
assert.match(read(path.join(dist, '404.html')), /noindex, nofollow/)

assert.equal(pathnameFor('/contact', true), '/fa/contact')
assert.equal(pathnameFor('/fa/contact', false), '/contact')
assert.equal(pathnameFor('/', true), '/fa/')
assert.equal(alternateLocaleUrl('/fa/work?project=dolphin', true), '/work?project=dolphin')
assert.equal(isPersianPath('/fa/about'), true)
assert.equal(isPersianPath('/about'), false)
assert.equal(translate('Identity', true), 'هویت')
assert.equal(translate('Identity', false), 'Identity')
for (const route of routes) {
  for (const word of route.slice(1)) assert.notEqual(translate(word, true), word, 'Missing route translation: ' + word)
}
for (const project of projects) {
  for (const field of ['kind', 'date', 'role', 'text', 'note']) {
    assert.notEqual(translate(project[field], true), project[field], 'Missing ' + field + ' translation in ' + project.id)
  }
}
for (const node of graphNodes) {
  assert.notEqual(translate(node.description, true), node.description, 'Missing node description: ' + node.id)
}
for (const label of ['Production', 'AI workflows', 'Worldbuilding', 'Production memory', 'Style continuity', 'Human judgement', 'Story architecture']) {
  assert.notEqual(translate(label, true), label, 'Missing node label: ' + label)
}
assert.equal(officialLinks.length, 5)
console.log('SEO, language routing, project translations, five official links and ten pages: PASS')

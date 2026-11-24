import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphNodes, projects, routes } from '../src/data.js'
import { alternateLocaleUrl, isPersianPath, officialLinks, pathnameFor, translate } from '../src/i18n.js'

import { entries as blogEntries } from '../public/fa/blog/entries.js'
import { defaults, normalizeSettings, readingStats, visibleEntries } from '../public/fa/blog/reader-model.js'

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
assert.equal([...sitemap.matchAll(/<loc>/g)].length, endpoints.length * 2 + 2 + blogEntries.length)
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
    assert.equal(html.includes('href="' + origin + 'fa/blog/"'), lang === 'fa', 'Blog link should appear only in Persian')
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
for (const link of officialLinks) {
  assert.ok(link.handle && /^(?:@|\/in\/)/.test(link.handle), 'Public account must display a recognizable handle: ' + link.name)
  assert.ok(link.href.startsWith('https://'), 'Social URL must use HTTPS: ' + link.name)
}
assert.ok(officialLinks.some(link => link.name === 'Airis Feed' && link.personal === false), 'News channel must remain distinct from personal profiles')
const googleVerificationFile = read(path.join(dist, 'googleb94d773f21def0ef.html'))
assert.equal(googleVerificationFile, 'google-site-verification: googleb94d773f21def0ef.html', 'Google Search Console HTML verification file must remain exact')
const blog = read(fileFor('blog', 'fa'))
assert.match(blog, /<html lang="fa" dir="rtl"/)
assert.ok(blog.includes('href="' + origin + 'fa/blog/"'))
assert.ok(sitemap.includes('<loc>' + origin + 'fa/blog/</loc>'))
assert.ok(!fs.existsSync(fileFor('blog', 'en')))
for (const name of ['reader.css','reader.js','entries.js','reader-model.js']) assert.ok(fs.existsSync(path.join(dist, 'fa', 'blog', name)))
for (const key of Object.keys(defaults)) assert.ok(blog.includes('id="' + key + '"'))
assert.deepEqual(normalizeSettings(null), defaults)
assert.deepEqual(normalizeSettings({theme:'light', size:'oops', measure:'wide', leading:'airy'}), {theme:'light', size:'regular', measure:'wide', leading:'airy'})
const fixture = {slug:'fixture', title:'یک نوشته', date:'2026-11-24', description:'برای آزمون', sections:[{title:'آزمون', paragraphs:['پشت‌صحنه '+ 'واژه '.repeat(180)]}]}
assert.deepEqual(readingStats(fixture), {words:182, minutes:2})
assert.deepEqual(visibleEntries([null, {...fixture, date:'2026-02-30'}, {...fixture, slug:'bad/post'}, fixture]), [fixture])
assert.equal(visibleEntries(blogEntries).length, blogEntries.length)
for (const entry of blogEntries) {
  const route = '/fa/blog/' + entry.slug + '/'
  const canonical = new URL(route, origin).href
  const article = read(path.join(dist, route, 'index.html'))
  assert.ok(blog.includes('href="' + route + '"'))
  assert.ok(sitemap.includes('<loc>' + canonical + '</loc>'))
  assert.ok(article.includes('<link rel="canonical" href="' + canonical + '">'))
  assert.ok(article.includes('property="og:image" content="' + new URL(entry.hero.path, origin).href + '"'))
  assert.ok(article.includes('datetime="' + entry.date + '"'))
  assert.ok(article.includes('دقیقه مطالعه'))
  assert.ok(article.includes('id="prose"><'))
  assert.ok(!article.includes('id="article" hidden'))
  assert.ok(fs.existsSync(path.join(dist, entry.hero.path)))
  const schemas = [...article.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]))
  const posting = schemas.find(schema => schema['@type'] === 'BlogPosting')
  assert.equal(posting.mainEntityOfPage, canonical)
  assert.equal(posting.inLanguage, 'fa')
  assert.equal(posting.image.url, new URL(entry.hero.path, origin).href)
  assert.deepEqual(schemas.find(schema => schema['@type'] === 'BreadcrumbList').itemListElement.map(item => item.position), [1, 2, 3])
  for (const tag of entry.tags ?? []) {
    const filter = '/fa/blog/tags/' + tag + '/'
    const filteredPage = read(path.join(dist, filter, 'index.html'))
    assert.ok(article.includes('href="' + filter + '"'))
    assert.ok(blog.includes('href="' + filter + '"'))
    assert.ok(filteredPage.includes('href="' + filter + '" aria-current="page"'))
    assert.ok(filteredPage.includes('href="' + route + '"'))
    assert.ok(filteredPage.includes('<link rel="canonical" href="' + origin + 'fa/blog/">'))
    assert.ok(filteredPage.includes('name="robots" content="noindex, follow"'))
    assert.ok(!sitemap.includes('<loc>' + new URL(filter, origin).href + '</loc>'))
  }
  for (const figure of entry.figures ?? []) {
    assert.ok(article.includes('src="' + figure.path + '"'))
    assert.ok(article.includes('class="article-figure"'))
    assert.ok(article.includes('<figcaption>'))
    if (figure.path.startsWith('https:')) {
      assert.equal(new URL(figure.path).origin, 'https://arxiv.org')
      assert.ok(!article.includes('href="' + figure.path + '"'))
      assert.ok(!article.includes('#page=2'))
    } else assert.ok(fs.existsSync(path.join(dist, figure.path)))
  }
  const image = fs.readFileSync(path.join(dist, entry.hero.path))
  assert.equal(image.toString('ascii', 0, 4), 'RIFF')
  assert.equal(image.toString('ascii', 8, 12), 'WEBP')
}
console.log('Persian-only blog, entry validation and reading controls: PASS')
console.log('SEO, language routing, project translations, five official links and ten pages: PASS')

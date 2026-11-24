import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { graphNodes, projects, routes } from '../src/data.js'
import { alternateLocaleUrl, isPersianPath, officialLinks, pathnameFor, translate } from '../src/i18n.js'

import { entries as blogEntries } from '../public/fa/blog/entries.js'
import { defaults, normalizeSettings, readingStats, visibleEntries } from '../public/fa/blog/reader-model.js'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = 'https://ialirezaaa.github.io/'
const gardenRequire = createRequire(fileURLToPath(new URL('../../garden/package.json', import.meta.url)))
const { parse } = gardenRequire('node-html-parser')
const parseHTML = file => parse(fs.readFileSync(file, 'utf8'))
const walk = directory => fs.readdirSync(directory, { withFileTypes:true }).flatMap(item => item.isDirectory() ? walk(path.join(directory,item.name)) : [path.join(directory,item.name)])
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
const sitemapURLs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replaceAll('&amp;', '&'))
assert.equal(new Set(sitemapURLs).size, sitemapURLs.length, 'Sitemap contains duplicate URLs')
const expectedSitemapURLs = new Set(endpoints.flatMap(route => ['en','fa'].map(lang => pageUrl(route,lang))))
for (const file of ['fa/blog','fa/garden'].flatMap(route => walk(path.join(dist,route))).filter(file => file.endsWith('index.html'))) {
  const document = parseHTML(file)
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''
  if (robots.includes('noindex')) continue
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
  const actual = new URL(path.relative(dist,file).split(path.sep).join('/').replace(/index\.html$/, ''),origin).href
  assert.ok(canonical, 'Missing canonical on eligible page: ' + actual)
  assert.equal(new URL(canonical).href, actual, 'Eligible page must have a self canonical: ' + actual)
  expectedSitemapURLs.add(actual)
}
assert.deepEqual([...sitemapURLs].sort(), [...expectedSitemapURLs].sort(), 'Sitemap must include every eligible portfolio, article and note page exactly once')
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
const blogDocument = parse(blog)
for (const slug of ['categories','tags']) {
  const route = '/fa/blog/' + slug + '/'
  const directory = parseHTML(path.join(dist,route,'index.html'))
  assert.equal(directory.querySelector('body')?.getAttribute('data-garden-page'),route)
  assert.ok(sitemapURLs.includes(new URL(route,origin).href))
  assert.ok(blogDocument.querySelector('a[href="' + route + '"]'))
}
assert.ok(sitemapURLs.includes(origin + 'fa/garden/'))
for (const slug of ['papers','repo-analysis','fundamentals']) {
  const route = '/fa/blog/categories/' + slug + '/'
  const category = parseHTML(path.join(dist,route,'index.html'))
  const count = blogEntries.filter(entry => entry.categoryId === slug).length
  assert.equal(!!category.querySelector('.directory-state'),!count)
  assert.equal(sitemapURLs.includes(new URL(route,origin).href),!!count)
  assert.equal(category.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'),!count)
  assert.equal(category.querySelectorAll('.garden-post-list > li').length,count)
}
assert.equal(blogDocument.querySelector('html')?.getAttribute('lang'),'fa')
assert.equal(blogDocument.querySelector('html')?.getAttribute('dir'),'rtl')
assert.equal(blogDocument.querySelector('link[rel="canonical"]')?.getAttribute('href'),origin + 'fa/blog/')
assert.ok(sitemapURLs.includes(origin + 'fa/blog/'))
assert.ok(!fs.existsSync(fileFor('blog','en')))
for (const key of Object.keys(defaults)) assert.ok(blogDocument.querySelector('[data-setting="' + key + '"]'))
assert.deepEqual(normalizeSettings(null),defaults)
assert.deepEqual(normalizeSettings({theme:'light', size:'oops', measure:'wide', leading:'airy'}),{theme:'light', size:'regular', measure:'wide', leading:'airy'})
const fixture = {slug:'fixture', title:'یک نوشته', date:'2026-11-24', description:'برای آزمون', sections:[{title:'آزمون', paragraphs:['پشت‌صحنه '+ 'واژه '.repeat(180)]}]}
assert.deepEqual(readingStats(fixture),{words:182, minutes:2})
assert.deepEqual(visibleEntries([null, {...fixture, date:'2026-02-30'}, {...fixture, slug:'bad/post'}, fixture]),[fixture])
assert.equal(visibleEntries(blogEntries).length,blogEntries.length)
for (const entry of blogEntries) {
  const route = '/fa/blog/' + entry.slug + '/'
  const canonical = new URL(route,origin).href
  const article = read(path.join(dist,route,'index.html'))
  const document = parse(article)
  assert.ok(blogDocument.querySelector('a[href="' + route + '"]'))
  assert.ok(sitemapURLs.includes(canonical))
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length,1)
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'),canonical)
  assert.equal(document.querySelector('meta[property="og:image"]')?.getAttribute('content'),new URL(entry.hero.path,origin).href)
  assert.ok(document.querySelectorAll('time[datetime]').some(time => {
    const date = new Date(time.getAttribute('datetime'))
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === entry.date
  }), 'Article publication calendar day changed: ' + entry.slug)
  assert.ok(document.text.includes('دقیقه مطالعه'))
  const prose = document.querySelector('#prose')
  assert.ok(prose, 'Server-rendered article text missing')
  assert.ok(document.querySelector('.article-byline')?.text.includes('علیرضا عسگرپور'))
  assert.ok(document.querySelector('progress#reading-progress'))
  assert.ok(document.querySelector('[data-copy-link]'))
  if (entry.categoryId) assert.ok(document.querySelector('a[href="/fa/blog/categories/' + entry.categoryId + '/"]'))
  assert.ok(!document.querySelector('article[hidden]'))
  assert.ok(fs.existsSync(path.join(dist,entry.hero.path)))
  // The migration must preserve every original paragraph, not only its title.
  for (const section of entry.sections) for (const paragraph of section.paragraphs) {
    assert.ok(prose.text.includes(paragraph), 'Article paragraph changed or disappeared: ' + entry.slug)
  }
  const schemas = document.querySelectorAll('script[type="application/ld+json"]').map(element => JSON.parse(element.innerHTML))
  const posting = schemas.find(schema => schema['@type'] === 'BlogPosting')
  assert.equal(posting?.mainEntityOfPage,canonical)
  assert.equal(posting?.inLanguage,'fa')
  assert.equal(posting?.image.url,new URL(entry.hero.path,origin).href)
  assert.deepEqual(schemas.find(schema => schema['@type'] === 'BreadcrumbList')?.itemListElement.map(item => item.position),[1,2,3])
  for (const tag of entry.tags ?? []) {
    const filter = '/fa/blog/tags/' + tag + '/'
    const filteredPage = parseHTML(path.join(dist,filter,'index.html'))
    assert.ok(document.querySelector('a[href="' + filter + '"]'))
    assert.ok(blogDocument.querySelector('a[href="' + filter + '"]'))
    assert.equal(filteredPage.querySelector('body')?.getAttribute('data-garden-page'),filter)
    assert.ok(filteredPage.querySelector('a[href="' + route + '"]'))
    assert.equal(filteredPage.querySelector('link[rel="canonical"]')?.getAttribute('href'),origin + 'fa/blog/')
    assert.equal(filteredPage.querySelector('meta[name="robots"]')?.getAttribute('content'),'noindex, follow')
    assert.ok(!sitemapURLs.includes(new URL(filter,origin).href))
  }
  for (const figure of entry.figures ?? []) {
    assert.ok(document.querySelector('img[src="' + figure.path + '"]'))
    assert.ok(document.querySelector('figure.article-figure figcaption'))
    if (figure.path.startsWith('https:')) {
      assert.equal(new URL(figure.path).origin,'https://arxiv.org')
      assert.ok(!document.querySelector('a[href="' + figure.path + '"]'))
      assert.ok(!article.includes('#page=2'))
    } else assert.ok(fs.existsSync(path.join(dist,figure.path)))
  }
  for (const source of entry.sources ?? []) assert.ok(document.querySelector('a[href="' + source.url + '"]'), 'Article source link missing')
  const image = fs.readFileSync(path.join(dist,entry.hero.path))
  assert.equal(image.toString('ascii',0,4),'RIFF')
  assert.equal(image.toString('ascii',8,12),'WEBP')
}
console.log('Persian blog in Digital Garden, eligible sitemap, original articles/media/schema and reading controls: PASS')
console.log('SEO, language routing, project translations, five official links and ten portfolio pages: PASS')

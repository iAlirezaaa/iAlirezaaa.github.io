import fs from 'node:fs'
import path from 'node:path'
import { entries } from '../public/fa/blog/entries.js'
import { readingStats, visibleEntries } from '../public/fa/blog/reader-model.js'

const blogRoot = 'https://ialirezaaa.github.io/fa/blog/'
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {timeZone:'UTC', dateStyle:'long'})
const numbers = new Intl.NumberFormat('fa-IR')

function metadata(entry) {
  const { words, minutes } = readingStats(entry)
  const date = persianDate.format(new Date(entry.date + 'T12:00:00Z'))
  return (entry.category ? '<span class="category">' + esc(entry.category) + '</span> · ' : '') + '<time datetime="' + entry.date + '">' + esc(date) + '</time> · ' + numbers.format(minutes) + ' دقیقه مطالعه · ' + numbers.format(words) + ' واژه'
}

function image(entry, card) {
  const { width, height, path: src, alt } = entry.hero
  return '<img width="' + width + '" height="' + height + '" src="' + esc(src) + '" alt="' + (card ? '' : esc(alt)) + '" decoding="async"' + (card ? ' loading="lazy"' : ' fetchpriority="high"') + '>'
}

function validatedEntries(folder) {
  const approved = visibleEntries(entries)
  if (approved.length !== entries.length || new Set(approved.map(entry => entry.slug)).size !== approved.length) throw new Error('Invalid or duplicate Persian blog entry')
  for (const entry of approved) {
    const hero = entry.hero
    const expected = '/fa/blog/media/' + entry.slug + '.webp'
    if (!hero || hero.path !== expected || !Number.isInteger(hero.width) || hero.width < 1 || !Number.isInteger(hero.height) || hero.height < 1 || typeof hero.alt !== 'string' || !hero.alt.trim()) throw new Error('Invalid blog cover for ' + entry.slug)
    if (!fs.existsSync(path.join(folder, 'media', entry.slug + '.webp'))) throw new Error('Missing blog cover: ' + entry.slug)
    for (const source of entry.sources ?? []) {
      if (typeof source.title !== 'string' || !source.title.trim() || !new URL(source.url).href.startsWith('https://')) throw new Error('Invalid blog citation: ' + entry.slug)
    }
  }
  return approved
}

export function renderBlog(dist) {
  const folder = path.join(dist, 'fa', 'blog')
  const entryFile = path.join(folder, 'index.html')
  const shell = fs.readFileSync(entryFile, 'utf8')
  const approved = validatedEntries(folder)
  const sourcePaths = []
  let index = shell
  if (approved.length) {
    const cards = approved.map(entry => '<li><a class="post-card" href="/fa/blog/' + entry.slug + '/">' + image(entry, true) + '<div><h3>' + esc(entry.title) + '</h3><p>' + esc(entry.description) + '</p><p class="article-meta">' + metadata(entry) + '</p></div></a></li>')
    index = index.replace(/<p id="empty">[^<]*<\/p>\s*<ul id="list" hidden><\/ul>/, () => '<ul id="list">' + cards.join('') + '</ul>')
  }
  fs.writeFileSync(entryFile, index)
  for (const entry of approved) {
    const url = blogRoot + entry.slug + '/'
    const title = entry.title + ' | وبلاگ هادس'
    const heroUrl = new URL(entry.hero.path, url).href
    const toc = entry.sections.flatMap((section, i) => section.title ? ['<li><a href="#section-' + (i + 1) + '">' + esc(section.title) + '</a></li>'] : [])
    const prose = entry.sections.map((section, i) => (section.title ? '<h2 id="section-' + (i + 1) + '" tabindex="-1">' + esc(section.title) + '</h2>' : '') + section.paragraphs.map(p => '<p>' + esc(p) + '</p>').join('') + (Number.isInteger(section.relatedSource) && entry.sources?.[section.relatedSource] ? '<p class="inline-source"><a href="' + esc(entry.sources[section.relatedSource].url) + '">دیدن شکل ۲ مقاله ↗</a></p>' : '')).join('')
    const sources = entry.sources?.length ? '<section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">برای بیشتر خوندن</h2><ul>' + entry.sources.map(source => '<li><a href="' + esc(source.url) + '"><bdi>' + esc(source.title) + '</bdi></a></li>').join('') + '</ul></section>' : ''
    const article = shell.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(title) + '</title>')
      .replace(/(<meta name="description" content=")[^"]*/, (_, start) => start + esc(entry.description))
      .replace(/(<meta property="og:type" content=")website/, '$1article')
      .replace(/(<meta property="og:title" content=")[^"]*/, (_, start) => start + esc(title))
      .replace(/(<meta property="og:description" content=")[^"]*/, (_, start) => start + esc(entry.description))
      .replace(/(<meta property="og:url" content=")[^"]*/, (_, start) => start + url)
      .replace(/(<link rel="canonical" href=")[^"]*/, (_, start) => start + url)
      .replace('</head>', () => '<meta property="og:image" content="' + esc(heroUrl) + '">\n  <meta property="og:image:width" content="' + entry.hero.width + '">\n  <meta property="og:image:height" content="' + entry.hero.height + '">\n  <meta property="og:image:alt" content="' + esc(entry.hero.alt) + '">\n  <meta property="article:published_time" content="' + entry.date + '">\n</head>')
      .replace('<a href="/fa/blog/" aria-current="page">', '<a href="/fa/blog/">')
      .replace('<main class="shell" id="content"', '<main class="shell article-page" id="content"')
      .replace(/<h1 id="page-title">[\s\S]*?<\/header>/, () => '<h1 id="page-title">' + esc(entry.title) + '</h1><p class="article-deck reader">' + esc(entry.description) + '</p>')
      .replace(/    <section class="posts reader"[\s\S]*?<\/section>/, '')
      .replace('<article class="reader" id="article" hidden>', '<article class="reader" id="article" aria-labelledby="page-title">')
      .replace('<p class="article-meta" id="article-meta"></p>', () => '<p class="article-meta" id="article-meta">' + metadata(entry) + '</p><figure class="hero">' + image(entry, false) + '</figure>')
      .replace(/<nav class="toc"[\s\S]*?<\/nav>/, () => toc.length > 1 ? '<nav class="toc" aria-label="فهرست بخش‌های نوشته"><strong>در این نوشته</strong><ol>' + toc.join('') + '</ol></nav>' : '')
      .replace('<div id="prose"></div>', () => '<div id="prose">' + prose + '</div>' + sources)
    const out = path.join(folder, entry.slug)
    fs.mkdirSync(out, { recursive:true })
    fs.writeFileSync(path.join(out, 'index.html'), article)
    sourcePaths.push({url, date:entry.date})
  }
  return sourcePaths
}

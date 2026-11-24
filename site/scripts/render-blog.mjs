import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { entries } from '../public/fa/blog/entries.js'
import { readingStats, visibleEntries } from '../public/fa/blog/reader-model.js'

const blogRoot = 'https://ialirezaaa.github.io/fa/blog/'
const ddpmFigure = 'https://arxiv.org/html/2006.11239v2/pgm_diagram_xarrow_small.png'
export const topicNames = {'ai-basics':'پایه‌های هوش مصنوعی',diffusion:'دیفیوژن','ai-image-making':'تصویرسازی با هوش مصنوعی','paper-explainer':'شرح مقاله'}
export const categories = {
  papers:{name:'شرح مقاله‌های هوش مصنوعی',description:'ایدهٔ اصلی پژوهش‌ها، به زبان ساده و همراه با شکل‌ها و مثال‌های کاربردی.'},
  'repo-analysis':{name:'تحلیل ریپوها',description:'سر زدن به کد و مستندات ابزارهای متن‌باز، برای اینکه ببینیم چطور کار می‌کنند و کجا به درد می‌خورند.'},
  fundamentals:{name:'پایه‌های هوش مصنوعی',description:'مفهوم‌های پایه با مثال‌هایی که از دل کارِ ساخت تصویر و انیمیشن می‌آیند.'},
}
const categoryPath = slug => '/fa/blog/categories/' + slug + '/'
const markNav = (html, target) => html.replace(' href="/fa/blog/" aria-current="page"', ' href="/fa/blog/"').replace(' href="' + target + '"', ' href="' + target + '" aria-current="page"')
const pageHead = (html, title, description, url, noindex = false) => html
  .replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(title) + ' | وبلاگ هادس</title>')
  .replace(/(<meta name="description" content=")[^"]*/, (_, start) => start + esc(description))
  .replace(/(<meta property="og:title" content=")[^"]*/, (_, start) => start + esc(title + ' | وبلاگ هادس'))
  .replace(/(<meta property="og:description" content=")[^"]*/, (_, start) => start + esc(description))
  .replace(/(<meta property="og:url" content=")[^"]*/, (_, start) => start + url)
  .replace(/(<link rel="canonical" href=")[^"]*/, (_, start) => start + url)
  .replace(/(<meta name="robots" content=")[^"]*/, (_, start) => start + (noindex ? 'noindex, follow' : 'index, follow'))
const topicPath = slug => '/fa/blog/tags/' + slug + '/'
const topicLinks = (items = [], current, all = false) => items.length ? '<nav class="topic-nav" aria-label="موضوع‌های وبلاگ"><ul>' + (all ? '<li><a href="/fa/blog/"' + (current ? '' : ' aria-current="page"') + '>همهٔ نوشته‌ها</a></li>' : '') + items.map(id => '<li><a href="' + topicPath(id) + '"' + (current === id ? ' aria-current="page"' : '') + '>' + esc(topicNames[id]) + '</a></li>').join('') + '</ul></nav>' : ''
const safeJSON = item => JSON.stringify(item).replaceAll('<', '\\u003c')
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {timeZone:'UTC', dateStyle:'long'})
const numbers = new Intl.NumberFormat('fa-IR')

function metadata(entry) {
  const { words, minutes } = readingStats(entry)
  const date = persianDate.format(new Date(entry.date + 'T12:00:00Z'))
  return (entry.category ? '<span class="category">' + esc(entry.category) + '</span> · ' : '') + '<time datetime="' + entry.date + '">' + esc(date) + '</time> · ' + numbers.format(minutes) + ' دقیقه مطالعه · ' + numbers.format(words) + ' واژه'
}

function image(asset, variant) {
  const {width,height,path:src,alt} = asset
  return '<img width="' + width + '" height="' + height + '" src="' + esc(src) + '" alt="' + (variant === 'card' ? '' : esc(alt)) + '" decoding="async"' + (variant === 'hero' ? ' fetchpriority="high"' : ' loading="lazy"') + '>'
}
function figure(asset, role) {
  const credit = asset.credit ? (asset.sourceUrl ? '<a href="' + esc(asset.sourceUrl) + '">' + esc(asset.credit) + '</a>' : esc(asset.credit)) : ''
  const caption = asset.caption || credit ? '<figcaption>' + esc(asset.caption || '') + (credit ? '<small>' + credit + '</small>' : '') + '</figcaption>' : ''
  const classes = role === 'hero' ? 'hero' : asset.path === ddpmFigure ? 'article-figure paper-original' : 'article-figure'
  return '<figure class="' + classes + '">' + image(asset, role) + caption + '</figure>'
}
function jsonLD(entry, url, heroUrl) {
  const script = value => '<script type="application/ld+json">' + safeJSON(value) + '</script>'
  return script({
    '@context':'https://schema.org','@type':'BlogPosting', mainEntityOfPage:url, '@id':url+'#article',
    headline:entry.title, description:entry.description, inLanguage:'fa', datePublished:entry.date,
    ...(entry.modified ? {dateModified:entry.modified} : {}),
    image:{'@type':'ImageObject',url:heroUrl,width:entry.hero.width,height:entry.hero.height,caption:entry.hero.alt},
    author:{'@type':'Person',name:'علیرضا عسگرپور',url:new URL('/fa/',blogRoot).href,'@id':new URL('/#person',blogRoot).href},
    keywords:(entry.tags || []).map(id => topicNames[id]), wordCount:readingStats(entry).words,
  }) + script({
    '@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement:[['خانه',new URL('/fa/',blogRoot).href],['وبلاگ هادس',blogRoot],[entry.title,url]].map(([name,item],index) => ({'@type':'ListItem',position:index+1,name,item})),
  })
}

function validatedEntries(folder) {
  const approved = visibleEntries(entries)
  if (approved.length !== entries.length || new Set(approved.map(entry => entry.slug)).size !== approved.length) throw new Error('Invalid or duplicate Persian blog entry')
  for (const entry of approved) {
    const hero = entry.hero
    const expected = '/fa/blog/media/' + entry.slug + '.webp'
    if (!hero || hero.path !== expected || !Number.isInteger(hero.width) || hero.width < 1 || !Number.isInteger(hero.height) || hero.height < 1 || typeof hero.alt !== 'string' || !hero.alt.trim()) throw new Error('Invalid blog cover for ' + entry.slug)
    if (!fs.existsSync(path.join(folder, 'media', entry.slug + '.webp'))) throw new Error('Missing blog cover: ' + entry.slug)
    if (entry.categoryId && !Object.hasOwn(categories, entry.categoryId)) throw new Error('Invalid category: ' + entry.slug)
    const ids = entry.tags ?? []
    if (!Array.isArray(ids) || !ids.every(id => Object.hasOwn(topicNames, id)) || new Set(ids).size !== ids.length) throw new Error('Invalid topics: ' + entry.slug)
    for (const asset of entry.figures ?? []) {
      const remote = asset.path === ddpmFigure
      if (!remote && (typeof asset.path !== 'string' || !/^\/fa\/blog\/media\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|png|jpg|svg)$/.test(asset.path))) throw new Error('Invalid article image path')
      if (![asset.width,asset.height].every(n => Number.isInteger(n) && n > 0) || typeof asset.alt !== 'string' || !asset.alt.trim() || typeof asset.caption !== 'string' || !asset.caption.trim() || !Number.isInteger(asset.afterSection) || asset.afterSection < 1 || asset.afterSection > entry.sections.length) throw new Error('Invalid article image metadata')
      if (!remote && !fs.existsSync(path.join(folder, 'media', path.basename(asset.path)))) throw new Error('Missing figure: ' + asset.path)
      if (asset.sourceUrl && new URL(asset.sourceUrl).protocol !== 'https:') throw new Error('Invalid figure source')
    }
    for (const source of entry.sources ?? []) {
      if (typeof source.title !== 'string' || !source.title.trim() || !new URL(source.url).href.startsWith('https://')) throw new Error('Invalid blog citation: ' + entry.slug)
    }
  }
  return approved
}

export function renderBlog(dist) {
  const folder = path.join(dist, 'fa', 'blog')
  const entryFile = path.join(folder, 'index.html')
  const version = files => {
    const hash = createHash('sha256')
    for (const file of files) hash.update(fs.readFileSync(path.join(folder,file)))
    return hash.digest('hex').slice(0,12)
  }
  const shell = fs.readFileSync(entryFile, 'utf8')
    .replace('/fa/blog/reader.css"', '/fa/blog/reader.css?v=' + version(['reader.css']) + '"')
    .replace('/fa/blog/reader.js"', '/fa/blog/reader.js?v=' + version(['reader.js','reader-model.js']) + '"')
  const approved = validatedEntries(folder)
  const sourcePaths = []
  const topics = Object.keys(topicNames).filter(id => approved.some(entry => entry.tags?.includes(id)))
  const today = new Date().toISOString().slice(0,10)
  const empty = text => '<p class="directory-state">' + esc(text) + ' <a href="/fa/blog/">به همهٔ نوشته‌ها برگرد.</a></p>'
  const cards = list => '<ul id="list">' + list.map(entry => '<li>' + (entry.categoryId ? '<a class="card-category" href="' + categoryPath(entry.categoryId) + '">' + esc(categories[entry.categoryId].name) + '</a>' : '') + '<a class="post-card" href="/fa/blog/' + entry.slug + '/">' + image(entry.hero,'card') + '<div><h3>' + esc(entry.title) + '</h3><p>' + esc(entry.description) + '</p><p class="article-meta">' + metadata({...entry,category:null}) + '</p></div></a>' + topicLinks(entry.tags) + '</li>').join('') + '</ul>'
  const replaceList = (html, title, content) => html.replace('<h2 id="posts-title">تازه‌ترین نوشته‌ها</h2>', () => '<h2 id="posts-title">' + esc(title) + '</h2>')
    .replace(/<p id="empty">[^<]*<\/p>\s*<ul id="list" hidden><\/ul>/, () => content)
  const top = (html,title,description) => html.replace(/<header class="intro" id="intro">[\s\S]*?<\/header>/, () => '<header class="intro" id="intro"><p class="eyebrow">وبلاگ هادس</p><h1 id="page-title">' + esc(title) + '</h1><p>' + esc(description) + '</p></header>')
  const writeRoute = (route,html) => {
    const location = path.join(folder, route)
    fs.mkdirSync(location,{recursive:true})
    fs.writeFileSync(path.join(location,'index.html'), html)
  }
  fs.writeFileSync(entryFile, approved.length ? replaceList(shell,'تازه‌ترین نوشته‌ها',cards(approved)) : shell)
  const categoryList = Object.entries(categories).map(([id,cat]) => {
    const count = approved.filter(entry => entry.categoryId === id).length
    return '<li><a href="' + categoryPath(id) + '"><strong>' + esc(cat.name) + '</strong><p>' + esc(cat.description) + '</p><span>' + (count ? numbers.format(count) + ' نوشته' : 'هنوز نوشته‌ای ندارد') + '</span></a></li>'
  }).join('')
  const descriptions = {categories:'نوشته‌ها بر اساس مسیرهای مطالعه: مقالهٔ پژوهشی، تحلیل ریپو یا مفاهیم پایه.',tags:'نوشته‌ها را با برچسب موضوعی پیدا کن، از دیفیوژن تا تصویرسازی با هوش مصنوعی.'}
  for (const [slug,title,list] of [
    ['categories','دسته‌بندی‌ها','<ul class="directory-list">' + categoryList + '</ul>'],
    ['tags','برچسب‌ها',topics.length ? topicLinks(topics) : empty('هنوز هیچ برچسبی ثبت نشده.')],
  ]) {
    const url = blogRoot + slug + '/'
    const page = markNav(pageHead(top(shell,title,descriptions[slug]),title,descriptions[slug],url),'/fa/blog/' + slug + '/')
    writeRoute(slug,replaceList(page, slug === 'tags' ? 'مرور برچسب‌ها' : 'مسیرهای مطالعه', list))
    sourcePaths.push({url, date:today})
  }
  for (const [id,cat] of Object.entries(categories)) {
    const selected = approved.filter(entry => entry.categoryId === id)
    const heading = cat.name
    const url = blogRoot+'categories/'+id+'/'
    const page = markNav(pageHead(top(shell,heading,cat.description),heading,cat.description,url,!selected.length),'/fa/blog/categories/')
    writeRoute('categories/'+id,replaceList(page,'نوشته‌های این دسته',selected.length ? cards(selected) : empty('برای این دسته هنوز نوشته‌ای منتشر نشده.')))
    if (selected.length) sourcePaths.push({url,date:selected[0].modified || selected[0].date})
  }
  for (const id of topics) {
    const selected = approved.filter(entry => entry.tags?.includes(id))
    const label = topicNames[id]
    const description = 'نوشته‌های وبلاگ هادس با برچسب «'+label+'».'
    const page = markNav(pageHead(top(shell,label,description),label,description,blogRoot,true),'/fa/blog/tags/')
    writeRoute('tags/'+id,replaceList(page,'نوشته‌ها / '+label,topicLinks(topics,id,true)+cards(selected)))
  }
  for (const entry of approved) {
    const url = blogRoot + entry.slug + '/'
    const title = entry.title + ' | وبلاگ هادس'
    const heroUrl = new URL(entry.hero.path, url).href
    const toc = entry.sections.flatMap((section, i) => section.title ? ['<li><a href="#section-' + (i + 1) + '">' + esc(section.title) + '</a></li>'] : [])
    const prose = entry.sections.map((section, i) => (section.title ? '<h2 id="section-' + (i + 1) + '" tabindex="-1">' + esc(section.title) + '</h2>' : '') + section.paragraphs.map(p => '<p>' + esc(p) + '</p>').join('') + (entry.figures ?? []).filter(asset => asset.afterSection === i + 1).map(asset => figure(asset, 'inline')).join('')).join('')
    const sources = entry.sources?.length ? '<section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">برای بیشتر خوندن</h2><ul>' + entry.sources.map(source => '<li><a href="' + esc(source.url) + '"><bdi>' + esc(source.title) + '</bdi></a></li>').join('') + '</ul></section>' : ''
    const article = shell.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(title) + '</title>')
      .replace(/(<meta name="description" content=")[^"]*/, (_, start) => start + esc(entry.description))
      .replace(/(<meta property="og:type" content=")website/, '$1article')
      .replace(/(<meta property="og:title" content=")[^"]*/, (_, start) => start + esc(title))
      .replace(/(<meta property="og:description" content=")[^"]*/, (_, start) => start + esc(entry.description))
      .replace(/(<meta property="og:url" content=")[^"]*/, (_, start) => start + url)
      .replace(/(<link rel="canonical" href=")[^"]*/, (_, start) => start + url)
      .replace('</head>', () => jsonLD(entry, url, heroUrl) + '<meta property="og:image" content="' + esc(heroUrl) + '">\n  <meta property="og:image:width" content="' + entry.hero.width + '">\n  <meta property="og:image:height" content="' + entry.hero.height + '">\n  <meta property="og:image:alt" content="' + esc(entry.hero.alt) + '">\n  <meta property="article:published_time" content="' + entry.date + '">\n</head>')
      .replace('<a href="/fa/blog/" aria-current="page">', '<a href="/fa/blog/">')
      .replace('<main class="shell" id="content"', '<main class="shell article-page" id="content"')
      .replace(/<header class="intro" id="intro">[\s\S]*?<\/header>/, () => '<header class="intro" id="intro"><nav class="breadcrumb" aria-label="مسیر نوشته"><a href="/fa/blog/">همهٔ نوشته‌ها</a>' + (entry.categoryId ? '<span aria-hidden="true">/</span><a class="category" href="' + categoryPath(entry.categoryId) + '">' + esc(categories[entry.categoryId].name) + '</a>' : '') + '</nav><h1 id="page-title">' + esc(entry.title) + '</h1><p class="article-deck reader">' + esc(entry.description) + '</p><p class="article-meta" id="article-meta"><span class="article-byline">علیرضا عسگرپور</span> · ' + metadata({...entry,category:null}) + '</p></header>')
      .replace(/    <section class="posts reader"[\s\S]*?<\/section>/, '')
      .replace('<article class="reader" id="article" hidden>', '<article class="reader" id="article" aria-labelledby="page-title">')
      .replace('<div id="article-media"></div>', () => figure(entry.hero, 'hero') + topicLinks(entry.tags))
      .replace(/<nav class="toc"[\s\S]*?<\/nav>/, () => toc.length > 1 ? '<nav class="toc" aria-label="فهرست بخش‌های نوشته"><strong>در این نوشته</strong><ol>' + toc.join('') + '</ol></nav>' : '')
      .replace('<div id="prose"></div>', () => '<div id="prose">' + prose + '</div>' + sources)
    const out = path.join(folder, entry.slug)
    fs.mkdirSync(out, { recursive:true })
    fs.writeFileSync(path.join(out, 'index.html'), article)
    sourcePaths.push({url, date:entry.modified || entry.date})
  }
  return sourcePaths
}

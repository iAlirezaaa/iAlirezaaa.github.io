import { entries } from '../public/fa/blog/entries.js'
import { visibleEntries, readingStats } from '../public/fa/blog/reader-model.js'
import { categories, topicNames, renderBlocks } from './render-blog.mjs'
import { fileURLToPath } from 'node:url'
import { readNotes } from '../../garden/scripts/publishing.mjs'
import { topics, topicGroups, blogCopy, noteTaxonomy, entryTopics, getTopicId } from './blog-taxonomy.mjs'

// Approved articles remain authored in entries.js; the original Digital Garden
// template renders them alongside notes. No duplicate public article sources.
const origin = 'https://ialirezaaa.github.io'
const root = '/fa/blog/'
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c')
const numbers = new Intl.NumberFormat('fa-IR')
const dates = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle:'long', timeZone:'Asia/Tehran' })
const categoryPath = id => root + 'categories/' + id + '/'
const tagPath = id => root + 'tags/' + id + '/'
const articlePath = entry => root + entry.slug + '/'
const tagLinks = tags => '<nav class="garden-tags" aria-label="موضوع‌های این نوشته">' + (tags || []).filter(id => !topics[id]?.legacy).map(id => '<a class="tag internal-link" href="' + tagPath(id) + '">' + esc(topicNames[id] || id) + '</a>').join('') + '</nav>'

function figure(asset, hero = false, index = 0) {
  const remotePaper = asset.path.startsWith('https://arxiv.org/')
  const label = 'تصویر در این نوشته · ' + numbers.format(index)
  const number = hero ? '' : '<span class="figure-index">' + label + '</span>'
  const text = asset.caption ? '<span>' + esc(asset.caption) + '</span>' : ''
  const credit = asset.credit ? '<small>' + (asset.sourceUrl ? '<a href="' + esc(asset.sourceUrl) + '">' + esc(asset.credit) + '</a>' : esc(asset.credit)) + '</small>' : ''
  const canOpen = !hero && (asset.path.startsWith('/fa/blog/media/') || remotePaper)
  const open = canOpen ? '<a class="figure-open" href="' + esc(asset.path) + '" aria-label="نمایش ' + label + ' در اندازهٔ اصلی">نمایش در اندازهٔ اصلی</a>' : ''
  const caption = number || text || credit || open ? '<figcaption>' + number + text + credit + open + '</figcaption>' : ''
  return '<figure class="' + (hero ? 'hero ' : '') + 'article-figure' + (remotePaper ? ' paper-original' : '') + '"><img src="' + esc(asset.path) + '" alt="' + esc(asset.alt) + '" width="' + asset.width + '" height="' + asset.height + '" decoding="async" ' + (hero ? 'fetchpriority="high"' : 'loading="lazy"') + '>' + caption + '</figure>'
}

// Directory entries are plain links. Finding a specific term belongs to the
// single shared search; the landing page does not repeat it as a filter form.
function cards(list) {
  if (!list.length) return '<p class="directory-state">هنوز مقاله‌ای در این بخش منتشر نشده. <a href="/fa/blog/">بازگشت به شروع</a></p>'
  return '<ul class="garden-post-list" data-content-list="articles">' + list.map(entry => {
    const date = dates.format(new Date(entry.date + 'T12:00:00Z'))
    return '<li data-content-item data-kind="article"><img class="garden-post-cover" src="' + esc(entry.hero.path) + '" width="' + entry.hero.width + '" height="' + entry.hero.height + '" alt="" loading="lazy" decoding="async"><div class="post-card-copy"><h3><a class="internal-link" href="' + articlePath(entry) + '">' + esc(entry.title) + '</a></h3><p class="post-card-summary">' + esc(entry.description) + '</p><p class="post-card-meta"><time datetime="' + entry.date + '">' + date + '</time><span>' + numbers.format(readingStats(entry).minutes) + ' دقیقه مطالعه</span></p></div></li>'
  }).join('') + '</ul>'
}

function publishedNotes() {
  return readNotes(fileURLToPath(new URL('../../garden/src/site/notes/', import.meta.url))).filter(item => !item.frontmatter.hide && !item.frontmatter['dg-hide']).map(item => {
    const data = item.frontmatter
    const taxonomy = noteTaxonomy[data.id] || { kind: data.kind || 'concept', categoryId: data.categoryId || 'fundamentals', topics: (data.tags || []).map(getTopicId).filter(Boolean) }
    const words = item.content.replace(/<[^>]*>|[#*_`]/g, '').trim().split(/\s+/u).filter(Boolean).length
    const date = data.updated || data.created || ''
    return { ...taxonomy, title: item.title, description: data.description, url: data.permalink, aliases: item.aliases, minutes: Math.max(1, Math.ceil(words / 190)), date: date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10) }
  })
}

function noteCards(list) {
  return '<ul class="knowledge-note-list" data-content-list="notes">' + list.map(item => '<li data-content-item data-kind="note"><h3><a class="internal-link" href="' + esc(item.url) + '">' + esc(item.title) + '</a></h3><p>' + esc(item.description) + '</p><span class="knowledge-card-meta">' + numbers.format(item.minutes) + ' دقیقه مطالعه</span></li>').join('') + '</ul>'
}

function knowledgeSection(list) {
  if (!list.length) return ''
  return '<section class="blog-knowledge-index" id="notes" aria-labelledby="blog-knowledge-title"><h2 id="blog-knowledge-title">یادداشت‌ها</h2>' + noteCards(list) + '</section>'
}

function note(fileName, title, permalink, description, content, extra = {}) {
  return {
    fileName,
    frontmatter: {
      title, description, permalink,
      'dg-publish': true, public: true,
      tags: ['note'], group:'نوشته‌ها',
      dgShowInlineTitle:true, dgShowTags:false,
      canonical:origin + permalink,
      metatags:{description,'og:title':title + ' | هادس','og:description':description,'og:locale':'fa_IR','og:type':'website',robots:'index, follow'},
      ...extra,
    },
    content,
  }
}

function articleContent(entry) {
  let figureIndex = 0
  const sections = entry.sections.map((section,i) => (section.title ? '<h2 id="section-' + (i + 1) + '" tabindex="-1">' + esc(section.title) + '</h2>' : '') + (section.blocks ? renderBlocks(section.blocks, section.title) : (section.paragraphs || []).map(p => '<p>' + esc(p) + '</p>').join('\n')) + (entry.figures || []).filter(f => f.afterSection === i + 1).map(f => figure(f, false, ++figureIndex)).join('\n')).join('\n\n')
  const sources = entry.sources?.length ? '<section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">منابع و مطالعهٔ بیشتر</h2><ul>' + entry.sources.map(s => '<li><a href="' + esc(s.url) + '"><bdi>' + esc(s.title) + '</bdi></a></li>').join('') + '</ul></section>' : ''
  const related = entry.tags?.includes('diffusion') ? '\n\n## برای ادامهٔ این موضوع\n\nبرای دنبال‌کردن مفهوم‌ها، از [[diffusion|دیفیوژن]] به [[noise|نویز]]، [[ddpm|DDPM]]، [[latent-diffusion|فضای نهفته]] و [[seed|بذر تصادفی]] سر بزن.\n\n' : '\n\n[مرور یادداشت‌های مرتبط](/fa/blog/#notes)\n\n'
  const stats = readingStats(entry)
  const schema = {
    '@context':'https://schema.org','@type':'BlogPosting','@id':origin + articlePath(entry) + '#article',mainEntityOfPage:origin + articlePath(entry),
    headline:entry.title,description:entry.description,inLanguage:'fa',datePublished:entry.date,dateModified:entry.modified || entry.date,
    image:{'@type':'ImageObject',url:origin + entry.hero.path,width:entry.hero.width,height:entry.hero.height,caption:entry.hero.alt},
    author:{'@type':'Person',name:'علیرضا عسگرپور',url:origin + '/fa/','@id':origin + '/#person'},
    keywords:entryTopics(entry).map(t => topicNames[t] || t),wordCount:stats.words,
  }
  const breadcrumbSchema = {
    '@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement:[['خانه',origin+'/fa/'],['وبلاگ هادس',origin+root],[entry.title,origin+articlePath(entry)]].map(([name,item],index) => ({'@type':'ListItem',position:index+1,name,item})),
  }
  return [figure(entry.hero,true), tagLinks(entryTopics(entry)), '<div class="article-prose">\n' + sections + '\n</div>', sources, related, '<script type="application/ld+json">' + json(schema) + '</script>', '<script type="application/ld+json">' + json(breadcrumbSchema) + '</script>'].join('\n\n')
}

export function getBlogGardenNotes() {
  const approved = visibleEntries(entries)
  const notes = publishedNotes()
  const activeTags = Object.keys(topics).filter(id => approved.some(e => entryTopics(e, {includeLegacy:true}).includes(id)) || notes.some(n => n.topics.includes(id)))
  const publicTopics = activeTags.filter(id => !topics[id].legacy)
  const directories = {group:blogCopy.categories.title,'dg-hide':true,contentClasses:'blog-directory',dgShowLocalGraph:true,dgShowBacklinks:false}
  const introduction = '<div class="blog-start-intro" id="notes"><section aria-labelledby="wiki-subjects"><h2 class="blog-index-section-title" id="wiki-subjects">دانش‌نامه</h2><p class="start-links">از <a class="internal-link" href="/fa/blog/notes/cinema/">سینما</a> برای فهم زبان فیلم، از <a class="internal-link" href="/fa/blog/notes/animation/">انیمیشن</a> برای یادگیری حرکت و تولید، یا از <a class="internal-link" href="/fa/blog/notes/artificial-intelligence/">هوش مصنوعی</a> برای فهم مدل‌ها و ابزارهای ساخت شروع کن.</p></section></div>'
  const indexContent = introduction + '<section class="blog-latest" aria-labelledby="articles"><h2 class="blog-index-section-title" id="articles">تازه‌ترین نوشته‌ها</h2>' + cards(approved) + '</section>'
  const records = [note('نوشته‌ها/همهٔ نوشته‌ها.md','از اینجا شروع کن',root,'دانش‌نامهٔ فارسی هادس برای یادگیری سینما، انیمیشن و هوش مصنوعی.',indexContent,{...directories,blogIndex:true,group:'شروع'})]

  const categoryCards = '<ul class="garden-category-list">' + Object.entries(categories).map(([id,cat]) => {
    const articleCount = approved.filter(e => e.categoryId === id).length
    const noteCount = notes.filter(n => n.categoryId === id).length
    return '<li><a class="internal-link" href="' + categoryPath(id) + '"><span class="directory-prompt">' + esc(cat.prompt) + '</span><h2>' + esc(cat.name) + '</h2><p>' + esc(cat.description) + '</p><span class="directory-count">' + numbers.format(articleCount) + ' مقاله · ' + numbers.format(noteCount) + ' یادداشت</span></a></li>'
  }).join('') + '</ul>'
  records.push(note('راهنماها/دسته‌بندی‌ها.md',blogCopy.categories.title,root+'categories/',blogCopy.categories.description,categoryCards,directories))
  const topicDirectory = topicGroups.map(group => '<section class="topic-group" aria-labelledby="topic-group-' + group.id + '"><h2 id="topic-group-' + group.id + '">' + esc(group.name) + '</h2><ul class="topic-directory-grid">' + publicTopics.filter(id => topics[id].group === group.id).map(id => {
    const count = approved.filter(e => entryTopics(e).includes(id)).length + notes.filter(n => n.topics.includes(id)).length
    return '<li><a class="internal-link" href="' + tagPath(id) + '"><h3>' + esc(topicNames[id]) + '</h3><p>' + esc(topics[id].description) + '</p><span>' + numbers.format(count) + ' نوشته</span></a></li>'
  }).join('') + '</ul></section>').join('')
  records.push(note('راهنماها/برچسب‌ها.md',blogCopy.topics.title,root+'tags/',blogCopy.topics.description,topicDirectory,{...directories,group:blogCopy.topics.title}))

  for (const [id,cat] of Object.entries(categories)) {
    const list = approved.filter(e => e.categoryId === id)
    const matchingNotes = notes.filter(n => n.categoryId === id)
    const robots = list.length || matchingNotes.length ? 'index, follow' : 'noindex, follow'
    records.push(note('راهنماها/دسته‌ها/'+id+'.md',cat.name,categoryPath(id),cat.description,'<h2 class="blog-index-section-title" id="articles">مقاله‌ها</h2>' + cards(list) + knowledgeSection(matchingNotes),{...directories,robots,metatags:{description:cat.description,robots}}))
  }
  for (const id of activeTags) {
    const title = topicNames[id]
    const description = topics[id].description
    const content = '<h2 class="blog-index-section-title" id="articles">مقاله‌ها</h2>' + cards(approved.filter(e => entryTopics(e,{includeLegacy:true}).includes(id))) + knowledgeSection(notes.filter(n => n.topics.includes(id)))
    records.push(note('راهنماها/برچسب‌ها/'+id+'.md',title,tagPath(id),description,content,{...directories,canonical:origin+root,robots:'noindex, follow',metatags:{description,robots:'noindex, follow'}}))
  }
  for (const entry of approved) {
    const stats = readingStats(entry)
    records.push(note('نوشته‌ها/'+entry.slug+'.md',entry.title,articlePath(entry),entry.description,articleContent(entry),{
      tags:['note',...entryTopics(entry).map(tag => topicNames[tag] || tag)],date:entry.date,created:entry.date,updated:entry.modified || entry.date,
      kind:'article',readingMinutes:stats.minutes,wordCount:stats.words,
      contentClasses:'blog-article',categoryLabel:categories[entry.categoryId]?.name || '',categoryURL:entry.categoryId ? categoryPath(entry.categoryId) : '',group:'مقاله‌ها',
      metatags:{description:entry.description,'og:type':'article','og:locale':'fa_IR','og:title':entry.title,'og:description':entry.description,'og:image':origin+entry.hero.path,'og:image:width':String(entry.hero.width),'og:image:height':String(entry.hero.height),'og:image:alt':entry.hero.alt,'article:published_time':entry.date,robots:'index, follow'},
    }))
  }
  return records
}

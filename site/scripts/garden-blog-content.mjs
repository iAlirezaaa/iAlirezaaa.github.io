import { entries } from '../public/fa/blog/entries.js'
import { visibleEntries, readingStats } from '../public/fa/blog/reader-model.js'
import { categories, topicNames, renderBlocks } from './render-blog.mjs'
import { fileURLToPath } from 'node:url'
import { readNotes } from '../../garden/scripts/publishing.mjs'
import { topics, topicGroups, blogCopy, noteTaxonomy, noteKinds, entryTopics, getTopicId } from './blog-taxonomy.mjs'

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

function discoveryAttributes({ title, description, categoryId, tags, date, minutes, kind, aliases = [] }) {
  const vocabulary = tags.flatMap(id => [id, topics[id]?.name, ...(topics[id]?.aliases || [])])
  return ' data-explorer-item data-kind="' + kind + '" data-category="' + esc(categoryId) + '" data-topics="' + esc(tags.join(' ')) + '" data-date="' + esc(date || '') + '" data-minutes="' + minutes + '" data-title="' + esc(title) + '" data-search="' + esc([title, description, categories[categoryId]?.name, ...vocabulary, ...aliases].filter(Boolean).join(' ')) + '"'
}

function cards(list, editorial = false) {
  if (!list.length) return '<p class="directory-state">هنوز مقاله‌ای در این بخش منتشر نشده. <a href="/fa/blog/">مرور همهٔ نوشته‌ها</a></p>'
  return '<ul class="garden-post-list garden-post-list--editorial' + (editorial ? '' : ' garden-post-list--archive') + '" data-explorer-list="articles">' + list.map((entry, index) => {
    const tags = entryTopics(entry)
    const featured = editorial && index === 0
    const attrs = discoveryAttributes({ ...entry, tags, kind: 'article', minutes: readingStats(entry).minutes })
    const date = dates.format(new Date(entry.date + 'T12:00:00Z'))
    return '<li' + (featured ? ' class="is-featured"' : '') + attrs + '><a class="garden-post-cover internal-link" aria-label="خواندن: ' + esc(entry.title) + '" href="' + articlePath(entry) + '"><img src="' + esc(entry.hero.path) + '" alt="" width="' + entry.hero.width + '" height="' + entry.hero.height + '" decoding="async" ' + (featured ? 'fetchpriority="high"' : 'loading="lazy"') + '></a><div class="post-card-copy"><div class="post-card-eyebrow">' + (featured ? '<span class="editorial-kicker">' + blogCopy.index.featured + '</span>' : '') + '<a class="garden-post-category internal-link" href="' + categoryPath(entry.categoryId) + '">' + esc(categories[entry.categoryId]?.name || entry.category) + '</a></div><h3><a class="internal-link" href="' + articlePath(entry) + '">' + esc(entry.title) + '</a></h3><p class="post-card-summary">' + esc(entry.description) + '</p>' + tagLinks(tags) + '<p class="post-card-meta"><time datetime="' + entry.date + '">' + date + '</time><span>' + numbers.format(readingStats(entry).minutes) + ' دقیقه مطالعه</span></p></div></li>'
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
  return '<ul class="blog-knowledge-grid" data-explorer-list="notes">' + list.map(item => '<li' + discoveryAttributes({ ...item, tags: item.topics, kind: 'note' }) + '><a class="internal-link" href="' + esc(item.url) + '"><span class="knowledge-card-kind">' + esc(noteKinds[item.kind] || noteKinds.concept) + '</span><h3>' + esc(item.title) + '</h3><p>' + esc(item.description) + '</p><span class="knowledge-card-meta">' + numbers.format(item.minutes) + ' دقیقه مطالعه</span></a></li>').join('') + '</ul>'
}

function knowledgeSection(list, index = false) {
  if (!list.length) return ''
  return '<section class="blog-knowledge-index" id="notes" data-explorer-section="notes" aria-labelledby="blog-knowledge-title"><header class="blog-knowledge-heading"><div><p class="editorial-kicker">برای عمیق‌تر خواندن</p><h2 id="blog-knowledge-title">' + blogCopy.notes.title + '</h2></div>' + (index ? '<button type="button" data-global-graph-open>' + blogCopy.graph + '</button>' : '') + '</header><p>' + blogCopy.notes.description + '</p>' + noteCards(list) + '</section>'
}

function explorerControls(activeTopics) {
  const options = (items, empty) => '<option value="">' + empty + '</option>' + items.map(([id, label]) => '<option value="' + esc(id) + '">' + esc(label) + '</option>').join('')
  return '<form class="blog-explorer" data-blog-explorer hidden aria-label="پیدا کردن نوشته" role="search"><div class="explorer-search"><label for="blog-query">' + blogCopy.filters.searchLabel + '</label><input id="blog-query" name="q" type="search" autocomplete="off" placeholder="' + blogCopy.filters.searchPlaceholder + '" aria-controls="blog-results" dir="auto"></div><details class="explorer-options"><summary>فیلتر و ترتیب نمایش<span aria-hidden="true">⌄</span></summary><div class="explorer-fields"><label for="blog-kind">نوع نوشته<select id="blog-kind" name="kind"><option value="">مقاله و یادداشت</option><option value="article">مقاله‌ها</option><option value="note">یادداشت‌ها و مسیرها</option></select></label><label for="blog-category">بخش وبلاگ<select id="blog-category" name="category">' + options(Object.entries(categories).map(([id, value]) => [id, value.name]), blogCopy.categories.all) + '</select></label><label for="blog-topic">موضوع<select id="blog-topic" name="topic">' + options(activeTopics.map(id => [id, topicNames[id]]), blogCopy.topics.all) + '</select></label><label for="blog-sort">ترتیب نمایش<select id="blog-sort" name="sort"><option value="newest">تازه‌ترین</option><option value="shortest">مطالعهٔ کوتاه‌تر</option><option value="title">عنوان، از الف تا ی</option></select></label></div></details><div class="explorer-status"><p role="status" aria-live="polite" aria-atomic="true" data-explorer-count></p><button type="reset">' + blogCopy.filters.reset + '</button></div></form><noscript><style>.blog-explorer[hidden]{display:none!important}</style><p class="directory-state">همهٔ نوشته‌ها در ادامه در دسترس‌اند. برای انتخاب موضوع، از <a href="/fa/blog/tags/">فهرست موضوع‌ها</a> استفاده کن.</p></noscript>'
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
  const directories = {group:blogCopy.categories.title,'dg-hide':true,contentClasses:'blog-directory',dgShowLocalGraph:false,dgShowBacklinks:false}
  const summary = '<p class="blog-index-overview"><span>' + numbers.format(approved.length) + ' مقاله</span><span>' + numbers.format(notes.length) + ' یادداشت و مسیر</span><span>علیرضا عسگرپور</span></p>'

  const indexContent = '<div class="blog-discovery-intro">' + summary + '</div>' + explorerControls(publicTopics) + '<div id="blog-results"><section data-explorer-section="articles" aria-labelledby="articles"><h2 class="blog-index-section-title" id="articles">مقاله‌ها</h2>' + cards(approved,true) + '</section>' + knowledgeSection(notes,true) + '<section class="explorer-empty" data-explorer-empty hidden><h2>' + blogCopy.filters.emptyTitle + '</h2><p>' + blogCopy.filters.emptyDescription + '</p><button type="button" data-explorer-reset>نمایش همهٔ نوشته‌ها</button></section></div>'
  const records = [note('نوشته‌ها/همهٔ نوشته‌ها.md',blogCopy.index.title,root,blogCopy.index.description,indexContent,{...directories,blogIndex:true,group:'همهٔ نوشته‌ها'})]

  const categoryCards = '<ul class="garden-category-list">' + Object.entries(categories).map(([id,cat]) => {
    const articleCount = approved.filter(e => e.categoryId === id).length
    const noteCount = notes.filter(n => n.categoryId === id).length
    return '<li><a class="internal-link" href="' + categoryPath(id) + '"><span class="directory-prompt">' + esc(cat.prompt) + '</span><h2>' + esc(cat.name) + '</h2><p>' + esc(cat.description) + '</p><span class="directory-count">' + numbers.format(articleCount) + ' مقاله · ' + numbers.format(noteCount) + ' یادداشت</span></a></li>'
  }).join('') + '</ul>'
  const directoryNav = '<nav class="garden-directory-nav" aria-label="مرور وبلاگ"><a href="/fa/blog/">همهٔ نوشته‌ها</a><a href="/fa/blog/categories/">بخش‌های وبلاگ</a><a href="/fa/blog/tags/">موضوع‌ها</a></nav>'
  records.push(note('راهنماها/دسته‌بندی‌ها.md',blogCopy.categories.title,root+'categories/',blogCopy.categories.description,directoryNav + categoryCards,directories))
  const topicDirectory = topicGroups.map(group => '<section class="topic-group" aria-labelledby="topic-group-' + group.id + '"><h2 id="topic-group-' + group.id + '">' + esc(group.name) + '</h2><ul class="topic-directory-grid">' + publicTopics.filter(id => topics[id].group === group.id).map(id => {
    const count = approved.filter(e => entryTopics(e).includes(id)).length + notes.filter(n => n.topics.includes(id)).length
    return '<li><a class="internal-link" href="' + tagPath(id) + '"><h3>' + esc(topicNames[id]) + '</h3><p>' + esc(topics[id].description) + '</p><span>' + numbers.format(count) + ' نوشته</span></a></li>'
  }).join('') + '</ul></section>').join('')
  records.push(note('راهنماها/برچسب‌ها.md',blogCopy.topics.title,root+'tags/',blogCopy.topics.description,directoryNav + topicDirectory,{...directories,group:blogCopy.topics.title}))

  for (const [id,cat] of Object.entries(categories)) {
    const list = approved.filter(e => e.categoryId === id)
    const matchingNotes = notes.filter(n => n.categoryId === id)
    const robots = list.length || matchingNotes.length ? 'index, follow' : 'noindex, follow'
    records.push(note('راهنماها/دسته‌ها/'+id+'.md',cat.name,categoryPath(id),cat.description,directoryNav + '<h2 class="blog-index-section-title" id="articles">مقاله‌ها</h2>' + cards(list) + knowledgeSection(matchingNotes),{...directories,robots,metatags:{description:cat.description,robots}}))
  }
  for (const id of activeTags) {
    const title = topicNames[id]
    const description = topics[id].description
    const content = directoryNav + '<h2 class="blog-index-section-title" id="articles">مقاله‌ها</h2>' + cards(approved.filter(e => entryTopics(e,{includeLegacy:true}).includes(id))) + knowledgeSection(notes.filter(n => n.topics.includes(id)))
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

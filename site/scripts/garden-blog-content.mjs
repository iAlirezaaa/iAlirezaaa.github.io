import { entries } from '../public/fa/blog/entries.js'
import { visibleEntries, readingStats } from '../public/fa/blog/reader-model.js'
import { categories, topicNames, renderBlocks } from './render-blog.mjs'

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
const tagLinks = tags => '<nav class="garden-tags" aria-label="برچسب‌های نوشته">' + (tags || []).map(id => '<a class="tag internal-link" href="' + tagPath(id) + '">' + esc(topicNames[id] || id) + '</a>').join('') + '</nav>'

function figure(asset, hero = false) {
  const remotePaper = asset.path.startsWith('https://arxiv.org/')
  const caption = asset.caption ? '<figcaption>' + esc(asset.caption) + (asset.credit ? '<small>' + (asset.sourceUrl ? '<a href="' + esc(asset.sourceUrl) + '">' + esc(asset.credit) + '</a>' : esc(asset.credit)) + '</small>' : '') + '</figcaption>' : ''
  return '<figure class="' + (hero ? 'hero ' : '') + 'article-figure' + (remotePaper ? ' paper-original' : '') + '"><img src="' + esc(asset.path) + '" alt="' + esc(asset.alt) + '" width="' + asset.width + '" height="' + asset.height + '" decoding="async" ' + (hero ? 'fetchpriority="high"' : 'loading="lazy"') + '>' + caption + '</figure>'
}

function meta(entry) {
  const stats = readingStats(entry)
  const date = dates.format(new Date(entry.date + 'T12:00:00Z'))
  return '<p class="article-meta"><span class="article-byline">علیرضا عسگرپور</span><span aria-hidden="true"> · </span><time datetime="' + entry.date + '">' + date + '</time><span aria-hidden="true"> · </span><span>' + numbers.format(stats.minutes) + ' دقیقه مطالعه</span><span aria-hidden="true"> · </span><span>' + numbers.format(stats.words) + ' واژه</span></p>'
}

function cards(list) {
  if (!list.length) return '<p class="directory-state">هنوز نوشته‌ای در این بخش منتشر نشده. <a href="/fa/blog/">دیدن همهٔ نوشته‌ها</a></p>'
  return '<ul class="garden-post-list">' + list.map(entry => '<li><a class="garden-post-cover internal-link" href="' + articlePath(entry) + '"><img src="' + esc(entry.hero.path) + '" alt="" width="' + entry.hero.width + '" height="' + entry.hero.height + '" loading="lazy"></a><div>' + (entry.categoryId ? '<a class="garden-post-category internal-link" href="' + categoryPath(entry.categoryId) + '">' + esc(categories[entry.categoryId]?.name || entry.category) + '</a>' : '') + '<h2><a class="internal-link" href="' + articlePath(entry) + '">' + esc(entry.title) + '</a></h2><p>' + esc(entry.description) + '</p>' + meta(entry) + tagLinks(entry.tags) + '</div></li>').join('') + '</ul>'
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
  const sections = entry.sections.map((section,i) => (section.title ? '<h2 id="section-' + (i + 1) + '" tabindex="-1">' + esc(section.title) + '</h2>' : '') + (section.blocks ? renderBlocks(section.blocks, section.title) : (section.paragraphs || []).map(p => '<p>' + esc(p) + '</p>').join('\n')) + (entry.figures || []).filter(f => f.afterSection === i + 1).map(f => figure(f)).join('\n')).join('\n\n')
  const sources = entry.sources?.length ? '<section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">برای بیشتر خوندن</h2><ul>' + entry.sources.map(s => '<li><a href="' + esc(s.url) + '"><bdi>' + esc(s.title) + '</bdi></a></li>').join('') + '</ul></section>' : ''
  const related = entry.tags?.includes('diffusion') ? '\n\n## پیوندهای این نوشته\n\nبرای دنبال‌کردن مفهوم‌ها، از [[diffusion|دیفیوژن]] به [[noise|نویز]]، [[ddpm|DDPM]]، [[latent-diffusion|فضای نهفته]] و [[seed|بذر تصادفی]] سر بزن.\n\n' : '\n\n[مرور یادداشت‌های مرتبط](/fa/garden/)\n\n'
  const stats = readingStats(entry)
  const schema = {
    '@context':'https://schema.org','@type':'BlogPosting','@id':origin + articlePath(entry) + '#article',mainEntityOfPage:origin + articlePath(entry),
    headline:entry.title,description:entry.description,inLanguage:'fa',datePublished:entry.date,dateModified:entry.modified || entry.date,
    image:{'@type':'ImageObject',url:origin + entry.hero.path,width:entry.hero.width,height:entry.hero.height,caption:entry.hero.alt},
    author:{'@type':'Person',name:'علیرضا عسگرپور',url:origin + '/fa/','@id':origin + '/#person'},
    keywords:(entry.tags || []).map(t => topicNames[t] || t),wordCount:stats.words,
  }
  const breadcrumbSchema = {
    '@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement:[['خانه',origin+'/fa/'],['وبلاگ هادس',origin+root],[entry.title,origin+articlePath(entry)]].map(([name,item],index) => ({'@type':'ListItem',position:index+1,name,item})),
  }
  return [figure(entry.hero,true), tagLinks(entry.tags), '<div class="article-prose">\n' + sections + '\n</div>', sources, related, '<script type="application/ld+json">' + json(schema) + '</script>', '<script type="application/ld+json">' + json(breadcrumbSchema) + '</script>'].join('\n\n')
}

export function getBlogGardenNotes() {
  const approved = visibleEntries(entries)
  const activeTags = Object.keys(topicNames).filter(tag => approved.some(e => e.tags?.includes(tag)))
  const directories = {group:'راهنماها','dg-hide':true,contentClasses:'blog-directory',dgShowLocalGraph:false,dgShowBacklinks:false}
  const records = [note('نوشته‌ها/همهٔ نوشته‌ها.md','نوشته‌ها و مقاله‌ها',root,'از مفاهیم پایهٔ هوش مصنوعی تا مقاله‌های پژوهشی و ابزارهای ساخت تصویر و انیمیشن.',
    '<p class="article-deck">از پشت‌صحنهٔ انیمیشن گرفته تا قصه‌گویی و ابزارهایی که موقع ساختن به کارم می‌آیند. هر نوشته به مفهوم‌ها و یادداشت‌های مرتبطش وصل است.</p>\n\n<nav class="garden-directory-nav" aria-label="مرور نوشته‌ها"><a href="/fa/blog/categories/">دسته‌بندی‌ها</a><a href="/fa/blog/tags/">برچسب‌ها</a><a href="/fa/garden/">باغ دیجیتال</a></nav>\n\n' + cards(approved),{contentClasses:'blog-directory',dgShowLocalGraph:false})]

  const categoryCards = '<ul class="garden-category-list">' + Object.entries(categories).map(([id,cat]) => {
    const count = approved.filter(e => e.categoryId === id).length
    return '<li><a class="internal-link" href="' + categoryPath(id) + '"><h2>' + esc(cat.name) + '</h2><p>' + esc(cat.description) + '</p><span>' + (count ? numbers.format(count) + ' نوشته' : 'هنوز نوشته‌ای ندارد') + '</span></a></li>'
  }).join('') + '</ul>'
  records.push(note('راهنماها/دسته‌بندی‌ها.md','دسته‌بندی‌ها',root+'categories/','مسیرهای مطالعه بر اساس نوع نوشته: شرح پژوهش، تحلیل ریپو و مفاهیم پایه.',categoryCards,directories))
  records.push(note('راهنماها/برچسب‌ها.md','برچسب‌ها',root+'tags/','موضوع‌های نوشته‌ها و مقاله‌های هادس.',tagLinks(activeTags),directories))

  for (const [id,cat] of Object.entries(categories)) {
    const list = approved.filter(e => e.categoryId === id)
    const robots = list.length ? 'index, follow' : 'noindex, follow'
    records.push(note('راهنماها/دسته‌ها/'+id+'.md',cat.name,categoryPath(id),cat.description,cards(list),{...directories,robots,metatags:{description:cat.description,robots}}))
  }
  for (const id of activeTags) {
    const title = topicNames[id]
    records.push(note('راهنماها/برچسب‌ها/'+id+'.md',title,tagPath(id),'نوشته‌های هادس با برچسب «'+title+'».',cards(approved.filter(e => e.tags?.includes(id))),{...directories,canonical:origin+root,robots:'noindex, follow',metatags:{description:'نوشته‌های هادس با برچسب «'+title+'».',robots:'noindex, follow'}}))
  }
  for (const entry of approved) {
    const stats = readingStats(entry)
    records.push(note('نوشته‌ها/'+entry.slug+'.md',entry.title,articlePath(entry),entry.description,articleContent(entry),{
      tags:['note',...(entry.tags || []).map(tag => topicNames[tag] || tag)],date:entry.date,created:entry.date,updated:entry.modified || entry.date,
      kind:'article',readingMinutes:stats.minutes,wordCount:stats.words,
      contentClasses:'blog-article',categoryLabel:entry.category || '',categoryURL:entry.categoryId ? categoryPath(entry.categoryId) : '',group:'مقاله‌ها',
      metatags:{description:entry.description,'og:type':'article','og:locale':'fa_IR','og:title':entry.title,'og:description':entry.description,'og:image':origin+entry.hero.path,'og:image:width':String(entry.hero.width),'og:image:height':String(entry.hero.height),'og:image:alt':entry.hero.alt,'article:published_time':entry.date,robots:'index, follow'},
    }))
  }
  return records
}

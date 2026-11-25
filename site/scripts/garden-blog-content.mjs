import { entries } from '../public/fa/blog/entries.js'
import { visibleEntries, readingStats } from '../public/fa/blog/reader-model.js'
import { categories, topicNames, topicDetails, renderBlocks } from './render-blog.mjs'

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

function meta(entry) {
  const stats = readingStats(entry)
  const date = dates.format(new Date(entry.date + 'T12:00:00Z'))
  return '<p class="article-meta"><span class="article-byline">علیرضا عسگرپور</span><span aria-hidden="true"> · </span><time datetime="' + entry.date + '">' + date + '</time><span aria-hidden="true"> · </span><span>' + numbers.format(stats.minutes) + ' دقیقه مطالعه</span><span aria-hidden="true"> · </span><span>' + numbers.format(stats.words) + ' واژه</span></p>'
}

function cards(list, editorial = false) {
  if (!list.length) return '<p class="directory-state">هنوز نوشته‌ای در این بخش منتشر نشده. <a href="/fa/blog/">دیدن همهٔ نوشته‌ها</a></p>'
  return '<ul class="garden-post-list' + (editorial ? ' garden-post-list--editorial' : '') + '">' + list.map((entry, index) => '<li data-blog-card data-category="' + esc(entry.categoryId || '') + '" data-topics="' + esc((entry.tags || []).join(' ')) + '" data-search="' + esc([entry.title,entry.description,entry.category,...(entry.tags || []).flatMap(id=>[id,topicNames[id]])].join(' ')) + '"' + (editorial && index === 0 ? ' class="is-featured"' : '') + '><a class="garden-post-cover internal-link" aria-label="خواندن: ' + esc(entry.title) + '" href="' + articlePath(entry) + '"><img src="' + esc(entry.hero.path) + '" alt="" width="' + entry.hero.width + '" height="' + entry.hero.height + '" decoding="async" ' + (editorial && index === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + '></a><div>' + (editorial && index === 0 ? '<span class="editorial-kicker">تازه‌ترین نوشته</span>' : '') + (entry.categoryId ? '<a class="garden-post-category internal-link" href="' + categoryPath(entry.categoryId) + '">' + esc(categories[entry.categoryId]?.name || entry.category) + '</a>' : '') + '<h2><a class="internal-link" href="' + articlePath(entry) + '">' + esc(entry.title) + '</a></h2><p>' + esc(entry.description) + '</p>' + meta(entry) + tagLinks(entry.tags) + '</div></li>').join('') + '</ul>'
}

function discovery(list,activeTags) {
  const options = (items,labels) => items.map(id=>'<option value="'+esc(id)+'">'+esc(labels[id])+'</option>').join('')
  return '<section class="blog-discovery" data-blog-discovery hidden aria-label="پالایش مقاله‌ها"><div class="blog-filter-heading"><span>مقالهٔ دلخواهت را پیدا کن</span><button type="button" data-blog-reset>پاک کردن فیلترها</button></div><div class="blog-filter-fields"><label>جست‌وجوی مقاله<input type="search" data-blog-query placeholder="مثلاً دیفیوژن یا ControlNet"></label><label>نوع نوشته<select data-blog-category><option value="">همهٔ انواع</option>'+options(Object.keys(categories),Object.fromEntries(Object.entries(categories).map(([id,c])=>[id,c.name])))+'</select></label><label>موضوع<select data-blog-topic><option value="">همهٔ موضوع‌ها</option>'+options(activeTags,topicNames)+'</select></label></div><p role="status" data-blog-count>'+numbers.format(list.length)+' مقاله</p><p data-blog-empty hidden>مقاله‌ای با این ترکیب پیدا نشد. جست‌وجو یا فیلترها را تغییر بده.</p></section>'
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
  const related = entry.tags?.includes('diffusion') ? '\n\n## پیوندهای این نوشته\n\nبرای دنبال‌کردن مفهوم‌ها، از [[diffusion|دیفیوژن]] به [[noise|نویز]]، [[ddpm|DDPM]]، [[latent-diffusion|فضای نهفته]] و [[seed|بذر تصادفی]] سر بزن.\n\n' : '\n\n[مرور یادداشت‌های مرتبط](/fa/blog/#notes)\n\n'
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
  const records = [note('نوشته‌ها/همهٔ نوشته‌ها.md','وبلاگ هادس',root,'پژوهش، ابزارهای متن‌باز و مفاهیم هوش مصنوعی؛ از ایده تا ساخت تصویر و انیمیشن.',
    '<p class="article-deck">مقاله‌ها و یادداشت‌هایی دربارهٔ چگونگی کار ابزارها و مدل‌ها؛ برای خواندن، تجربه کردن و ساختن.</p>\n\n<nav class="garden-directory-nav" aria-label="مرور نوشته‌ها"><a href="/fa/blog/categories/">نوع نوشته</a><a href="/fa/blog/tags/">موضوع‌ها</a><a href="/fa/blog/#notes">یادداشت‌ها و مفاهیم</a></nav>\n\n' + '<h2 class="blog-index-section-title" id="articles">مقاله‌ها</h2>' + discovery(approved,activeTags) + cards(approved, true),{contentClasses:'blog-directory',dgShowLocalGraph:false})]

  const categoryCards = '<ul class="garden-category-list">' + Object.entries(categories).map(([id,cat]) => {
    const count = approved.filter(e => e.categoryId === id).length
    return '<li><a class="internal-link" href="' + categoryPath(id) + '"><h2>' + esc(cat.name) + '</h2><p>' + esc(cat.description) + '</p><span>' + (count ? numbers.format(count) + ' نوشته' : 'هنوز نوشته‌ای ندارد') + '</span></a></li>'
  }).join('') + '</ul>'
  records.push(note('راهنماها/دسته‌بندی‌ها.md','نوع نوشته',root+'categories/','بر اساس روشی که می‌خواهی یک موضوع را یاد بگیری، مسیر مطالعه‌ات را انتخاب کن.',categoryCards,directories))
  const topicGroups = [...new Set(activeTags.map(id=>topicDetails[id][2]))]
  const topicDirectory = topicGroups.map(group=>'<section class="blog-topic-group"><h2>'+esc(group)+'</h2><ul class="blog-topic-grid">'+activeTags.filter(id=>topicDetails[id][2]===group).map(id=>'<li><a class="internal-link" href="'+tagPath(id)+'"><span>'+esc(topicNames[id])+'</span><small>'+esc(topicDetails[id][1])+'</small><span class="blog-topic-count">'+numbers.format(approved.filter(e=>e.tags?.includes(id)).length)+' مقاله</span></a></li>').join('')+'</ul></section>').join('')
  records.push(note('راهنماها/برچسب‌ها.md','موضوع‌ها',root+'tags/','به جای دنبال کردن یک نوع مقاله، مفهوم یا ابزار مشخصی را انتخاب کن و نوشته‌های مرتبط با آن را ببین.',topicDirectory,directories))

  for (const [id,cat] of Object.entries(categories)) {
    const list = approved.filter(e => e.categoryId === id)
    const robots = list.length ? 'index, follow' : 'noindex, follow'
    records.push(note('راهنماها/دسته‌ها/'+id+'.md',cat.name,categoryPath(id),cat.description,cards(list),{...directories,robots,metatags:{description:cat.description,robots}}))
  }
  for (const id of activeTags) {
    const title = topicNames[id]
    records.push(note('راهنماها/برچسب‌ها/'+id+'.md',title,tagPath(id),topicDetails[id][1],cards(approved.filter(e => e.tags?.includes(id))),{...directories,canonical:origin+root,robots:'noindex, follow',metatags:{description:topicDetails[id][1],robots:'noindex, follow'}}))
  }
  for (const entry of approved) {
    const stats = readingStats(entry)
    records.push(note('نوشته‌ها/'+entry.slug+'.md',entry.title,articlePath(entry),entry.description,articleContent(entry),{
      tags:['note',...(entry.tags || []).map(tag => topicNames[tag] || tag)],date:entry.date,created:entry.date,updated:entry.modified || entry.date,
      kind:'article',readingMinutes:stats.minutes,wordCount:stats.words,
      contentClasses:'blog-article',categoryLabel:categories[entry.categoryId]?.name || entry.category || '',categoryURL:entry.categoryId ? categoryPath(entry.categoryId) : '',group:'مقاله‌ها',
      metatags:{description:entry.description,'og:type':'article','og:locale':'fa_IR','og:title':entry.title,'og:description':entry.description,'og:image':origin+entry.hero.path,'og:image:width':String(entry.hero.width),'og:image:height':String(entry.hero.height),'og:image:alt':entry.hero.alt,'article:published_time':entry.date,robots:'index, follow'},
    }))
  }
  return records
}

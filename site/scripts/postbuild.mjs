import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Every route is given its own crawlable English/Persian document.
// The original React/Vite UI continues to render each route.
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const base = 'https://ialirezaaa.github.io/'
const built = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const originalSchemaMatch = built.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
if (!originalSchemaMatch) throw new Error('Original Person structured data is missing')
const schema = JSON.parse(originalSchemaMatch[1])
const pages = [
  { path: '', en: ['Hades III | Alireza Asgarpour — علیرضا عسگرپور', 'Official site of Alireza Asgarpour, known as Hades III: animation direction, storytelling, cinematic worldbuilding and creative AI workflows.'], fa: ['علیرضا عسگرپور | هادس سوم — Hades III', 'وب‌سایت رسمی علیرضا عسگرپور (Alireza Asgarpour)، هادس سوم؛ کارگردان انیمیشن و طراح جهان‌ها و سیستم‌های خلاق.'] },
  { path: 'about', en: ['About Alireza Asgarpour | Hades III', 'Professional background and experience in animation direction, worldbuilding and creative technology.'], fa: ['دربارهٔ علیرضا عسگرپور | هادس سوم', 'تجربه‌های علیرضا عسگرپور در کارگردانی و تولید انیمیشن، جهان‌سازی و فناوری خلاق.'] },
  { path: 'work', en: ['Animation work and projects | Alireza Asgarpour', 'Selected animation production credits, writing, direction and AI-assisted visual workflows by Alireza Asgarpour.'], fa: ['آثار و پروژه‌های علیرضا عسگرپور | هادس سوم', 'منتخبی از پروژه‌ها، سوابق تولید انیمیشن، نویسندگی و طراحی فرایندهای خلاقانهٔ علیرضا عسگرپور.'] },
  { path: 'systems', en: ['Creative systems and neural atlas | Hades III', 'Explore an interactive atlas of animation projects, storytelling, production and creative systems.'], fa: ['اطلس تعاملی و سیستم‌های خلاق | علیرضا عسگرپور', 'اطلس تعاملی پروژه‌ها و پیوندهای میان روایت، کارگردانی انیمیشن و سیستم‌های خلاقانه.'] },
  { path: 'contact', en: ['Contact Alireza Asgarpour | Hades III', 'Official links for Alireza Asgarpour on LinkedIn, Instagram, Telegram, GitHub and email.'], fa: ['ارتباط با علیرضا عسگرپور | هادس سوم', 'راه‌های رسمی ارتباط با علیرضا عسگرپور در ایمیل، لینکدین، اینستاگرام، تلگرام و گیت‌هاب.'] },
]
const urlFor = (page, language) => base + (language === 'fa' ? 'fa/' : '') + (page.path ? page.path + '/' : '')
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function put(html, regex, replacement, label) {
  if (!regex.test(html)) throw new Error('Missing ' + label + ' in Vite HTML')
  return html.replace(regex, replacement)
}

function documentFor(page, language) {
  const title = page[language][0]
  const description = page[language][1]
  const canonical = urlFor(page, language)
  const english = urlFor(page, 'en')
  const persian = urlFor(page, 'fa')
  let html = built
  html = put(html, /<html lang="en"(?: dir="ltr")?>/, '<html lang="' + language + '" dir="ltr">', 'html lang')
  html = put(html, /<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>', 'title')
  html = put(html, /<meta name="description" content="[^"]*" \/>/, '<meta name="description" content="' + esc(description) + '" />', 'description')
  html = put(html, /<link rel="canonical" href="[^"]+" \/>/, '<link rel="canonical" href="' + canonical + '" />', 'canonical')
  html = put(html, /<link rel="alternate" hreflang="en" href="[^"]+" \/>/, '<link rel="alternate" hreflang="en" href="' + english + '" />', 'English alternate')
  html = put(html, /<link rel="alternate" hreflang="fa" href="[^"]+" \/>/, '<link rel="alternate" hreflang="fa" href="' + persian + '" />', 'Persian alternate')
  html = put(html, /<link rel="alternate" hreflang="x-default" href="[^"]+" \/>/, '<link rel="alternate" hreflang="x-default" href="' + english + '" />', 'default alternate')
  html = put(html, /<meta property="og:url" content="[^"]+" \/>/, '<meta property="og:url" content="' + canonical + '" />', 'OG URL')
  html = put(html, /<meta property="og:title" content="[^"]+" \/>/, '<meta property="og:title" content="' + esc(title) + '" />', 'OG title')
  html = put(html, /<meta property="og:description" content="[^"]+" \/>/, '<meta property="og:description" content="' + esc(description) + '" />', 'OG description')
  const graph = structuredClone(schema)
  const pageNode = graph['@graph'].find(node => node['@type'] === 'ProfilePage')
  if (!pageNode) throw new Error('Missing ProfilePage')
  pageNode['@id'] = canonical + '#profile'
  pageNode.url = canonical
  pageNode.name = title
  pageNode.inLanguage = language
  html = put(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">' + JSON.stringify(graph) + '</script>', 'JSON-LD')
  const names = language === 'fa' ? ['صفحهٔ اصلی', 'درباره', 'آثار', 'اطلس', 'تماس'] : ['Home', 'About', 'Work', 'Atlas', 'Contact']
  const blogLink = language === 'fa' ? ' · <a href="' + base + 'fa/blog/">وبلاگ</a>' : ''
  const navigation = pages.map((item, index) => '<a href="' + urlFor(item, language) + '">' + names[index] + '</a>').join(' · ') + blogLink
  const accounts = [
    ['LinkedIn', 'https://ae.linkedin.com/in/ialirezaaa'],
    ['Instagram', 'https://www.instagram.com/hades.3rd/'],
    ['GitHub', 'https://github.com/iAlirezaaa'],
    ['Telegram', 'https://t.me/Ialirezaaa'],
    ['Airis Feed', 'https://t.me/AirisFeed'],
  ].map(item => '<a href="' + item[1] + '">' + item[0] + '</a>').join(' · ')
  const message = language === 'fa' ? 'برای مشاهدهٔ نسخهٔ تعاملی جاوااسکریپت را فعال کنید.' : 'Enable JavaScript to view the original interactive portfolio.'
  const fallback = '<noscript><main lang="' + language + '" dir="' + (language === 'fa' ? 'rtl' : 'ltr') + '" style="max-width:900px;margin:8vh auto;padding:32px;color:#d9d4c8;font:17px/2 Tahoma,Arial,sans-serif"><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p><nav aria-label="Site navigation">' + navigation + '</nav><p>' + accounts + '</p><p>' + message + '</p></main></noscript>'
  html = put(html, /<\/body>/, fallback + '\n</body>', 'body')
  return html
}

for (const page of pages) {
  for (const language of ['en', 'fa']) {
    const pathname = new URL(urlFor(page, language)).pathname.slice(1)
    const folder = path.join(dist, pathname)
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, 'index.html'), documentFor(page, language))
  }
}
// Missing URLs are not indexable; GitHub Pages returns this document with HTTP 404.
const fallback404 = built.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />')
fs.writeFileSync(path.join(dist, '404.html'), fallback404)

const today = new Date().toISOString().slice(0, 10)
const entries = []
for (const page of pages) {
  for (const language of ['en', 'fa']) {
    const url = urlFor(page, language)
    entries.push('  <url>\n    <loc>' + url + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <xhtml:link rel="alternate" hreflang="en" href="' + urlFor(page, 'en') + '"/>\n    <xhtml:link rel="alternate" hreflang="fa" href="' + urlFor(page, 'fa') + '"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="' + urlFor(page, 'en') + '"/>\n  </url>')
  }
}
entries.push('  <url>\n    <loc>' + base + 'fa/blog/</loc>\n  </url>')
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + entries.join('\n') + '\n</urlset>\n'
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap)

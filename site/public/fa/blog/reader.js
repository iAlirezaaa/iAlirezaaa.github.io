import { entries } from './entries.js'
import { defaults, normalizeSettings, readingStats, visibleEntries } from './reader-model.js'

const $ = id => document.getElementById(id)
const key = 'hades-fa-blog-reading-v1'
let preferences
let saved = true
try { preferences = normalizeSettings(JSON.parse(localStorage.getItem(key))) }
catch { preferences = {...defaults} }
const fields = Object.keys(defaults)
function applyPreferences() {
  for (const name of fields) {
    document.documentElement.dataset[name] = preferences[name]
    $(name).value = preferences[name]
  }
}
function savePreferences() {
  try { localStorage.setItem(key, JSON.stringify(preferences)); saved = true }
  catch { saved = false }
  $('setting-note').textContent = saved ? 'انتخاب‌هات در همین مرورگر ذخیره شدن.' : 'تنظیمات اعمال شدن، ولی مرورگر اجازهٔ ذخیره نداد.'
}
for (const name of fields) {
  $(name).addEventListener('change', () => {
    preferences = normalizeSettings({...preferences, [name]:$(name).value})
    applyPreferences()
    savePreferences()
  })
}
$('reset').addEventListener('click', () => {
  preferences = {...defaults}
  applyPreferences()
  savePreferences()
  if (saved) $('setting-note').textContent = 'تنظیمات به حالت پیش‌فرض برگشتن.'
})
applyPreferences()
$('settings').hidden = false

const library = visibleEntries(entries)
const slug = new URLSearchParams(location.search).get('post')
const current = library.find(entry => entry.slug === slug)
const number = new Intl.NumberFormat('fa-IR')
const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {dateStyle:'long', timeZone:'UTC'})
function element(tag, value, className) {
  const node = document.createElement(tag)
  if (value) node.textContent = value
  if (className) node.className = className
  return node
}
function metadata(entry) {
  const {words, minutes} = readingStats(entry)
  return [date.format(new Date(entry.date + 'T12:00:00Z')), `${number.format(minutes)} دقیقه مطالعه`, `${number.format(words)} واژه`].join(' · ')
}
if (current) {
  document.title = current.title + ' | وبلاگ هادس'
  $('page-title').textContent = current.title
  $('intro').hidden = true
  $('posts').hidden = true
  $('article').hidden = false
  $('article-meta').textContent = metadata(current)
  for (const [index, section] of current.sections.entries()) {
    const id = 'section-' + (index+1)
    if (section.title) {
      const heading = element('h2', section.title)
      heading.id = id
      $('prose').append(heading)
      const item = element('li')
      const anchor = element('a', section.title)
      anchor.href = '#' + id
      item.append(anchor)
      $('toc-list').append(item)
    }
    for (const paragraph of section.paragraphs) $('prose').append(element('p', paragraph))
  }
  $('toc').hidden = $('toc-list').children.length < 2
  if (/^#section-\d+$/.test(location.hash)) document.getElementById(location.hash.slice(1))?.scrollIntoView()
} else {
  if (slug) $('empty').textContent = 'این نوشته در دسترس نیست.'
  if (library.length) {
    $('empty').hidden = !slug
    $('list').hidden = false
    for (const entry of library) {
      const item = element('li')
      const title = element('h3')
      const anchor = element('a', entry.title)
      anchor.href = '?post=' + encodeURIComponent(entry.slug)
      title.append(anchor)
      item.append(title, element('p', entry.description), element('p', metadata(entry), 'article-meta'))
      $('list').append(item)
    }
  }
}

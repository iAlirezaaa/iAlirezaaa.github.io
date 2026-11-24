import { defaults, normalizeSettings } from './reader-model.js'

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

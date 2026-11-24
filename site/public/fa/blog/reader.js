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

const fontKey='hades-fa-blog-font-v2'
const fonts=['estedad','vazirmatn','system']
const fontField=$('font')
if(fontField){
  let preferred='estedad'
  try{const v=localStorage.getItem(fontKey);if(fonts.includes(v))preferred=v}catch{}
  document.documentElement.dataset.font=preferred; fontField.value=preferred
  fontField.addEventListener('change',()=>{
    const chosen=fonts.includes(fontField.value)?fontField.value:'estedad'
    document.documentElement.dataset.font=chosen
    try{localStorage.setItem(fontKey,chosen)}catch{}
  })
  $('reset').addEventListener('click',()=>{fontField.value='estedad';document.documentElement.dataset.font='estedad';try{localStorage.removeItem(fontKey)}catch{}})
}
const progress=document.getElementById('read-progress')
if(progress && document.querySelector('main.article-page')){
  progress.hidden=false
  let queued=false
  const update=()=>{queued=false;const el=document.documentElement;const max=el.scrollHeight-innerHeight;progress.value=max>0?Math.round(Math.min(100,Math.max(0,scrollY/max*100))):100}
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true})
  addEventListener('resize',update)
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(document.querySelector('main'))
  update()
}

const copyLink=$('copy-link')
if(copyLink && document.querySelector('main.article-page')) {
  copyLink.hidden=false
  copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector('link[rel="canonical"]').href)
      $('copy-status').textContent='لینک کپی شد.'
    } catch {
      $('copy-status').textContent='کپی نشد. لینک نوشته توی نوار آدرس مرورگره.'
    }
  })
}

import { readFileSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const published = join(repoRoot, 'hades')
const source = join(repoRoot, 'site/public/hades')
const required = [
  'index.html', 'fa/index.html', 'assets/site.css', 'assets/site.js',
  'downloads/HADES_Public_Overview_EN.md',
  'downloads/HADES_Public_Overview_FA.md',
  'downloads/HADES_Public_Essentials.json',
  'assets/B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg',
  'assets/IMG_7187(2).png',
  'README.md'
]
const originals = {
  'assets/B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg': {
    sha256: 'c2189cba968543ed9e86389660d79cd1f031ad87be00eaa65d3b57f8ac0b6d2d',
    bytes: 230704
  },
  'assets/IMG_7187(2).png': {
    sha256: '79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7',
    bytes: 37846
  }
}
let checks = 0
function ensure(ok, label) {
  if (!ok) throw new Error('HADES public site QA failed: ' + label)
  checks += 1
}
function content(file) { return readFileSync(join(published, file), 'utf8') }

for (const file of required) {
  const a = join(source, file), b = join(published, file)
  ensure(existsSync(a) && existsSync(b), 'missing public source or Pages copy: ' + file)
  ensure(readFileSync(a).equals(readFileSync(b)), 'source/published mismatch: ' + file)
}
for (const [file, expected] of Object.entries(originals)) {
  const bytes = readFileSync(join(published, file))
  ensure(bytes.length === expected.bytes, 'original file size changed: ' + file)
  ensure(createHash('sha256').update(bytes).digest('hex') === expected.sha256, 'original logo bytes changed: ' + file)
}
for (const [file, lang, dir, canonical] of [
  ['index.html', 'en', 'ltr', 'https://ialirezaaa.github.io/hades/'],
  ['fa/index.html', 'fa', 'rtl', 'https://ialirezaaa.github.io/hades/fa/']
]) {
  const html = content(file)
  ensure(html.includes('<html lang="' + lang + '" dir="' + dir + '">'), 'language/direction: ' + file)
  ensure(html.includes('<link rel="canonical" href="' + canonical + '">'), 'canonical: ' + file)
  ensure(html.includes('hreflang="fa"') && html.includes('hreflang="en"'), 'hreflang: ' + file)
  ensure(html.includes('#EF4B32') && html.includes('HADES'), 'identity text/accent: ' + file)
  ensure((html.match(/<img /g) || []).length >= 3, 'source images absent: ' + file)
  ensure((html.match(/ download(?:\s|>)/g) || []).length >= 7, 'download buttons absent: ' + file)
  ensure(!/Hades_3rd_Branding|github_pat_|sk-proj-|asgarpour\.alireza@gmail\.com/i.test(html), 'private reference: ' + file)
  const page = new URL('https://ialirezaaa.github.io/hades/' + (lang === 'fa' ? 'fa/' : ''))
  const attrs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1])
  for (const item of attrs) {
    if (item.startsWith('#')) {
      ensure(html.includes('id="' + item.slice(1) + '"'), 'missing anchor ' + item)
      continue
    }
    const u = new URL(item, page)
    if (u.origin !== page.origin || !u.pathname.startsWith('/hades/')) continue
    let relativePath = decodeURIComponent(u.pathname.slice('/hades/'.length))
    if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html'
    const target = resolve(published, relativePath)
    ensure(target.startsWith(published + sep), 'path traversal in ' + item)
    ensure(existsSync(target) && statSync(target).isFile(), 'broken public link in ' + file + ': ' + item)
  }
}
const essentials = JSON.parse(content('downloads/HADES_Public_Essentials.json'))
ensure(essentials.approved.signature_color_srgb === '#EF4B32', 'approved accent')
ensure(essentials.status.includes('REVIEW'), 'review status')
ensure(essentials.pending_approval.includes('svg_master'), 'no unapproved SVG master')
const js = content('assets/site.js')
ensure(!/https?:\/\//.test(js), 'unexpected network request in site JavaScript')
console.log('HADES public website QA PASS: ' + checks + ' checks, original SHA-256 preserved, bilingual links verified.')

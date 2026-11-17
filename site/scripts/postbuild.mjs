import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const original = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
for (const route of ['about', 'work', 'systems', 'contact']) {
  const folder = path.join(dist, route)
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, 'index.html'), original)
}
fs.writeFileSync(path.join(dist, '404.html'), original)

// Persian SEO page: exactly the same original React UI.
let fa = original.replace('<html lang="en">', '<html lang="fa">')
fa = fa.replace(
  /<title>[^<]*<\/title>/,
  '<title>علیرضا عسگرپور | Hades III — Alireza Asgarpour</title>',
)
fa = fa.replace(
  /<meta name="description" content="[^"]*" \/>/,
  '<meta name="description" content="پروفایل رسمی علیرضا عسگرپور (Alireza Asgarpour)، هادس سوم؛ کارگردانی انیمیشن، جهان‌سازی سینمایی و سیستم‌های خلاق." />',
)
fa = fa.replace(
  '<link rel="canonical" href="https://ialirezaaa.github.io/" />',
  '<link rel="canonical" href="https://ialirezaaa.github.io/fa/" />',
)
const folder = path.join(dist, 'fa')
fs.mkdirSync(folder, { recursive: true })
fs.writeFileSync(path.join(folder, 'index.html'), fa)

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {parse}=require('../../garden/node_modules/node-html-parser')
const base=path.resolve('dist')
const repo=path.resolve('..')
const inv=JSON.parse(fs.readFileSync(path.join(repo,'garden/docs/animation-source-inventory.json'),'utf8'))
const resolve=url=>path.join(base,url.replace(/^\//,''))
assert.equal(inv.inventory.length,27)
const unique=new Set(), figures=new Set()
for (const entry of inv.inventory) {
  const url=entry.canonical
  assert.ok(!unique.has(url));unique.add(url)
  const source=fs.readFileSync(path.join(repo,'garden/src/site/notes',entry.note_file),'utf8')
  assert.ok(source.includes(entry.source_url),'missing attribution: '+url)
  const file=path.join(resolve(url),'index.html')
  assert.ok(fs.existsSync(file),'missing '+file)
  const doc=parse(fs.readFileSync(file,'utf8'))
  assert.equal(doc.querySelector('html').getAttribute('dir'),'rtl',url)
  assert.ok(doc.text.includes('منبع و اعتبار'),url)
  assert.ok(doc.querySelectorAll('a[href]').some(a=>a.getAttribute('href')===entry.source_url),url+' source link')
  for (const img of doc.querySelectorAll('.animation-study-figure img')) {
    const src=img.getAttribute('src')
    assert.ok(src.startsWith('/fa/garden/img/user/animation/'),src)
    assert.ok(src.endsWith('.svg'))
    assert.ok(img.getAttribute('alt'))
    const svg=fs.readFileSync(resolve(src),'utf8')
    assert.match(svg,/<svg\b/)
    assert.doesNotMatch(svg,/<script\b|<image\b/i)
    figures.add(src)
  }
}
assert.equal(figures.size,23)
console.log('PASS: 27 independent Persian routes, 23 local SVG teaching figures, source attribution and no image hotlinks')

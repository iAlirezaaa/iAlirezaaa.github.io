import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = join(repo, 'site/dist/hades/library')
const source = join(repo, 'site/public/hades/library')
const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'),'utf8'))
const newItems = catalog.items.filter(x => !x.existing)
const existing = catalog.items.filter(x => x.existing)
const counts = Object.fromEntries(['stationery','social','web'].map(c => [c,newItems.filter(x=>x.cat===c).length]))
const check = (cond,desc) => { if(!cond) throw new Error('HADES LIBRARY CI HOLD: '+desc) }
check(newItems.length===18 && counts.stationery===7 && counts.social===7 && counts.web===4,'source category counts')
check(existing.some(x=>x.cat==='patterns') && existing.some(x=>x.cat==='guides'),'missing public pattern/guide references')
let checks=0
for(const item of newItems){
 const stem=item.id
 for(const ext of ['svg','png','psd']){
   const path=join(out,'assets',stem+'.'+ext)
   check(existsSync(path) && statSync(path).size>250,'missing/empty '+ext+': '+stem)
   const body=readFileSync(path)
   if(ext==='png') {check(body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'png signature '+stem);check(body.readUInt32BE(16)===item.w && body.readUInt32BE(20)===item.h,'png dimensions '+stem)}
   if(ext==='psd')check(body.subarray(0,4).toString('ascii')==='8BPS','PSD signature '+stem)
   if(ext==='svg')check(body.equals(readFileSync(join(source,'assets',stem+'.svg'))),'SVG source fidelity '+stem)
   checks++
 }
}
for(const c of ['stationery','social','web']){
 const file=join(out,'packs',`HADES_${c}_REVIEW.zip`)
 check(existsSync(file) && statSync(file).size>5000,'missing archive '+c)
 check(readFileSync(file).subarray(0,2).equals(Buffer.from('PK')),'archive signature '+c)
}
const all=join(out,'HADES_Complete_Editable_Library_REVIEW.zip')
check(existsSync(all) && statSync(all).size>10000,'complete ZIP missing')
for(const page of ['index.html','../fa/library/index.html']){
 const path=resolve(out,page)
 const html=readFileSync(path,'utf8')
 check(html.includes('data-filter="guides"') && html.includes('data-filter="stationery"') && html.includes('data-filter="social"'),'missing filters '+page)
 check((html.match(/data-card data-category=/g)||[]).length === catalog.items.length,'catalog/gallery mismatch '+page)
}

const backgrounds=[
 ['HADES_Obsidian_Vault_16x9_REVIEW',1920,1080],
 ['HADES_Mammoth_Plaster_16x9_REVIEW',1920,1080],
 ['HADES_Basalt_Axis_9x16_REVIEW',1080,1920],
 ['HADES_Skeletal_Slab_1x1_REVIEW',1080,1080],
 ['HADES_Threshold_Portico_16x9_REVIEW',1920,1080],
 ['HADES_Threshold_Passage_9x16_REVIEW',1080,1920],
 ['HADES_Threshold_Court_1x1_REVIEW',1080,1080],
]
for (const [stem,w,h] of backgrounds) {
 const s=join(source,'backgrounds','assets',stem+'.png'), p=join(out,'backgrounds','assets',stem+'.png')
 check(existsSync(s)&&existsSync(p),'generated background PNG missing '+stem)
 const a=readFileSync(s),b=readFileSync(p)
 check(a.equals(b),'background source/dist byte mismatch '+stem)
 check(a.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'background PNG signature '+stem)
 check(a.readUInt32BE(16)===w&&a.readUInt32BE(20)===h,'background dimensions '+stem)
}
for (const [stem] of backgrounds.filter(([name]) => name.startsWith('HADES_Threshold_'))) {
 for(const ext of ['jpg','webp']) {
  const s=join(source,'backgrounds','assets',stem+'.'+ext), p=join(out,'backgrounds','assets',stem+'.'+ext)
  check(existsSync(s)&&existsSync(p),'background JPEG/WebP missing '+stem+'.'+ext)
  const a=readFileSync(s),b=readFileSync(p)
  check(a.equals(b),'raster mirrored byte mismatch '+stem+'.'+ext)
  if(ext==='jpg')check(a[0]===255&&a[1]===216&&a.at(-1)===217,'JPEG header/trailer '+stem)
  else check(a.toString('ascii',0,4)==='RIFF'&&a.toString('ascii',8,12)==='WEBP','WebP container signature '+stem)
 }
}
check(catalog.approved_exact_color==='#EF4B32','approved accent drift')
console.log(`HADES Library CI PASS: ${checks} real source/pixel-file checks; 18 PNG, 18 PSD, 18 SVG; 3 packs + 1 full ZIP; 2 gallery languages`)

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
for(const page of ['index.html','../../fa/library/index.html']){
 const path=resolve(out,page)
 const html=readFileSync(path,'utf8')
 check(html.includes('data-filter="guides"') && html.includes('data-filter="stationery"') && html.includes('data-filter="social"'),'missing filters '+page)
 check((html.match(/data-card data-category=/g)||[]).length === catalog.items.length,'catalog/gallery mismatch '+page)
}
check(catalog.approved_exact_color==='#EF4B32','approved accent drift')
console.log(`HADES Library CI PASS: ${checks} real source/pixel-file checks; 18 PNG, 18 PSD, 18 SVG; 3 packs + 1 full ZIP; 2 gallery languages`)

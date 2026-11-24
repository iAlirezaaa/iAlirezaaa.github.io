import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const base=fileURLToPath(new URL('../',import.meta.url))
const dir=path.join(base,'garden','notes')
const out=path.join(base,'public','fa','garden','graph.json')
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const all=new Map()
for(const name of fs.readdirSync(dir).filter(x=>/^[a-z0-9-]+\.md$/.test(x))){
  const source=fs.readFileSync(path.join(dir,name),'utf8')
  const match=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if(!match)continue
  const m=Object.fromEntries(match[1].split(/\r?\n/).map(line=>{const i=line.indexOf(':');return i<0?['','']:[line.slice(0,i).trim(),line.slice(i+1).trim()]}))
  if(m['dg-publish']!=='true'||m.public!=='true')continue
  const id=name.slice(0,-3)
  const content=source.slice(match[0].length)
  all.set(id,{id,title:m.title||id,group:m.group||'یادداشت',url:m.url||'',text:content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,slug,label)=>label||slug).trim().slice(0,480),links:[...content.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)].map(x=>x[1])})
}
const nodes=[...all.values()].sort((a,b)=>a.id.localeCompare(b.id))
const edges=[...new Set(nodes.flatMap(n=>n.links.filter(t=>all.has(t)).map(t=>[n.id,t].sort().join('|'))))].map(x=>{const [source,target]=x.split('|');return {source,target}})
const graph={version:1,status:'PUBLIC REVIEW',nodes:nodes.map(({links,...rest})=>rest),edges}
fs.mkdirSync(path.dirname(out),{recursive:true})
fs.writeFileSync(out,JSON.stringify(graph,null,2)+'\n')
const dist=process.argv[2]
if(dist){const dest=path.join(dist,'fa','garden','graph.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(graph,null,2)+'\n')}
console.log('Garden:',nodes.length,'public nodes,',edges.length,'edges')

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const repoRoot=path.resolve(root,'..')
const read=p=>fs.readFileSync(path.join(repoRoot,p),'utf8')
for(const name of ['index.html','reader.css','reader.js']){
 assert.equal(read('site/public/fa/blog/'+name),read('fa/blog/'+name),'Blog mirror mismatch: '+name)
}
for(const name of ['index.html','graph.json']){
 assert.equal(read('site/public/fa/garden/'+name),read('fa/garden/'+name),'Garden mirror mismatch: '+name)
}
const shell=read('site/public/fa/blog/index.html')
for(const phrase of ['id="font"','Vazirmatn','read-progress','/fa/garden/'])assert.ok(shell.includes(phrase),'Missing blog enhancement: '+phrase)
const graph=JSON.parse(read('site/public/fa/garden/graph.json'))
assert.ok(graph.nodes.length>=5)
const ids=new Set(graph.nodes.map(n=>n.id));assert.equal(ids.size,graph.nodes.length)
assert.ok(graph.nodes.some(n=>n.url==='/fa/blog/diffusion-from-noise/'))
for(const e of graph.edges){assert.ok(ids.has(e.source)&&ids.has(e.target),'Dangling graph edge')}
const notes=fs.readdirSync(path.join(root,'garden/notes')).filter(x=>x.endsWith('.md'))
for(const note of notes){const text=read('site/garden/notes/'+note);assert.match(text,/dg-publish: true/);assert.match(text,/public: true/)}
const rendered=path.join(root,'dist/fa/garden/graph.json')
if(fs.existsSync(rendered)){const data=JSON.parse(fs.readFileSync(rendered,'utf8'));assert.equal(data.nodes.length,graph.nodes.length)}
console.log('PASS: blog mirror, garden mirror, font controls, note graph links, approved Markdown')

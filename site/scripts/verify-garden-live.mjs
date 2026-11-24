import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url))
const live='https://ialirezaaa.github.io/'
const targets=[
 ['fa/garden/','site/public/fa/garden/index.html','text/html'],
 ['fa/blog/reader.css','site/public/fa/blog/reader.css','text/css'],
 ['fa/blog/reader.js','site/public/fa/blog/reader.js','javascript'],
]
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
async function fetchRetry(url){
 let last
 for(let i=0;i<10;i++){
  try{const res=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)});if(res.ok)return res;last=Error('HTTP '+res.status)}catch(e){last=e}
  if(i<9)await new Promise(r=>setTimeout(r,8000))
 }
 throw new Error(url+': '+String(last))
}
for(const [url,source,mime] of targets){
 const res=await fetchRetry(live+url)
 assert.ok((res.headers.get('content-type')||'').toLowerCase().includes(mime),'Wrong MIME for '+url)
 const received=Buffer.from(await res.arrayBuffer())
 const original=fs.readFileSync(path.join(root,source))
 assert.equal(hash(received),hash(original),'Hosted SHA mismatch '+url)
 console.log('PASS HTTP 200 MIME SHA',url)
}
const graphRes=await fetchRetry(live+'fa/garden/graph.json')
assert.ok((graphRes.headers.get('content-type')||'').includes('json'))
const graph=await graphRes.json()
assert.ok(graph.nodes.length>=5&&graph.edges.length>=5)
const ids=new Set(graph.nodes.map(n=>n.id))
assert.ok(graph.edges.every(e=>ids.has(e.source)&&ids.has(e.target)))
console.log('PASS public graph',graph.nodes.length,graph.edges.length)
const article=await fetchRetry(live+'fa/blog/diffusion-from-noise/')
const body=await article.text()
assert.ok(body.includes('/fa/garden/?focus=diffusion'),'Missing article -> garden link')
assert.ok(body.includes('id="read-progress"'),'Missing reader progress')
console.log('PASS article integration')

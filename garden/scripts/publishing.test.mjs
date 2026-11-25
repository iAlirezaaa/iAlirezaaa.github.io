import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {readNotes,canonicalizeWikiLinks,prefixedUrl,prefixText,prefixData,headingId,manifestFor,normalizePersian,noteIndex,resolveNote} from './publishing.mjs'

test('publication is explicit and supports native plugin JSON frontmatter',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hades-publish-'))
  try{
    fs.writeFileSync(path.join(dir,'عام.md'),'---\n{"dg-publish":true,"title":"عمومی","permalink":"/عام/"}\n---\n[[محرمانه]]')
    fs.writeFileSync(path.join(dir,'محرمانه.md'),'---\ntitle: SECRET_UNMARKED_SENTINEL\n---\nPRIVATE_BODY')
    fs.writeFileSync(path.join(dir,'false.md'),'---\ndg-publish: "true"\n---\nPRIVATE_STRING_BOOL')
    fs.writeFileSync(path.join(dir,'private.md'),'---\ndg-publish: true\npublic: false\n---\nPRIVATE_OVERRIDE')
    fs.writeFileSync(path.join(dir,'draft.md'),'---\ndg-publish: true\ndraft: true\n---\nPRIVATE_DRAFT')
    const notes=readNotes(dir)
    assert.equal(notes.length,1)
    assert.equal(notes[0].title,'عمومی')
    assert.equal(notes[0].frontmatter.permalink,'/fa/blog/notes/عام/')
    assert.equal(notes[0].legacyUrl,'/fa/garden/عام/')
    assert.doesNotMatch(JSON.stringify(manifestFor(notes)),/SECRET_UNMARKED_SENTINEL|PRIVATE_/)
    assert.deepEqual(manifestFor(notes).notes[0].links,[])
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('Persian aliases, ZWNJ, headings and folder paths resolve consistently',()=>{
  const notes=[{stem:'مفاهیم/یادگیری ماشین',aliases:['مفاهیم/یادگیری ماشین','یادگیری ماشین','Machine Learning']}]
  const content='[[يادگيري‌ماشين#يك مثال|نمونه]] و [[Machine Learning]] و `[[Machine Learning]]`\n```js\nconst x = "[[Machine Learning]]"\n```'
  const rendered=canonicalizeWikiLinks(content,notes)
  assert.match(rendered,/\[\[مفاهیم\/یادگیری ماشین#يك مثال\|نمونه\]\]/)
  assert.match(rendered,/\[\[مفاهیم\/یادگیری ماشین\|Machine Learning\]\]/)
  assert.match(rendered,/`\[\[Machine Learning\]\]`/)
  assert.match(rendered,/const x = "\[\[Machine Learning\]\]"/)
  assert.equal(headingId('يك مثال English'),'یک-مثال-english')
  assert.equal(normalizePersian('مي‌كنيم'),'می کنیم')
})
test('garden subpath adapter preserves main-site articles, code operations and external URLs',()=>{
  assert.equal(prefixedUrl('/noise/'),'/fa/garden/noise/')
  assert.equal(prefixedUrl('/fa/blog/a/'),'/fa/blog/a/')
  assert.equal(prefixedUrl('/fa/work/'),'/fa/work/')
  const source='<a href="/">خانه</a><a href="/fa/blog/a/">مقاله</a><link href="/styles/x.css"><script>const path = url.split("/");fetch("/graph.json");</script><link rel="canonical" href="https://ialirezaaa.github.io/noise/">'
  const adapted=prefixText(source,'.html')
  assert.match(adapted,/href="\/fa\/garden\/"/)
  assert.match(adapted,/href="\/fa\/blog\/a\/"/)
  assert.match(adapted,/url.split\("\/"\)/)
  assert.match(adapted,/fetch\("\/fa\/garden\/graph.json"\)/)
  assert.match(adapted,/https:\/\/ialirezaaa.github.io\/fa\/garden\/noise\//)
  assert.deepEqual(prefixData({nodes:{'/':{url:'/',neighbors:['/noise/','/fa/blog/a/']}}}),{nodes:{'/fa/garden/':{url:'/fa/garden/',neighbors:['/fa/garden/noise/','/fa/blog/a/']}}})
})
test('hidden topic directories cannot shadow published concepts with the same slug or title',()=>{
  const concept={stem:'مسیرهای مطالعه/دیفیوژن',aliases:['دیفیوژن','diffusion'],frontmatter:{id:'diffusion'}}
  const hidden={stem:'راهنماها/برچسب‌ها/diffusion',aliases:['دیفیوژن','diffusion'],frontmatter:{hide:true,'dg-hide':true}}
  const index=noteIndex([concept,hidden])
  assert.equal(resolveNote('diffusion',index),concept)
  assert.equal(resolveNote('دیفیوژن',index),concept)
  assert.equal(resolveNote('راهنماها/برچسب‌ها/diffusion',index),hidden)
  assert.equal(canonicalizeWikiLinks('[[diffusion|دیفیوژن]]',[concept,hidden]),'[[مسیرهای مطالعه/دیفیوژن|دیفیوژن]]')
  const conflicting={stem:'روش‌ها/دیفیوژن',aliases:['دیفیوژن'],frontmatter:{}}
  assert.equal(resolveNote('دیفیوژن',noteIndex([concept,conflicting])),null)
  assert.equal(resolveNote('diffusion',noteIndex([concept,conflicting])),concept)
})

import {publishedAssetPaths,listPublicAssetCandidates} from './public-assets.mjs'
test('published asset body and properties preserve PDF/cover without leaking unrelated files',()=>{
  const candidates=['images/cover.png','docs/example file.pdf','a/ambiguous.png','b/ambiguous.png','private.png','images/other.webp']
  const note={content:'<iframe src="/img/user/docs/example%20file.pdf#page=2"></iframe> /img/user/../private.png',frontmatter:{cover:'[[cover.png]]','dg-note-properties':{other:'[[ambiguous.png]]',explicit:'/img/user/images/other.webp'}}}
  assert.deepEqual(publishedAssetPaths(note,candidates),['docs/example file.pdf','images/cover.png','images/other.webp'])
  assert.deepEqual(publishedAssetPaths({content:'',frontmatter:{cover:'[[ambiguous.png]]'}},candidates),[])
})
test('asset enumeration does not follow symlinks',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hades-assets-'))
  try{
    fs.writeFileSync(path.join(dir,'public.png'),'x')
    fs.symlinkSync(path.join(dir,'public.png'),path.join(dir,'link.png'))
    assert.deepEqual(listPublicAssetCandidates(dir),['public.png'])
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('local graph depth includes only public reachable nodes, including numeric ID zero',async()=>{
  const {graphAtDepth}=await import('../src/site/scripts/garden-content-compat.js')
  const graph={nodes:[{id:0},{id:1},{id:2},{id:3},{id:4}],links:[{source:0,target:1},{source:2,target:1},{source:2,target:3},{source:3,target:4},{source:0,target:99}]}
  const ids=d=>graphAtDepth(graph,0,d).nodes.map(n=>n.id)
  assert.deepEqual(ids(1),[0,1])
  assert.deepEqual(ids(2),[0,1,2])
  assert.deepEqual(ids(3),[0,1,2,3])
  assert.deepEqual(ids(8),[0,1,2,3])
  assert.equal(graphAtDepth(graph,0,3).links.length,3)
  assert.deepEqual(graphAtDepth(graph,99,2),{nodes:[],links:[]})
})
test('Mermaid is lazy and preserves original source on renderer or network failure',async()=>{
  const {renderMermaid}=await import('../src/site/scripts/garden-content-compat.js')
  let loads=0
  assert.deepEqual(await renderMermaid({querySelectorAll:()=>[]},async()=>{loads++}),{rendered:0,failed:0})
  assert.equal(loads,0)
  const valid={textContent:'graph TD; A --> B',dataset:{}},invalid={textContent:'invalid graph',dataset:{}}
  let config
  const result=await renderMermaid({querySelectorAll:()=>[valid,invalid]},async()=>({default:{initialize(c){config=c},async render(id,source){if(source==='invalid graph')throw Error('invalid');return {svg:'<svg></svg>'}}}}))
  assert.equal(config.securityLevel,'strict')
  assert.equal(valid.dataset.diagramState,'rendered')
  assert.equal(invalid.textContent,'invalid graph')
  assert.equal(invalid.dataset.diagramState,'invalid')
  assert.deepEqual(result,{rendered:1,failed:1})
  const unavailable={textContent:'graph LR; A --> B',dataset:{}}
  assert.deepEqual(await renderMermaid({querySelectorAll:()=>[unavailable]},async()=>{throw Error('offline')}),{rendered:0,failed:1})
  assert.equal(unavailable.textContent,'graph LR; A --> B')
  assert.equal(unavailable.dataset.diagramState,'unavailable')
})

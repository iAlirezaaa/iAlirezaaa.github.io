import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {buildDigitalGarden} from './build.mjs'
const require=createRequire(import.meta.url)
const {parse}=require('node-html-parser')

// Synthetic QA notes only. This build writes to an isolated temporary directory;
// no fixture is placed under src/site/notes or added to the production build.
test('native Markdown and compiled Obsidian content in the HADES shell',()=>{
  const dest=fs.mkdtempSync(path.join(os.tmpdir(),'hades-native-content-'))
  const fixtureRoute='/fa/blog/notes/qa-native-compat/'
  const targetRoute='/fa/blog/notes/qa-native-target/'
  const canvasRoute='/fa/blog/notes/qa-native-canvas/'
  const opts=(title,permalink)=>({title,permalink,'dg-publish':true,public:true})
  const body=[
    '## آزمایش محتوا','', '==marked text==','',
    'A footnote.[^demo]','', '[^demo]: Native footnote.','',
    'Math $x^2 + y^2$ and','', '$$a^2+b^2=c^2$$','',
    '> [!note]','> Native callout.','',
    '[[qa-native-target|target]]','', '[Relative target](qa-native-target.md)','',
    '```js','const value = 42;','```','',
    '```mermaid','graph TD; A["x < y"] --> B','```','',
    '```plantuml','Alice -> Bob: Hello','```','',
    '```transclusion','Embedded **content**.','```','',
    '<div class="block-language-dataview"><table><thead><tr><th>Column</th></tr></thead><tbody><tr><td>Compiled Dataview row</td></tr></tbody></table></div>','',
    '```base','views:','  - type: table','    name: "Native table"','    order:','      - file.name','```','',
    '<svg class="excalidraw-svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5"/></svg>'
  ].join('\n')
  const fixture=[
    {fileName:'qa-native-compat.md',frontmatter:opts('Native QA',fixtureRoute),content:body},
    {fileName:'qa-native-target.md',frontmatter:opts('Target QA',targetRoute),content:'Target body.'},
    {fileName:'qa-native-canvas.canvas',frontmatter:{...opts('Canvas QA',canvasRoute),contentClasses:'canvas-page'},content:'<div class="canvas-wrapper hide"><div class="canvas"><div class="canvas-node" style="width:120px;height:60px;transform:translate(0px,0px)"><div class="canvas-node-content">Compiled canvas QA</div></div></div></div>'}
  ]
  try{
    buildDigitalGarden(dest,fixture)
    const page=route=>parse(fs.readFileSync(path.join(dest,route.slice(1),'index.html'),'utf8'))
    const rendered=page(fixtureRoute), prose=rendered.querySelector('[data-note-body]')
    assert.ok(prose.querySelector('mark'),'highlight missing')
    assert.ok(prose.querySelector('.footnotes'),'footnotes missing')
    assert.ok(prose.querySelector('mjx-container, .MathJax, svg[data-mml-node]'),'MathJax output missing')
    assert.ok(prose.querySelector('.callout'),'callout missing')
    assert.ok(prose.querySelector('code.language-js'),'code missing')
    assert.ok(prose.querySelector('pre.mermaid')?.text.includes('x < y'),'Mermaid source not preserved')
    assert.ok(prose.querySelector('img[src*="plantuml"]'),'PlantUML image URL missing')
    assert.ok(prose.querySelector('.transclusion'),'transclusion missing')
    assert.ok(prose.querySelector('.block-language-dataview table.dataview'),'Dataview table adaptation missing')
    assert.ok(prose.querySelector('.obsidian-base-table-wrapper'),'Bases table missing')
    assert.ok(prose.querySelector('svg.excalidraw-svg'),'embedded Excalidraw SVG missing')
    assert.ok(prose.querySelectorAll('a').filter(a=>a.getAttribute('href')===targetRoute).length>=2,'Wiki/relative links not canonical')
    assert.ok(rendered.querySelector('script[src$="garden-content-compat.js"]'),'Mermaid runtime missing')
    assert.ok(rendered.querySelector('link[href$="garden-content-compat.css"]'),'content compatibility stylesheet missing')
    const canvas=page(canvasRoute)
    assert.ok(canvas.querySelector('.canvas-wrapper .canvas-node'),'compiled Canvas markup missing')
    assert.ok(canvas.querySelector('link[href$="garden-content-compat.css"]'),'Canvas CSS missing')
    assert.ok(canvas.querySelectorAll('script').some(s=>s.text.includes('initCanvas')),'Canvas runtime missing')
    const plain=page(targetRoute)
    assert.ok(!plain.querySelector('link[href$="garden-content-compat.css"]'),'specialized content CSS loaded on plain note')
  }finally{fs.rmSync(dest,{recursive:true,force:true})}
})

import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const matter = require('gray-matter')
const matterOptions = require('../src/helpers/matterOptions.js')

export const GARDEN_PATH = '/fa/garden/'
export const ORIGIN = 'https://ialirezaaa.github.io'
export const normalizePersian = value => String(value).normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[\u200C\u200D]/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('fa')
export const headingId = value => normalizePersian(String(value).replace(/<[^>]*>/g,'')).replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/[\s_]+/g,'-').replace(/^-+|-+$/g,'')

export function isPublished(data) {
  return data['dg-publish'] === true && data.public !== false && data.draft !== true
}
export function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'fa')).flatMap(entry => entry.isDirectory() ? walk(path.join(dir,entry.name)) : entry.isFile() ? [path.join(dir,entry.name)] : [])
}
export function safePath(value) {
  const clean = String(value).replaceAll('\\','/')
  if (clean.startsWith('/') || clean.split('/').some(p=>p === '..' || p === '.')) throw new Error('Invalid note path: '+value)
  return clean
}
function safePermalink(value, fallback, virtual) {
  let url = typeof value === 'string' ? value.trim() : fallback
  if (url.startsWith(ORIGIN)) url = url.slice(ORIGIN.length)
  if (url.startsWith(GARDEN_PATH)) url = '/'+url.slice(GARDEN_PATH.length)
  if (!url.startsWith('/') || url.startsWith('//') || /[\\?#<>"']/.test(url) || url.split('/').includes('..')) throw new Error('Invalid public note permalink: '+url)
  if (url.startsWith('/fa/') && !(virtual && url.startsWith('/fa/blog/'))) throw new Error('Note route escapes garden: '+url)
  return url.endsWith('/') || /\.[a-z0-9]+$/i.test(url) ? url : url+'/'
}
export function readNotes(notesRoot, extraNotes = []) {
  const sourceNotes = walk(notesRoot).filter(file=>/\.(md|markdown|canvas)$/i.test(file)).map(file => {
    const parsed=matter(fs.readFileSync(file,'utf8'),matterOptions)
    return {fileName:path.relative(notesRoot,file).split(path.sep).join('/'),frontmatter:parsed.data,content:parsed.content}
  })
  const notes = [...sourceNotes,...extraNotes.map(note=>({...note,virtual:true}))].filter(note=>isPublished(note.frontmatter)).map(note=>{
    const fileName=safePath(note.fileName)
    const stem=fileName.replace(/\.(md|markdown|canvas)$/i,'')
    const data={...note.frontmatter}
    const title=String(data.title || path.posix.basename(stem))
    const tags=Array.isArray(data.tags) ? [...data.tags] : typeof data.tags === 'string' ? [data.tags] : []
    if (!tags.includes('note')) tags.push('note')
    if(data['dg-home']===true && !tags.includes('gardenEntry'))tags.push('gardenEntry')
    data.tags=tags
    data.title=title
    if(data['dg-hide']===true && data.hide === undefined)data.hide=true
    data.permalink=tags.includes('gardenEntry') ? '/' : safePermalink(data.permalink,'/'+stem.split('/').map(headingId).join('/')+'/',note.virtual)
    data.description=String(data.description || note.content.replace(/%%[\s\S]*?%%/g,'').replace(/<[^>]*>/g,'').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,target,label)=>label||target).replace(/[#*_`]/g,'').trim().slice(0,170))
    const aliases=[title,path.posix.basename(stem),stem,...(Array.isArray(data.aliases)?data.aliases:typeof data.aliases==='string'?[data.aliases]:[])]
    return {...note,fileName,stem,frontmatter:data,title,aliases,content:note.content.replace(/%%[\s\S]*?%%/g,'')}
  })
  const unique=new Set()
  for(const note of notes){if(unique.has(note.frontmatter.permalink))throw new Error('Duplicate public permalink '+note.frontmatter.permalink);unique.add(note.frontmatter.permalink)}
  if(notes.filter(n=>n.frontmatter.tags.includes('gardenEntry')).length>1)throw new Error('More than one published garden home')
  return notes
}
export function noteIndex(notes) {
  const index=new Map(), exact=new Map()
  const add=(map,key,note)=>{key=normalizePersian(key);map.set(key,map.has(key)&&map.get(key)!==note?null:note)}
  for(const note of notes){
    // An exact vault path is always addressable. Explicit ids preserve stable
    // links when a Persian title changes. Hidden directory/filter pages never
    // shadow a real concept with their generic basename or display title.
    add(exact,note.stem,note)
    if(note.frontmatter?.id)add(exact,note.frontmatter.id,note)
    if(note.frontmatter?.hide||note.frontmatter?.['dg-hide'])continue
    for(const alias of note.aliases)add(index,alias,note)
  }
  for(const [key,note] of exact)index.set(key,note)
  return index
}
export function resolveNote(target,index,source='') {
  const clean=target.replace(/\.(md|markdown)$/i,'').trim()
  if(clean==='')return index.get(normalizePersian(source))
  return index.get(normalizePersian(clean)) || index.get(normalizePersian(path.posix.join(path.posix.dirname(source),clean)))
}
export function canonicalizeWikiLinks(content, notes, source='') {
  const index=noteIndex(notes)
  return content.split(/(^```[^\n]*\n[\s\S]*?^```\s*$|^~~~[^\n]*\n[\s\S]*?^~~~\s*$|`[^`\n]+`)/gm).map((part,i)=>i%2?part:part.replace(/(?<!!)\[\[([^\]\n]+)\]\]/g,(_,inner)=>{
    const [destination,...labels]=inner.split('|')
    const [target,...heads]=destination.replace(/\\\|/g,'|').split('#')
    const note=resolveNote(target,index,source)
    const label=labels.join('|')||target||heads.join('#')
    return '[['+(note?.stem||target)+(heads.length?'#'+heads.join('#'):'')+'|'+label+']]'
  })).join('')
}
export function prefixedUrl(value) {
  if(typeof value!=='string')return value
  // Existing portfolio identity anchors belong to the main site's schema.
  if(value.startsWith(ORIGIN+'/#'))return value
  if(value.startsWith(ORIGIN))return ORIGIN+prefixedUrl(value.slice(ORIGIN.length)||'/')
  if(!value.startsWith('/')||value.startsWith('//'))return value
  if(/^\/(?:fa|hades)(?:\/|$)/.test(value)||value==='/hades.svg')return value
  return GARDEN_PATH+value.slice(1)
}
export function prefixData(value) {
  if(Array.isArray(value))return value.map(prefixData)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,val])=>[key.startsWith('/')?prefixedUrl(key):key,prefixData(val)]))
  return prefixedUrl(value)
}
export function prefixText(text,extension) {
  if(extension==='.json'){try{return JSON.stringify(prefixData(JSON.parse(text)))}catch{}}
  let output=text.replace(/https:\/\/ialirezaaa\.github\.io(\/(?!\/)[^\s"'<>`\\]*)?/g,(url)=>prefixedUrl(url))
  output=output.replace(/((?:href|src|action|poster|data-href)\s*=\s*["'])(\/[^"']*)(["'])/g,(_,a,url,b)=>a+prefixedUrl(url)+b)
  output=output.replace(/(url\(\s*["']?)(\/(?!\/)[^\s"')]+)(["']?\s*\))/g,(_,a,url,b)=>a+prefixedUrl(url)+b)
  output=output.replace(/(["'`])(\/(?!\/)[^\s"'`<>\\]+)\1/g,(_,quote,url)=>quote+prefixedUrl(url)+quote)
  output=output.replace(/("(?:url|homeAlias|permalink)"\s*:\s*)"\/"/g,'$1"'+GARDEN_PATH+'"')
  return output
}
export function manifestFor(notes) {
  const index=noteIndex(notes)
  const items=notes.map(note=>{
    const links=[...note.content.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)].map(m=>m[1].split('|')[0].split('#')[0]).map(target=>resolveNote(target,index,note.stem)).filter(Boolean).map(n=>prefixedUrl(n.frontmatter.permalink))
    const headings=[...note.content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>({title:m[1],id:headingId(m[1])}))
    return {id:note.frontmatter.id||path.posix.basename(note.stem),title:note.title,url:prefixedUrl(note.frontmatter.permalink),source:note.fileName,text:note.frontmatter.description,group:note.frontmatter.group||note.frontmatter.category||'یادداشت',tags:note.frontmatter.tags.filter(t=>!['note','gardenEntry'].includes(t)),aliases:note.aliases,links:[...new Set(links)],backlinks:[],headings,articleUrl:note.frontmatter.articleUrl||note.frontmatter.url||null,created:note.frontmatter.created||null,updated:note.frontmatter.updated||null,kind:note.frontmatter.kind||'note',hidden:note.frontmatter.hide===true,robots:note.frontmatter.metatags?.robots||'index, follow',canonical:note.frontmatter.canonical||null}
  })
  for(const item of items)item.backlinks=items.filter(n=>n.links.includes(item.url)).map(n=>n.url)
  return {version:2,generator:'oleeskild/digitalgarden',language:'fa',direction:'rtl',basePath:GARDEN_PATH,notes:items,urls:items.filter(n=>!n.robots.includes('noindex')&&(!n.canonical||n.canonical===ORIGIN+n.url||n.canonical===n.url)).map(n=>n.url)}
}

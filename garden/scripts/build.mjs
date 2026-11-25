import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {readNotes,walk,canonicalizeWikiLinks,manifestFor,prefixText,ORIGIN,BLOG_PATH,GARDEN_PATH} from './publishing.mjs'
import {publishedAssetPaths,listPublicAssetCandidates} from './public-assets.mjs'
const require=createRequire(import.meta.url)
const yaml=require('yaml')
const dotenv=require('dotenv')
const root=fileURLToPath(new URL('../',import.meta.url))
const hash=value=>createHash('sha256').update(value).digest('hex')

export function buildDigitalGarden(destination,extraNotes=[]) {
  const stage=path.join(root,'.cache','publish-stage')
  const output=path.resolve(destination||path.join(root,'dist'))
  const notes=readNotes(path.join(root,'src/site/notes'),extraNotes)
  const manifest=manifestFor(notes)
  const sourceHash=createHash('sha256').update(JSON.stringify(notes))
  for(const file of [...walk(path.join(root,'src')).filter(f=>!(f.includes('/site/notes/')&&/\.(md|markdown|canvas)$/.test(f))&&!f.includes('/_includes/plugins/')), ...walk(path.join(root,'scripts')),path.join(root,'.eleventy.js'),path.join(root,'garden.config.json'),path.join(root,'.env')].sort()){
    sourceHash.update(path.relative(root,file)).update(fs.readFileSync(file))
  }
  manifest.sourceDigest=sourceHash.digest('hex')
  fs.rmSync(stage,{recursive:true,force:true})
  fs.mkdirSync(stage,{recursive:true})
  for(const entry of ['src','.eleventy.js','.eleventyignore','package.json'])fs.cpSync(path.join(root,entry),path.join(stage,entry),{recursive:true,filter:source=>!source.includes('/__fixtures__/')&&!/\.test\.[cm]?js$/.test(source)})
  fs.symlinkSync(path.join(root,'node_modules'),path.join(stage,'node_modules'),'dir')
  const stagedNotes=path.join(stage,'src/site/notes')
  fs.rmSync(stagedNotes,{recursive:true,force:true});fs.mkdirSync(stagedNotes,{recursive:true})
  for(const file of ['notes.json','notes.11tydata.js'])fs.copyFileSync(path.join(root,'src/site/notes',file),path.join(stagedNotes,file))
  for(const note of notes){
    const target=path.join(stagedNotes,note.fileName);fs.mkdirSync(path.dirname(target),{recursive:true})
    fs.writeFileSync(target,'---\n'+yaml.stringify(note.frontmatter)+'---\n'+canonicalizeWikiLinks(note.content,notes,note.stem))
  }
  // Only references in explicitly published notes authorize user-media output.
  const userAssets=path.join(stage,'src/site/img/user')
  fs.rmSync(userAssets,{recursive:true,force:true})
  const sourceAssets=path.join(root,'src/site/img/user')
  const candidates=listPublicAssetCandidates(sourceAssets)
  const selected=new Set(notes.flatMap(note=>publishedAssetPaths(note,candidates)))
  for(const rel of selected){
    const source=path.join(sourceAssets,rel), dest=path.join(userAssets,rel)
    if(!fs.lstatSync(source).isFile())continue
    fs.mkdirSync(path.dirname(dest),{recursive:true})
    fs.copyFileSync(source,dest)
  }
  const defaults=JSON.parse(fs.readFileSync(path.join(root,'garden.config.json'),'utf8'))
  const settings=fs.existsSync(path.join(root,'.env'))?dotenv.parse(fs.readFileSync(path.join(root,'.env'))):{}
  const safeSettings=Object.fromEntries(Object.entries(settings).filter(([key])=>/^(?:dg[A-Z]|UI_|SHOW_|TIMESTAMP_FORMAT$|DATE_FORMAT$|NOTE_ICON_|STYLE_SETTINGS_|BASE_THEME$|THEME$|USE_FULL_RESOLUTION_IMAGES$|LOGO_HEIGHT$)/.test(key)))
  const env={...process.env,...defaults,...safeSettings,SITE_BASE_URL:ORIGIN,SITE_MAIN_LANGUAGE:'fa',SITE_NAME_HEADER:'وبلاگ هادس',ELEVENTY_ENV:'prod',NODE_ENV:'production',HADES_GARDEN_STAGED:'1'}
  for(const [key,value] of Object.entries(env))env[key]=String(value)
  execFileSync(process.execPath,[path.join(root,'node_modules/sass/sass.js'),'src/site/styles:dist/styles','--style=compressed','--quiet-deps'],{cwd:stage,env,stdio:'inherit'})
  execFileSync(process.execPath,[path.join(root,'node_modules/@11ty/eleventy/cmd.cjs')],{cwd:stage,env,stdio:'inherit'})
  const built=path.join(stage,'dist')
  const gardenOut=path.join(output,'fa/garden')
  fs.rmSync(gardenOut,{recursive:true,force:true});fs.mkdirSync(gardenOut,{recursive:true})
  const textTypes=new Set(['.html','.js','.css','.json','.xml','.svg','.webmanifest'])
  // Render the tree once, then reuse the finished markup. Every page gets a
  // usable no-JavaScript explorer without invoking the recursive macro per page.
  const renderedTree=fs.readFileSync(path.join(built,'filetree.html'),'utf8')
  const assets={}
  for(const file of walk(built)){
    const rel=path.relative(built,file).split(path.sep).join('/')
    const dest=path.join(rel.startsWith('fa/blog/')?output:gardenOut,rel)
    fs.mkdirSync(path.dirname(dest),{recursive:true})
    if(textTypes.has(path.extname(file))){
      let text=fs.readFileSync(file,'utf8')
      if(path.extname(file)==='.html')text=text.replace(/(<nav\b[^>]*\bdata-filetree(?:="")?[^>]*>)[\s\S]*?<\/nav>/g,(_,opening)=>opening+renderedTree+'</nav>')
      fs.writeFileSync(dest,prefixText(text,path.extname(file)))
    }else fs.copyFileSync(file,dest)
    assets['/'+path.relative(output,dest).split(path.sep).join('/')]=hash(fs.readFileSync(dest))
  }
  // Old note URLs remain functional compatibility redirects; only the blog routes
  // contain indexable content. Assets stay in the existing garden namespace.
  const redirects=Object.create(null)
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  for(const item of manifest.notes){
    if(!item.legacyUrl)continue
    const from=item.legacyUrl
    const target=from===GARDEN_PATH?BLOG_PATH:item.url
    const anchoredTarget=item.url
    const relative=from.slice(GARDEN_PATH.length)
    const dest=path.join(gardenOut,relative.endsWith('.html')?relative:path.join(relative,'index.html'))
    if(fs.existsSync(dest))throw new Error('Legacy redirect collides with generated asset: '+from)
    const safeTarget=escape(target)
    const script='const target=location.hash?'+JSON.stringify(anchoredTarget)+':'+JSON.stringify(target)+';location.replace(target+location.search+location.hash);'
    const html='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><link rel="canonical" href="'+escape(ORIGIN+target)+'"><meta http-equiv="refresh" content="0; url='+safeTarget+'"><title>انتقال به وبلاگ هادس</title></head><body><p>این نوشته به وبلاگ هادس منتقل شده است. <a href="'+safeTarget+'">باز کردن وبلاگ</a></p><script>'+script.replaceAll('<','\\u003c')+'</script></body></html>'
    fs.mkdirSync(path.dirname(dest),{recursive:true})
    fs.writeFileSync(dest,html)
    redirects[from]=target
    assets['/'+path.relative(output,dest).split(path.sep).join('/')]=hash(fs.readFileSync(dest))
  }
  manifest.redirects=redirects
  const graph=JSON.parse(fs.readFileSync(path.join(gardenOut,'graph.json'),'utf8'))
  for(const item of manifest.notes){const node=graph.nodes[item.url];if(node){item.links=node.outBound.filter(url=>Object.hasOwn(graph.nodes,url));item.backlinks=node.backLinks}}
  manifest.assets=assets
  fs.writeFileSync(path.join(gardenOut,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  console.log('Digital Garden: '+notes.length+' published pages, '+graph.links.length+' directed links; Unified public content at /fa/blog/; old note URLs redirect')
  return {urls:manifest.urls,manifest,graph}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildDigitalGarden(process.argv[2])

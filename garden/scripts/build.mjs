import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {readNotes,walk,canonicalizeWikiLinks,manifestFor,prefixText,ORIGIN} from './publishing.mjs'
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
  for(const note of notes)for(const match of note.content.matchAll(/\/img\/user\/([^\s"'<>\)\]]+)/g)){
    let rel;try{rel=decodeURIComponent(match[1].split(/[?#]/)[0])}catch{continue}
    if(rel.split('/').includes('..')||rel.includes('\\'))continue
    const source=path.join(root,'src/site/img/user',rel)
    if(fs.existsSync(source)&&fs.statSync(source).isFile()){const dest=path.join(userAssets,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest)}
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
  const assets={}
  for(const file of walk(built)){
    const rel=path.relative(built,file).split(path.sep).join('/')
    const dest=path.join(rel.startsWith('fa/blog/')?output:gardenOut,rel)
    fs.mkdirSync(path.dirname(dest),{recursive:true})
    if(textTypes.has(path.extname(file))){fs.writeFileSync(dest,prefixText(fs.readFileSync(file,'utf8'),path.extname(file)))}else fs.copyFileSync(file,dest)
    assets['/'+path.relative(output,dest).split(path.sep).join('/')]=hash(fs.readFileSync(dest))
  }
  const graph=JSON.parse(fs.readFileSync(path.join(gardenOut,'graph.json'),'utf8'))
  for(const item of manifest.notes){const node=graph.nodes[item.url];if(node){item.links=node.outBound.filter(url=>Object.hasOwn(graph.nodes,url));item.backlinks=node.backLinks}}
  manifest.assets=assets
  fs.writeFileSync(path.join(gardenOut,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  console.log('Digital Garden: '+notes.length+' published pages, '+graph.links.length+' directed links; Persian routes at /fa/garden/ and /fa/blog/')
  return {urls:manifest.urls,manifest,graph}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildDigitalGarden(process.argv[2])

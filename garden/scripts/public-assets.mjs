import fs from 'node:fs';
import path from 'node:path';

// Collect only assets referenced by explicitly published note bodies/properties.
// No basename guessing when multiple files match; never follow symlinks.
export function publishedAssetPaths(note,available){
  const known=new Set(available), chosen=new Set();
  const add=raw=>{
    let rel;
    try{rel=decodeURIComponent(String(raw).split(/[?#]/)[0]);}catch{return;}
    if(!rel||rel.startsWith('/')||rel.includes('\\')||rel.split('/').some(x=>!x||x==='.'||x==='..'))return;
    if(known.has(rel))chosen.add(rel);
  };
  const refs=value=>{
    for(const m of String(value).matchAll(/\/img\/user\/([^\s"'<>\)\]]+)/g))add(m[1]);
  };
  refs(note.content||'');
  function inspect(value){
    if(Array.isArray(value)){value.forEach(inspect);return;}
    if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){Object.values(value).forEach(inspect);return;}
    if(typeof value!=='string')return;
    refs(value);
    const match=value.trim().match(/^!?\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]$/);
    if(!match)return;
    const name=match[1].trim();
    if(!/\.(?:png|jpe?g|gif|webp|svg|avif)$/i.test(name)||name.includes('\\')||name.split('/').some(x=>!x||x==='.'||x==='..'))return;
    const matches=available.filter(p=>p===name||p.endsWith('/'+name));
    if(known.has(name))chosen.add(name);
    else if(matches.length===1)chosen.add(matches[0]);
  }
  inspect(note.frontmatter?.['dg-note-properties']);
  // Obsidian also stores published cover/image properties directly in YAML.
  for(const [key,value] of Object.entries(note.frontmatter||{})){
    if(/^(?:cover|image|thumbnail|banner|poster)$/i.test(key))inspect(value);
  }
  return [...chosen].sort();
}
export function listPublicAssetCandidates(root){
  if(!fs.existsSync(root))return [];
  const result=[];
  function scan(dir,prefix=''){
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const rel=prefix+ent.name;
      if(ent.isDirectory())scan(path.join(dir,ent.name),rel+'/');
      else if(ent.isFile())result.push(rel);
    }
  }
  scan(root);
  return result.sort();
}

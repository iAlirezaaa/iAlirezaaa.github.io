"""Build portable synthetic HADES native editing packs. PUBLIC REVIEW."""
from pathlib import Path
import io, json, hashlib, tempfile, subprocess, sys, zipfile
from PIL import Image
import cairosvg
root=Path(__file__).resolve().parent
source=root.parents[2]
sizes={'16x9':(1920,1080),'9x16':(1080,1920),'1x1':(1080,1080)}
sources={'16x9':'HADES_Threshold_30_PNG_PUBLIC_REVIEW.zip','9x16':'social-ratios/HADES_Lintel_9x16_30_PNG_PUBLIC_REVIEW.zip','1x1':'social-ratios/HADES_Aperture_1x1_30_PNG_PUBLIC_REVIEW.zip'}
def sha(x): return hashlib.sha256(x).hexdigest()
def prepare(ratio,folder):
    size=sizes[ratio]
    with zipfile.ZipFile(source/sources[ratio]) as z:
        assert z.testzip() is None
        names=sorted(n for n in z.namelist() if n.endswith('.png'))
        assert len(names)==len(set(names))==30
        frames=[z.read(n) for n in names]
    ext=[]
    for f in frames:
        im=Image.open(io.BytesIO(f)); im.load()
        assert im.size==size and im.mode=='RGBA'
        ext.append(im.getchannel('A').getextrema())
    assert ext[0]==ext[29]==(0,0) and ext[14]==ext[15]==(255,255)
    for shot in ('a','b'):
        cairosvg.svg2png(url=str(root/f'plate-{shot}.svg'),write_to=str(folder/f'{shot}.png'),output_width=size[0],output_height=size[1])
    outputs=[]
    with zipfile.ZipFile(folder/'alpha.zip','w',zipfile.ZIP_DEFLATED) as z:
        for i,f in enumerate(frames):
            name=f'frame_{i:04d}.png';z.writestr(name,f);outputs.append({'name':name,'sha256':sha(f)})
        z.writestr('project.json',json.dumps({'schema':'hades-batch-1','mode':'alpha','fps':24,'cut':[14,15],'dimensions':size,'outputs':outputs}))
    print('INPUT PASS',ratio,flush=True)
def main(dest):
    dest.mkdir(parents=True,exist_ok=True)
    for ratio in sizes:
        with tempfile.TemporaryDirectory() as t:
            t=Path(t);prepare(ratio,t)
            subprocess.run([sys.executable,str(root.parent/'hades_two_shots.py'),str(t/'alpha.zip'),str(t/'a.png'),str(t/'b.png'),'--out',str(t/'edit')],check=True)
            (t/'edit').rename(t/'relocated'); folder=t/'relocated'
            check='import bpy,sys,pathlib; p=pathlib.Path(sys.argv[1]); bpy.ops.wm.open_mainfile(filepath=str(p)); s=bpy.context.scene; a=sorted([x for x in s.sequence_editor.strips if x.channel==1],key=lambda x:x.frame_final_start); b=sorted([x for x in s.sequence_editor.strips if x.channel==2],key=lambda x:x.frame_final_start); assert [(x.frame_final_start,x.frame_final_end) for x in a]==[(1,16),(16,31)]; assert [(x.frame_final_start,x.frame_final_end) for x in b]==[(i,i+1) for i in range(1,31)]; assert all(x.directory.startswith("//") and (pathlib.Path(bpy.path.abspath(x.directory))/x.elements[0].filename).is_file() for x in a+b); assert s.render.fps==24 and s.frame_end==30; print("NATIVE RELOCATED PASS")'
            subprocess.run([sys.executable,'-c',check,str(folder/'HADES_Transition_REVIEW.blend')],check=True)
            (folder/'README.txt').write_text('PUBLIC REVIEW / NOT FINAL\nExtract all files; keep frames and plates beside the blend. Blender 4.4+; 24 fps; cut frame 16. Synthetic plates only.\n')
            files=[x for x in sorted(folder.rglob('*')) if x.is_file() and x.suffix!='.blend1']
            manifest={str(x.relative_to(folder)):sha(x.read_bytes()) for x in files}
            (folder/'SHA256.json').write_text(json.dumps(manifest,indent=2))
            out=dest/f'HADES_{ratio}_Portable_VSE_PUBLIC_REVIEW.zip'
            with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
                for f in files+[folder/'SHA256.json']:z.write(f,f.relative_to(folder))
            with zipfile.ZipFile(out) as z:
                assert z.testzip() is None and all(sha(z.read(k))==v for k,v in manifest.items())
            print('PORTABLE ZIP PASS',ratio,flush=True)
if __name__=='__main__':main(Path(sys.argv[1]))

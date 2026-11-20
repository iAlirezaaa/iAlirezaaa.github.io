#!/usr/bin/env python3
"""Render HADES Pattern 01 public REVIEW PNG, layered PSD, ZIP from one pinned SVG."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont
import hashlib, shutil, subprocess, sys, zipfile, xml.etree.ElementTree as ET
import cairosvg
SOURCE=Path(__file__).resolve().parent.parent/'public/hades/patterns/architectural-arc-01/Arc_01_Tile_REVIEW.svg'
OUT=Path(__file__).resolve().parent.parent/'dist/hades/patterns/architectural-arc-01'
EXPECTED='a356d36e18350898cc0f7decddcc25ad3e38e1aecd4dd271691f562d1fd51d10'
NS='{http://www.w3.org/2000/svg}'
def main():
 data=SOURCE.read_bytes()
 assert hashlib.sha256(data).hexdigest()==EXPECTED,'Source pattern SVG changed unexpectedly'
 assert OUT.is_dir(),'Vite must build site/public/hades first'
 cairosvg.svg2png(bytestring=data,write_to=str(OUT/'Arc_01_Tile_REVIEW.png'),output_width=1024,output_height=1024)
 tile=Image.open(OUT/'Arc_01_Tile_REVIEW.png').convert('RGB')
 edge=max(max(max(abs(a-b) for a,b in zip(tile.getpixel((0,y)),tile.getpixel((1023,y)))) for y in range(1024)), max(max(abs(a-b) for a,b in zip(tile.getpixel((x,0)),tile.getpixel((x,1023)))) for x in range(1024)))
 assert edge<=1,'Pattern tile has a visible seam'
 repeat=Image.new('RGB',(2048,2048))
 for x in (0,1024):
  for y in (0,1024):repeat.paste(tile,(x,y))
 repeat.save(OUT/'Arc_01_Repeat_2048_REVIEW.png',optimize=True)
 for name in ('background','lines','accent'):
  root=ET.fromstring(data)
  for child in list(root):
   bg=child.tag==NS+'rect'
   accent=child.get('id')=='vermilion-registration' or child.get('fill')=='#EF4B32'
   keep=bg if name=='background' else accent if name=='accent' else not(bg or accent)
   if not keep:root.remove(child)
  cairosvg.svg2png(bytestring=ET.tostring(root),write_to=str(OUT/('layer_'+name+'.png')),output_width=1024,output_height=1024)
 convert=shutil.which('magick') or shutil.which('convert')
 assert convert,'ImageMagick required for layered PSD'
 subprocess.run([convert,str(OUT/'Arc_01_Tile_REVIEW.png'),*[str(OUT/('layer_'+n+'.png')) for n in ('background','lines','accent')],'-depth','8',str(OUT/'Arc_01_Layered_REVIEW.psd')],check=True)
 assert (OUT/'Arc_01_Layered_REVIEW.psd').read_bytes()[:4]==b'8BPS'
 subprocess.run([convert,str(OUT/'Arc_01_Layered_REVIEW.psd')+'[0]',str(OUT/'psd_QA.png')],check=True)
 assert not ImageChops.difference(tile,Image.open(OUT/'psd_QA.png').convert('RGB')).getbbox(),'PSD composite differs'
 b=Image.new('RGB',(1250,690),'#0a0a09');d=ImageDraw.Draw(b)
 font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 def F(s):
  try:return ImageFont.truetype(font,s)
  except:return ImageFont.load_default()
 d.text((44,24),'HADES  /  ARCHITECTURAL ARC  /  01',font=F(25),fill='#e1d8c9')
 d.text((44,74),'REVIEW / CONCEPT  /  NO REPEATED LOGO',font=F(13),fill='#EF4B32')
 b.paste(tile.resize((460,460)),(40,135));b.paste(repeat.resize((460,460)),(545,135))
 d.text((40,605),'ONE SOURCE TILE',font=F(16),fill='#bbb0a2')
 d.text((545,605),'REPEATED 2 x 2',font=F(16),fill='#bbb0a2')
 d.text((1020,205),'SOURCE',font=F(13),fill='#d4c8b9');d.text((1020,245),'NO LOGO',font=F(13),fill='#EF4B32')
 b.save(OUT/'Arc_01_Review_Board_REVIEW.png',optimize=True)
 (OUT/'README_REVIEW.txt').write_text('HADES Pattern 01 REVIEW, not final brand approval. Decorative SVG is NOT a logo. Owner-approved accent: #EF4B32; neutral colors unapproved. Source SHA256: '+EXPECTED+'\n',encoding='utf8')
 with zipfile.ZipFile(OUT/'Arc_01_Review_Pack_REVIEW.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
  for p in ['Arc_01_Tile_REVIEW.svg','Arc_01_Engraving_Transparent_REVIEW.svg','Arc_01_Tile_REVIEW.png','Arc_01_Repeat_2048_REVIEW.png','Arc_01_Layered_REVIEW.psd','Arc_01_Review_Board_REVIEW.png','README_REVIEW.txt']:
   z.write(OUT/p,arcname=p)
 for p in ['psd_QA.png','layer_background.png','layer_lines.png','layer_accent.png']:
  (OUT/p).unlink(missing_ok=True)
 print('HADES Pattern01 assets generated; source SHA256 pinned; seamless edge <=1; PSD composite exact; ZIP verified')
if __name__=='__main__':main()

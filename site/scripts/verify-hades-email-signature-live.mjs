import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='https://ialirezaaa.github.io';
const files=[
{route:'/hades/library/HADES_Email_Signature_REVIEW.html',local:'hades/library/HADES_Email_Signature_REVIEW.html',type:'text/html'},
{route:'/hades/library/',local:null,token:'HADES_Email_Signature_REVIEW.html',type:'text/html'},
{route:'/hades/fa/library/',local:null,token:'HADES_Email_Signature_REVIEW.html',type:'text/html'},
{route:'/hades/brand-kit/logo-usage/',local:null,token:'HADES',type:'text/html'},
{route:'/hades/assets/IMG_7187(2).png',local:'hades/assets/IMG_7187(2).png',type:'image/png'}
];
const sha=b=>createHash('sha256').update(b).digest('hex');
const results=[];
await mkdir('artifacts/hades-signature-live',{recursive:true});
for(const f of files){
 let best={route:f.route,result:'OPEN',reason:'no successful HTTPS receipt'};
 const expected=f.local?sha(await readFile(f.local)):null;
 for(let attempt=1;attempt<=6;attempt++){
  try{
   const res=await fetch(root+f.route+'?hades_review='+Date.now(),{redirect:'follow',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(18000)});
   const data=Buffer.from(await res.arrayBuffer());
   const ct=res.headers.get('content-type')||'';
   const got=sha(data);const text=data.toString('utf8');
   const valid=res.status===200&&ct.includes(f.type)&&(f.local?got===expected:text.includes(f.token));
   best={route:f.route,status:res.status,content_type:ct,bytes:data.length,sha256:got,expected_sha256:expected,attempt,result:valid?'PASS':'OPEN',reason:valid?'verified actual public HTTPS body':expected?'deployed bytes differ from repository':'required link/reference missing'};
   if(valid)break;
  }catch(e){best={route:f.route,attempt,result:'OPEN',reason:String(e).slice(0,160)}}
  await new Promise(r=>setTimeout(r,4000));
 }
 results.push(best);
}
const passed=results.filter(x=>x.result==='PASS').length;
const report={status:passed===files.length?'PASS':'OPEN',passed,total:files.length,run_time:new Date().toISOString(),results,notice:'Only public HTTPS GET can establish live serving; source commit and Pages build are insufficient.'};
await writeFile('artifacts/hades-signature-live/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

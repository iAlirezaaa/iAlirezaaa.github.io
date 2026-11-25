// Public, canonical per-page GitHub issue threads. No secret, no write token,
// no tracking, no external request until the visitor chooses to load comments.
const REPO='iAlirezaaa/iAlirezaaa.github.io';
const GH='https://github.com/'+REPO+'/issues/';
const API='https://api.github.com/repos/'+REPO+'/issues/';
export function installBlogComments(root=document,request=globalThis.fetch.bind(globalThis)){
  const panel=root.querySelector('[data-blog-comments]');
  if(!panel)return;
  const issue=Number(panel.dataset.issue);
  if(!Number.isSafeInteger(issue)||issue<1)return;
  const load=panel.querySelector('[data-comments-load]'), status=panel.querySelector('[data-comments-status]'), list=panel.querySelector('[data-comments-list]');
  if(!load||!status||!list)return;
  let pending=false;
  load.hidden=false;
  load.addEventListener('click',async()=>{
    if(pending)return;
    pending=true;load.disabled=true;panel.setAttribute('aria-busy','true');
    status.textContent='در حال دریافت دیدگاه‌ها…';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await request(API+issue+'/comments?per_page=100',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json'}});
      if(!response.ok)throw Error('GitHub response '+response.status);
      const data=await response.json();
      if(!Array.isArray(data))throw Error('Invalid comments response');
      const fragment=root.createDocumentFragment();
      const number=new Intl.NumberFormat('fa-IR');
      const dateFormatter=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium'});
      let count=0;
      for(const comment of data){
        if(!Number.isSafeInteger(comment?.id)||comment.id<1||typeof comment.body!=='string')continue;
        const li=root.createElement('li'),meta=root.createElement('div'),author=root.createElement('bdi'),text=root.createElement('p');
        meta.className='blog-comment-meta';
        author.textContent=typeof comment.user?.login==='string'?comment.user.login:'کاربر GitHub';
        const date=new Date(comment.created_at);
        if(!Number.isNaN(date.getTime())){
          const time=root.createElement('time');time.dateTime=date.toISOString();time.textContent=dateFormatter.format(date);meta.append(author,time);
        }else meta.append(author);
        text.className='blog-comment-body';text.dir='auto';text.textContent=comment.body;
        const link=root.createElement('a');link.href=GH+issue+'#issuecomment-'+comment.id;link.target='_blank';link.rel='noopener noreferrer';link.textContent='مشاهده در GitHub';
        li.append(meta,text,link);fragment.append(li);count++;
      }
      list.replaceChildren(fragment);list.hidden=count===0;
      status.textContent=count?number.format(count)+' دیدگاه'+(data.length===100?'؛ برای همهٔ دیدگاه‌ها GitHub را باز کن.':''):'هنوز دیدگاهی ثبت نشده است.';
      load.textContent='به‌روزرسانی دیدگاه‌ها';
    }catch{
      status.textContent='دریافت دیدگاه‌ها ممکن نشد؛ از پیوند GitHub برای مشاهده یا ثبت نظر استفاده کن.';
    }finally{
      clearTimeout(timeout);pending=false;load.disabled=false;panel.removeAttribute('aria-busy');
    }
  });
}
if(typeof document!=='undefined')installBlogComments();

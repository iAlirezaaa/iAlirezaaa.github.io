import { useCallback, useEffect, useRef, useState } from 'react'
import Navigation from './Navigation'
import Atlas from './Atlas'
import Cursor from './Cursor'
import { email, profileUrl, projects, routes } from './data'
import { alternateLocaleUrl, isPersianPath, officialLinks, pathnameFor, translate } from './i18n'
import './App.css'
import './experiences.css'
import './localization.css'

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  return <time aria-label="Tehran local time">{now.toLocaleTimeString('en-GB', { timeZone:'Asia/Tehran' })}</time>
}

export default function App() {
  const [location, setLocation] = useState(window.location.pathname + window.location.search)
  const [menu, setMenu] = useState(null)
  const [moreContent, setMoreContent] = useState(false)
  const [motion, setMotion] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const frame = useRef(null)
  const rawPath = location.split('?')[0].replace(/\/$/, '') || '/'
  const isFa = isPersianPath(rawPath)
  const path = isFa ? rawPath.replace(/^\/fa(?=\/|$)/, '') || '/' : rawPath
  const tr = (value) => translate(value, isFa)
  const localPath = (value) => pathnameFor(value, isFa)
  const otherLanguage = alternateLocaleUrl(location, isFa)
  const current = routes.find(r => r[0] === path)
  useEffect(() => {
    const panel = frame.current
    const measure = () => setMoreContent(panel.scrollHeight - panel.scrollTop - panel.clientHeight > 4)
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    if (panel.firstElementChild) observer.observe(panel.firstElementChild)
    panel.addEventListener('scroll', measure, {passive:true})
    measure()
    return () => { observer.disconnect(); panel.removeEventListener('scroll', measure) }
  }, [location])
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? 'on' : 'off'
    return () => { delete document.documentElement.dataset.motion }
  }, [motion])
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setMotion(!preference.matches)
    preference.addEventListener('change', change)
    return () => preference.removeEventListener('change', change)
  }, [])
  const close = useCallback(() => setMenu(null), [])
  useEffect(() => { const pop = () => { setLocation(window.location.pathname + window.location.search); close() }; window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop) }, [close])
  useEffect(() => {
    document.documentElement.lang = isFa ? 'fa' : 'en'
    document.documentElement.dir = 'ltr' // Preserve the original frame composition; text panels supply their own direction.
    document.title = path === '/' ? (isFa ? 'علیرضا عسگرپور | Hades III' : 'Alireza Asgarpour | Hades III') : `${translate(current?.[1] || 'Lost record', isFa)} | ${isFa ? 'علیرضا عسگرپور' : 'Alireza Asgarpour'} | Hades III`
    frame.current?.focus({ preventScroll:true })
  }, [location, current, isFa, path])
  useEffect(() => {
    const keys = e => {
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); setMenu(v => v ? null : {x:innerWidth/2-170,y:innerHeight/2-245}) }
    }
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys)
  }, [])
  function navigate(e, href) {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0)) return
    e?.preventDefault(); history.pushState({}, '', href); setLocation(href); close()
  }
  function openMenu(e) { setMenu({ x:e.clientX || innerWidth/2-170, y:e.clientY || innerHeight/2-240 }) }
  return <div className="world" onContextMenu={e => { if (e.target.closest('input,textarea')) return; e.preventDefault(); openMenu(e) }}>
    <Cursor motion={motion}/>
    <div className="embers" aria-hidden="true">{Array.from({length:12},(_,i) => <span key={i} style={{'--index':i}}/>)}</div>
    <div className="floating-frame">
      <header className="frame-header"><a className="wordmark" href="/" onClick={e => navigate(e,'/')} aria-label="Hades III home">H · III</a><span className="owner">{isFa ? 'علیرضا عسگرپور' : 'ALIREZA ASGARPOUR'}</span><span className="page-label" dir="auto">{tr(current?.[1] || 'Lost record')}</span>{isFa && <a className="locale-toggle blog-entry" href="/fa/blog/">وبلاگ</a>}<a className="locale-toggle" href={otherLanguage} onClick={e => navigate(e, otherLanguage)} aria-label={isFa ? 'Switch to English' : 'نمایش فارسی'} lang={isFa ? 'en' : 'fa'}>{isFa ? 'EN' : 'فا'}</a><Clock/></header>
      <main ref={frame} tabIndex="-1" dir={isFa ? 'rtl' : 'ltr'} className={`viewport ${path === '/' ? 'is-home' : ''}`} key={location}>
        {path === '/' ? <Home navigate={navigate} tr={tr} localPath={localPath} isFa={isFa}/> : path === '/systems' ? <Atlas navigate={navigate} motion={motion} tr={tr} localPath={localPath} isFa={isFa}/> : path === '/about' ? <About navigate={navigate} tr={tr} localPath={localPath} isFa={isFa}/> : path === '/work' ? <Work location={location} navigate={navigate} tr={tr} localPath={localPath} isFa={isFa}/> : path === '/contact' ? <Contact tr={tr} isFa={isFa}/> : <section className="page"><Intro n="404" tr={tr} title={tr('A lost record.')}/><a href={localPath('/')} onClick={e => navigate(e,localPath('/'))}>{tr('Return to identity')} ↗</a></section>}
      </main>
      <footer className="frame-footer"><button onClick={openMenu} aria-haspopup="dialog" aria-expanded={!!menu} className="menu-trigger"><span className="menu-glyph" aria-hidden="true">⌘</span><span>{tr('RIGHT-CLICK TO NAVIGATE')}</span><kbd>CTRL K</kbd></button><button className="motion-toggle" aria-pressed={motion} aria-label={tr('Ambient motion')} onClick={() => setMotion(v => !v)}><i/> {tr('MOTION')} {motion ? tr('ON') : tr('OFF')}</button>{moreContent ? <button className="realm-status scroll-cue" aria-label={tr('Explore more on this page')} onClick={() => frame.current.scrollBy({top:frame.current.clientHeight*.75,behavior:motion ? 'smooth' : 'instant'})}>{tr('EXPLORE BELOW')} <b aria-hidden="true">↓</b></button> : <span className="realm-status"><i/> {tr('REALM ONLINE')}</span>}</footer>
    </div>
    <span className="world-caption">{tr('A PERSONAL REALM BY ALIREZA ASGARPOUR')}</span>
    {menu && <Navigation position={menu} path={path} close={close} navigate={navigate} tr={tr} localPath={localPath} isFa={isFa}/>}
  </div>
}

function Home({ navigate, tr, localPath, isFa }) {
  return <section className="identity-page"><div className="roman-watermark" aria-hidden="true">III</div><p className="eyebrow">{tr('THE CURRENT RULER · EST. HADES')}</p><h1 className="identity-name">{isFa ? 'علیرضا عسگرپور' : 'ALIREZA'}<br/><span>“HADES”</span></h1><p className="identity-statement">{isFa ? tr('Turning myth, memory, and technology into cinematic worlds.') : <>Turning myth, memory, and technology<br className="desktop-break"/> into cinematic worlds.</>}</p><a className="home-invitation" href={localPath('/contact')} onClick={e => navigate(e,localPath('/contact'))}>{tr('EXPLORE WHAT WE CAN BUILD')} <span>↗</span></a><div className="identity-metrics"><div><strong>6+</strong><span>{tr('YEARS')}</span></div><div><strong>10+</strong><span>{tr('PROJECTS')}</span></div><div><strong>AI</strong><span>{tr('DIRECTOR')}</span></div><div><strong>{tr('Tehran')}</strong><span>{tr('IRAN')}</span></div></div></section>
}
function Intro({ n, title, copy, tr = (value) => value }) { return <div className="intro"><p className="eyebrow">{n} / {tr('THE HADES ARCHIVE')}</p><h1>{title}</h1>{copy && <p>{copy}</p>}</div> }
function About({ navigate, tr, localPath, isFa }) {
  return <section className="page"><Intro n="01" tr={tr} title={isFa ? <>ذهن پشت<br/><i>تصویر.</i></> : <>The mind behind<br/>the <i>image.</i></>}/><div className="about-layout"><div className="about-story"><p className="lead">{tr('Alireza Asgarpour')}</p><p>{tr('AI-Driven Animation Director & Production Specialist')}</p><p>{tr('I bring story, production and creative technology into a shared process. My interests span animation, worldbuilding, project control and the design of AI workflows.')}</p><blockquote>{tr('Creative control begins with a clear intention.')}</blockquote><a className="text-link" href={localPath('/work')} onClick={e => navigate(e,localPath('/work'))}>{tr('Explore the archive')} ↗</a></div><dl className="facts"><div><dt>{tr('STUDIO EXPERIENCE')}</dt><dd>{tr('SKYFRAME Animation Studio')}</dd></div><div><dt>{tr('EDUCATION')}</dt><dd>{tr('Soore University')}<small>2018 – 2022</small></dd></div><div><dt>{tr('LANGUAGES')}</dt><dd>{tr('Persian · Azerbaijani Turkish')}<small>{tr('English: professional · French: elementary')}</small></dd></div><div><dt>{tr('THREE DISCIPLINES')}</dt><dd>{tr('Animation / Systems / Myth')}</dd></div></dl></div><a className="source-link" href={profileUrl} target="_blank" rel="noreferrer">{tr('Professional background: LinkedIn')} ↗</a><PracticeLens tr={tr} isFa={isFa}/></section>
}
function Work({ location, navigate, tr, localPath, isFa }) {
  const initial = new URLSearchParams(location.split('?')[1]).get('project')
  const [selected, select] = useState(projects.find(p => p.id === initial)?.id || projects[0].id)
  const [filter, setFilter] = useState('All')
  const list = projects.filter(p => filter === 'All' || p.discipline === filter)
  const project = projects.find(p => p.id === selected)
  function changeFilter(value) { setFilter(value); const available = projects.filter(p => value === 'All' || p.discipline === value); if (!available.some(p => p.id === selected)) select(available[0].id) }
  return <section className="page work-page"><Intro n="02" tr={tr} title={isFa ? <>ردّ <i>آثار.</i></> : <>Work leaves a <i>trace.</i></>}/><div className="filters" aria-label={tr('Filter projects')}>{['All','Production','AI & design','Direction'].map(value => <button key={value} onClick={() => changeFilter(value)} aria-pressed={filter === value}>{tr(value)}</button>)}<span>{list.length.toString().padStart(2,'0')} {tr('RECORDS')}</span></div><div className="work-layout"><div className="work-list">{list.map((p,i) => <button key={p.id} aria-pressed={selected === p.id} onClick={() => select(p.id)}><small>0{i+1}</small><span>{p.title}<em>{tr(p.kind)}</em></span><b>↗</b></button>)}</div><article className="work-record" key={selected}><div className={`project-art art-${project.id}`} aria-hidden="true"><span>{project.id === 'dolphin' ? 'II' : project.id === 'dragon' ? 'IX' : project.id === 'parkophobia' ? 'AI' : 'III'}</span><small>{tr('ARCHIVE STUDY')} / {tr(project.kind)}</small></div><span className="record-date">{tr(project.date)}</span><h2>{project.title}</h2><h3>{tr(project.role)}</h3><p>{tr(project.text)}</p><p className="record-note">{tr(project.note)}</p><a className="text-link project-next" href={localPath('/contact')} onClick={e => navigate(e, localPath('/contact'))}>{tr('Discuss a related challenge')} ↗</a><a className="source-link" href={profileUrl} target="_blank" rel="noreferrer">{tr('View source record')} ↗</a></article></div></section>
}
const realm = [
  ['Hades','The realm','A narrative ecosystem. Stories, visuals and systems belong to one world.'],
  ['Hades III','The signature','Alireza: the current ruler and creative voice of the realm.'],
  ['Mythos','The archive','A framework for symbols, memory and the rules of cinematic worlds.'],
  ['Orpheus','The orchestration','An envisioned tool layer for connecting intent, process and recall.'],
]
// Retained as an internal visual reference while the public navigation stays focused.
// eslint-disable-next-line no-unused-vars
function Universe({ navigate }) {
  const [active,setActive] = useState(0)
  return <section className="page"><Intro n="04" title={<>Everything has <i>meaning.</i></>} copy="Four names. One connected world."/><div className="universe-layout"><div className={`realm-seal seal-${active}`} aria-hidden="true"><div className="seal-ring"/><div className="seal-ring second"/><span key={active}>{['H','III','M','O'][active]}</span><small>{realm[active][1]}</small></div><div className="realm-entries">{realm.map(([name,type,text],i) => <div key={name} className={active === i ? 'open' : ''}><button onClick={() => setActive(i)} aria-expanded={active === i} aria-controls={`realm-${i}`}><small>0{i+1}</small><span>{name}</span><em>{type}</em><b>{active === i ? '−' : '+'}</b></button><p id={`realm-${i}`} hidden={active !== i}>{text}</p></div>)}</div></div><div className="realm-next"><p className="realm-thesis">A world gains depth when its rules connect.</p><a className="text-link" href="/services?focus=world" onClick={e => navigate(e,'/services?focus=world')}>Develop a world of your own ↗</a></div></section>
}
// Retained as an internal visual reference while the public navigation stays focused.
// eslint-disable-next-line no-unused-vars
function Dossier() {
  return <section className="page dossier"><div className="dossier-top"><p className="eyebrow">05 / PROFESSIONAL RECORD</p><button className="text-link" onClick={() => window.print()}>Print / Save PDF ↗</button></div><h1>Alireza<br/><i>Asgarpour.</i></h1><p className="dossier-role">AI-Driven Animation Director & Production Specialist</p><div className="dossier-body"><div><h2>Practice</h2><p>Animation production, direction support, AI workflow design and cinematic worldbuilding.</p><h2>Background</h2><p>SKYFRAME Animation Studio<br/>Soore University · 2018 – 2022</p><h2>Contact</h2><a href={`mailto:${email}`}>{email}</a><br/><a href={profileUrl}>linkedin.com/in/ialirezaaa</a></div><div><h2>Selected records</h2>{projects.map(p => <div className="cv-row" key={p.id}><span>{p.title}<small>{p.role}</small></span><time>{p.date}</time></div>)}</div></div><p className="source-link">Project dates reflect public profile records, not current production status.</p></section>
}
function Contact({ tr, isFa }) {
  const [draft,setDraft] = useState(null)
  const [copied,setCopied] = useState(false)
  const [copyError,setCopyError] = useState(false)
  async function copy() { try { await navigator.clipboard.writeText(draft || email); setCopied(true); setCopyError(false) } catch { setCopyError(true) } }
  function prepare(e) { e.preventDefault(); const data = new FormData(e.currentTarget); setDraft(`From: ${data.get('name')}\nReply to: ${data.get('email')}\n\n${data.get('message')}`); setCopied(false) }
  return <section className="page"><Intro n="05" tr={tr} title={isFa ? <>روایتی تازه <i>بیافرینیم.</i></> : <>Begin a new <i>narrative.</i></>} copy={tr('For animation direction, production clarity and AI-assisted creative systems.')}/><div className="contact-grid"><div className="contact-aside"><span className="eyebrow">{tr('DIRECT CHANNEL')}</span><a href={`mailto:${email}`} className="contact-email">asgarpour.alireza<br/>@gmail.com</a><p>{tr('Share the project, the constraint or the question. I will reply with a clear place to begin.')}</p></div><form onSubmit={prepare} className="contact-form"><div className="form-pair"><label>{tr('Your name')}<input name="name" autoComplete="name" required placeholder={tr('Name')}/></label><label>{tr('Your email')}<input type="email" name="email" autoComplete="email" required placeholder="you@example.com"/></label></div><label>{tr('The idea')}<textarea name="message" required rows="4" placeholder={tr('What are you making, and where is it stuck?')}/></label><button className="primary-button" type="submit">{tr('Prepare transmission')} <span>↗</span></button><p className="form-explainer">{tr('Prepare a draft, then send it with your email app.')}</p>{draft && <div className="draft-panel" role="status"><p>{tr('Your draft is ready. Nothing has been sent yet.')}</p><a className="text-link" href={`mailto:${email}?subject=${encodeURIComponent('A new narrative / Hades III')}&body=${encodeURIComponent(draft)}`}>{tr('Open email app')} ↗</a><button className="text-link" type="button" onClick={copy}>{tr(copied ? 'Copied' : 'Copy draft')}</button>{copyError && <p>{tr('Copy the draft below:')}</p>}<details><summary>{tr('Review draft')}</summary><pre>{draft}</pre></details></div>}</form></div>
    <div className="contact-profiles" aria-label={tr('Official profiles')}>
      <p className="eyebrow">{tr('Official profiles')}</p>
      <div className="contact-profiles-grid">
        {officialLinks.map((link, i) => <a className="contact-profile-card" href={link.href} key={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${link.name}: ${link.handle}`}>
          <small className="contact-profile-counter">{String(i + 1).padStart(2, '0')}</small>
          <span className="contact-profile-main"><strong className="contact-profile-name">{tr(link.name)}</strong><small className="contact-profile-handle" dir="ltr">{link.handle}</small></span>
          <span className="contact-profile-arrow" aria-hidden="true">↗</span>
        </a>)}
      </div>
      <p className="contact-profiles-note">{tr('Only these public accounts are linked from this website.')}</p>
    </div>
  </section>
}

function PracticeLens({ tr, isFa }) {
  const [active, setActive] = useState(0)
  const lenses = [
    ['Intention', 'What should the audience feel?', 'Define the emotional purpose before choosing a style, a tool or a production technique. A clear brief gives every later decision a reference point.'],
    ['Continuity', 'What must remain consistent?', 'Build shared references for characters, tone and visual rules. Record the reason behind revisions so the next iteration can move forward with context.'],
    ['Judgement', 'What is worth keeping?', 'Review AI-generated options against the story and the constraints of the project. Selection and refinement turn exploration into a usable direction.'],
  ]
  return <section className="practice-lens"><div><p className="eyebrow">{tr('A WAY OF WORKING')}</p><h2>{isFa ? <>سه پرسش<br/>پیش از فریم بعدی.</> : <>Three questions<br/>before the next frame.</>}</h2><div className="lens-controls">{lenses.map(([name],i) => <button key={name} aria-pressed={active === i} onClick={() => setActive(i)}>{tr(name)}</button>)}</div></div><article key={active} aria-live="polite"><span>0{active+1} / {tr(lenses[active][0])}</span><h3>{tr(lenses[active][1])}</h3><p>{tr(lenses[active][2])}</p></article></section>
}

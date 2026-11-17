import { useCallback, useEffect, useRef, useState } from 'react'
import Navigation from './Navigation'
import Atlas from './Atlas'
import Cursor from './Cursor'
import { email, profileUrl, projects, routes } from './data'
import './App.css'
import './experiences.css'

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
  const path = rawPath === '/fa' ? '/' : rawPath
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
  useEffect(() => { document.title = `${current?.[1] || 'Lost record'} | Hades III`; frame.current?.focus({ preventScroll:true }) }, [location, current])
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
      <header className="frame-header"><a className="wordmark" href="/" onClick={e => navigate(e,'/')} aria-label="Hades III home">H · III</a><span className="owner">ALIREZA ASGARPOUR</span><span className="page-label">{current?.[1] || 'Lost record'}</span><Clock/></header>
      <main ref={frame} tabIndex="-1" className={`viewport ${path === '/' ? 'is-home' : ''}`} key={location}>
        {path === '/' ? <Home navigate={navigate}/> : path === '/systems' ? <Atlas navigate={navigate} motion={motion}/> : path === '/about' ? <About navigate={navigate}/> : path === '/work' ? <Work location={location} navigate={navigate}/> : path === '/contact' ? <Contact/> : <section className="page"><Intro n="404" title="A lost record."/><a href="/" onClick={e => navigate(e,'/')}>Return to identity ↗</a></section>}
      </main>
      <footer className="frame-footer"><button onClick={openMenu} aria-haspopup="dialog" aria-expanded={!!menu} className="menu-trigger"><span className="menu-glyph" aria-hidden="true">⌘</span><span>RIGHT-CLICK TO NAVIGATE</span><kbd>CTRL K</kbd></button><button className="motion-toggle" aria-pressed={motion} aria-label="Ambient motion" onClick={() => setMotion(v => !v)}><i/> MOTION {motion ? 'ON' : 'OFF'}</button>{moreContent ? <button className="realm-status scroll-cue" aria-label="Explore more on this page" onClick={() => frame.current.scrollBy({top:frame.current.clientHeight*.75,behavior:motion ? 'smooth' : 'instant'})}>EXPLORE BELOW <b aria-hidden="true">↓</b></button> : <span className="realm-status"><i/> REALM ONLINE</span>}</footer>
    </div>
    <span className="world-caption">A PERSONAL REALM BY ALIREZA ASGARPOUR</span>
    {menu && <Navigation position={menu} path={path} close={close} navigate={navigate}/>}
  </div>
}

function Home({ navigate }) {
  return <section className="identity-page"><div className="roman-watermark" aria-hidden="true">III</div><p className="eyebrow">THE CURRENT RULER · EST. HADES</p><h1 className="identity-name">ALIREZA<br/><span>“HADES”</span></h1><p className="identity-statement">Turning myth, memory, and technology<br className="desktop-break"/> into cinematic worlds.</p><a className="home-invitation" href="/contact" onClick={e => navigate(e,'/contact')}>EXPLORE WHAT WE CAN BUILD <span>↗</span></a><div className="identity-metrics"><div><strong>6+</strong><span>YEARS</span></div><div><strong>10+</strong><span>PROJECTS</span></div><div><strong>AI</strong><span>DIRECTOR</span></div><div><strong>Tehran</strong><span>IRAN</span></div></div></section>
}
function Intro({ n, title, copy }) { return <div className="intro"><p className="eyebrow">{n} / THE HADES ARCHIVE</p><h1>{title}</h1>{copy && <p>{copy}</p>}</div> }
function About({ navigate }) {
  return <section className="page"><Intro n="01" title={<>The mind behind<br/>the <i>image.</i></>}/><div className="about-layout"><div className="about-story"><p className="lead">Alireza Asgarpour</p><p>AI-Driven Animation Director & Production Specialist</p><p>I bring story, production and creative technology into a shared process. My interests span animation, worldbuilding, project control and the design of AI workflows.</p><blockquote>Creative control begins with a clear intention.</blockquote><a className="text-link" href="/work" onClick={e => navigate(e,'/work')}>Explore the archive ↗</a></div><dl className="facts"><div><dt>STUDIO EXPERIENCE</dt><dd>SKYFRAME Animation Studio</dd></div><div><dt>EDUCATION</dt><dd>Soore University<small>2018 – 2022</small></dd></div><div><dt>LANGUAGES</dt><dd>Persian · Azerbaijani Turkish<small>English: professional · French: elementary</small></dd></div><div><dt>THREE DISCIPLINES</dt><dd>Animation / Systems / Myth</dd></div></dl></div><a className="source-link" href={profileUrl} target="_blank" rel="noreferrer">Professional background: LinkedIn ↗</a><PracticeLens/></section>
}
function Work({ location, navigate }) {
  const initial = new URLSearchParams(location.split('?')[1]).get('project')
  const [selected, select] = useState(projects.find(p => p.id === initial)?.id || projects[0].id)
  const [filter, setFilter] = useState('All')
  const list = projects.filter(p => filter === 'All' || p.discipline === filter)
  const project = projects.find(p => p.id === selected)
  function changeFilter(value) { setFilter(value); const available = projects.filter(p => value === 'All' || p.discipline === value); if (!available.some(p => p.id === selected)) select(available[0].id) }
  return <section className="page work-page"><Intro n="02" title={<>Work leaves a <i>trace.</i></>}/><div className="filters" aria-label="Filter projects">{['All','Production','AI & design','Direction'].map(value => <button key={value} onClick={() => changeFilter(value)} aria-pressed={filter === value}>{value}</button>)}<span>{list.length.toString().padStart(2,'0')} RECORDS</span></div><div className="work-layout"><div className="work-list">{list.map((p,i) => <button key={p.id} aria-pressed={selected === p.id} onClick={() => select(p.id)}><small>0{i+1}</small><span>{p.title}<em>{p.kind}</em></span><b>↗</b></button>)}</div><article className="work-record" key={selected}><div className={`project-art art-${project.id}`} aria-hidden="true"><span>{project.id === 'dolphin' ? 'II' : project.id === 'dragon' ? 'IX' : project.id === 'parkophobia' ? 'AI' : 'III'}</span><small>ARCHIVE STUDY / {project.kind.toUpperCase()}</small></div><span className="record-date">{project.date}</span><h2>{project.title}</h2><h3>{project.role}</h3><p>{project.text}</p><p className="record-note">{project.note}</p><a className="text-link project-next" href="/contact" onClick={e => navigate(e, '/contact')}>Discuss a related challenge ↗</a><a className="source-link" href={profileUrl} target="_blank" rel="noreferrer">View source record ↗</a></article></div></section>
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
function Contact() {
  const [draft,setDraft] = useState(null)
  const [copied,setCopied] = useState(false)
  const [copyError,setCopyError] = useState(false)
  async function copy() { try { await navigator.clipboard.writeText(draft || email); setCopied(true); setCopyError(false) } catch { setCopyError(true) } }
  function prepare(e) { e.preventDefault(); const data = new FormData(e.currentTarget); setDraft(`From: ${data.get('name')}\nReply to: ${data.get('email')}\n\n${data.get('message')}`); setCopied(false) }
  return <section className="page"><Intro n="05" title={<>Begin a new <i>narrative.</i></>} copy="For animation direction, production clarity and AI-assisted creative systems."/><div className="contact-grid"><div className="contact-aside"><span className="eyebrow">DIRECT CHANNEL</span><a href={`mailto:${email}`} className="contact-email">asgarpour.alireza<br/>@gmail.com</a><a className="text-link" href={profileUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a><p>Share the project, the constraint or the question. I will reply with a clear place to begin.</p></div><form onSubmit={prepare} className="contact-form"><div className="form-pair"><label>Your name<input name="name" autoComplete="name" required placeholder="Name"/></label><label>Your email<input type="email" name="email" autoComplete="email" required placeholder="you@example.com"/></label></div><label>The idea<textarea name="message" required rows="4" placeholder="What are you making, and where is it stuck?"/></label><button className="primary-button" type="submit">Prepare transmission <span>↗</span></button><p className="form-explainer">Prepare a draft, then send it with your email app.</p>{draft && <div className="draft-panel" role="status"><p>Your draft is ready. Nothing has been sent yet.</p><a className="text-link" href={`mailto:${email}?subject=${encodeURIComponent('A new narrative / Hades III')}&body=${encodeURIComponent(draft)}`}>Open email app ↗</a><button className="text-link" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy draft'}</button>{copyError && <p>Copy the draft below:</p>}<details><summary>Review draft</summary><pre>{draft}</pre></details></div>}</form></div></section>
}

function PracticeLens() {
  const [active, setActive] = useState(0)
  const lenses = [
    ['Intention', 'What should the audience feel?', 'Define the emotional purpose before choosing a style, a tool or a production technique. A clear brief gives every later decision a reference point.'],
    ['Continuity', 'What must remain consistent?', 'Build shared references for characters, tone and visual rules. Record the reason behind revisions so the next iteration can move forward with context.'],
    ['Judgement', 'What is worth keeping?', 'Review AI-generated options against the story and the constraints of the project. Selection and refinement turn exploration into a usable direction.'],
  ]
  return <section className="practice-lens"><div><p className="eyebrow">A WAY OF WORKING</p><h2>Three questions<br/>before the next frame.</h2><div className="lens-controls">{lenses.map(([name],i) => <button key={name} aria-pressed={active === i} onClick={() => setActive(i)}>{name}</button>)}</div></div><article key={active} aria-live="polite"><span>0{active+1} / {lenses[active][0].toUpperCase()}</span><h3>{lenses[active][1]}</h3><p>{lenses[active][2]}</p></article></section>
}

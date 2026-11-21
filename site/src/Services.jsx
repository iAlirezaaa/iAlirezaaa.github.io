import { useState } from 'react'

import { services, phases } from './services-data'

export default function Services({ navigate, location }) {
  const requested = new URLSearchParams(location.split('?')[1]).get('focus')
  const [active,setActive] = useState(services.some(s => s.id === requested) ? requested : 'film')
  const [stage,setStage] = useState('idea')
  const [expanded,setExpanded] = useState(false)
  const service = services.find(s => s.id === active)
  const phase = phases.find(p => p.id === stage)
  const contact = `/contact?focus=${service.id}&stage=${phase.id}`
  return <section className="page services-page"><div className="intro"><p className="eyebrow">07 / POSSIBLE COLLABORATIONS</p><h1>What could we <i>build?</i></h1><p>Choose a direction. Explore a possible scope for your project.</p></div>
    <fieldset className="service-selector"><legend>01 / YOUR AMBITION</legend>{services.map((s,i) => <button key={s.id} type="button" aria-pressed={active === s.id} onClick={() => {setActive(s.id);setExpanded(false)}}><small>0{i+1}</small><span>{s.short}</span><b>↗</b></button>)}</fieldset>
    <div className="service-layout"><div className="service-plan" key={active}><span className="service-question">{service.question}</span><h2>{service.title}</h2><p>{service.description}</p><h3>POSSIBLE DELIVERABLES</h3><ul>{service.outputs.map((output,i) => <li key={output} style={{'--step':i}}><span>0{i+1}</span>{output}</li>)}</ul><button className="ai-toggle" type="button" aria-expanded={expanded} aria-controls="ai-approach" onClick={() => setExpanded(v => !v)}>Where AI can help <b>{expanded ? '−' : '+'}</b></button><div id="ai-approach" hidden={!expanded}><p className="ai-approach">{service.ai}</p></div></div>
    <aside className="scope-panel"><fieldset><legend>02 / WHERE YOU ARE</legend>{phases.map(p => <label key={p.id}><input type="radio" name="project-stage" checked={stage === p.id} onChange={() => setStage(p.id)}/><span>{p.label}</span></label>)}</fieldset><div className="scope-stage" key={stage} aria-live="polite"><span>THE STARTING POINT</span><p>{phase.detail}</p></div><div><span>BRING TO THE CONVERSATION</span><p>{service.input}</p></div><div><span>THE HANDOFF</span><p>{service.handoff}</p></div><a className="primary-button" href={contact} onClick={e => navigate(e,contact)}>Build my project brief <b>↗</b></a><p className="scope-note">A suggested starting scope. Deliverables and feasibility are agreed together.</p></aside></div>
  </section>
}

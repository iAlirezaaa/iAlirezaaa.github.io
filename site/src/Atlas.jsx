import { useEffect, useRef, useState } from 'react'
import { graphNodes as nodes, graphEdges as edges } from './data'

export default function Atlas({ navigate, motion }) {
  const [selected, select] = useState('hades')
  const [touring, setTouring] = useState(false)
  useEffect(() => {
    if (!touring || !motion) return
    const itinerary = ['hades','production','dolphin','style','intelligence','parkophobia','narrative','mythos']
    let index = 0
    const timer = setInterval(() => { index = (index+1)%itinerary.length; select(itinerary[index]) }, 4200)
    return () => clearInterval(timer)
  }, [touring, motion])
  function choose(id) { setTouring(false); select(id) }
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x:0, y:0 })
  const drag = useRef(null)
  const node = nodes.find(n => n.id === selected)
  const neighbors = edges.filter(e => e.includes(selected)).map(e => e.find(id => id !== selected))
  function move(e) {
    if (!drag.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = Math.max(800 / rect.width, 520 / rect.height)
    setPan({ x:drag.current.x + (e.clientX - drag.current.clientX) * scale, y:drag.current.y + (e.clientY - drag.current.clientY) * scale })
  }
  return <section className="atlas-page">
    <div className="atlas-heading"><div><p className="eyebrow">03 / CONNECTED INTELLIGENCE</p><h1>Neural <i>atlas.</i></h1></div><span className="atlas-count">{nodes.length} NODES<br />{edges.length} CONNECTIONS</span></div>
    <div className="atlas-layout">
      <div className="graph-stage">
        <svg className="graph" viewBox="0 0 800 520" aria-label="Interactive map of projects and creative principles" onPointerDown={e => { if (e.target.closest('[data-node]')) return; drag.current = { ...pan, clientX:e.clientX, clientY:e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
          <defs><radialGradient id="planet"><stop stopColor="#463027" stopOpacity=".38" /><stop offset=".65" stopColor="#271c18" stopOpacity=".18"/><stop offset="1" stopColor="#171513" stopOpacity="0"/></radialGradient></defs>
          <g transform={`translate(${pan.x} ${pan.y}) translate(400 260) scale(${zoom}) translate(-400 -260)`}>
            <g className="planet-orbits" aria-hidden="true"><circle cx="400" cy="260" r="233" fill="url(#planet)"/><circle cx="400" cy="260" r="228"/><ellipse cx="400" cy="260" rx="228" ry="82" transform="rotate(-28 400 260)"/><ellipse cx="400" cy="260" rx="112" ry="228" transform="rotate(-28 400 260)"/><ellipse cx="400" cy="260" rx="228" ry="153" transform="rotate(32 400 260)"/></g>
            <g aria-hidden="true">{edges.map(([a,b], i) => { const from = nodes.find(n => n.id === a), to = nodes.find(n => n.id === b); const active = [a,b].includes(selected); return <g key={`${a}-${b}`} className={active ? 'connection lit' : 'connection'}><path id={`edge-${i}`} d={`M${from.x},${from.y} Q${(from.x + to.x)/2 + (i%2 ? 15 : -15)},${(from.y + to.y)/2-14} ${to.x},${to.y}`} />{active && motion && <circle className="signal" r="2"><animateMotion dur={`${3+i%3}s`} repeatCount="indefinite"><mpath href={`#edge-${i}`}/></animateMotion></circle>}</g> })}</g>
            {nodes.map(n => { const active = n.id === selected; const connected = active || neighbors.includes(n.id); return <g key={n.id} data-node={n.id} role="button" tabIndex="0" aria-label={`Explore ${n.label}`} aria-pressed={active} className={`graph-node ${n.group} ${active ? 'selected' : ''} ${connected ? 'connected' : 'dimmed'}`} transform={`translate(${n.x},${n.y})`} onClick={() => choose(n.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(n.id) } }}>
              <circle className="node-target" r="23"/><circle className="node-halo" r={n.id === 'hades' ? 28 : 16}/><circle className="node-dot" r={n.id === 'hades' ? 9 : n.group === 'practice' ? 5 : 3.5}/><text y={n.id === 'hades' ? 47 : 27} textAnchor="middle">{n.label}</text>
            </g> })}
          </g>
        </svg>
        <div className="graph-controls"><button onClick={() => setZoom(v => Math.max(.7, v - .15))} aria-label="Zoom out">−</button><span>{Math.round(zoom*100)}%</span><button onClick={() => setZoom(v => Math.min(1.8, v + .15))} aria-label="Zoom in">+</button><button onClick={() => { setZoom(1); setPan({x:0,y:0}); choose('hades') }}>Reset</button><button disabled={!motion} aria-pressed={touring && motion} onClick={() => setTouring(v => !v)}>{touring && motion ? 'Pause tour' : 'Guided tour'}</button></div>
        <p className="graph-guide">DRAG TO EXPLORE · SELECT A NODE</p>
      </div>
      <aside className="node-inspector" aria-live="polite"><div className="inspector-content" key={selected}><span className={`category ${node.group}`}>{node.group} / SELECTED NODE</span><h2>{node.label}</h2><p>{node.description}</p><div className="related"><span>CONNECTED TO / {neighbors.length.toString().padStart(2,'0')}</span>{neighbors.map(id => <button key={id} onClick={() => choose(id)}>{nodes.find(n => n.id === id).label}<b>↗</b></button>)}</div>{node.group === 'project' && <a className="text-link" href={`/work?project=${node.id}`} onClick={e => navigate(e, `/work?project=${node.id}`)}>Open project record ↗</a>}{node.group !== 'project' && <a className="text-link" href="/contact" onClick={e => navigate(e, '/contact')}>Start a conversation ↗</a>}</div><p className="atlas-note">An editorial map of the practice.<br />Connections express creative relationships.</p></aside>
    </div>
  </section>
}

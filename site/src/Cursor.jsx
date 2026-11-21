import { useEffect, useRef } from 'react'

export default function Cursor({ motion }) {
  const root = useRef(null)
  const dot = useRef(null)
  const ring = useRef(null)
  useEffect(() => {
    const cursor = root.current
    const fine = matchMedia('(hover: hover) and (pointer: fine)')
    let frame = 0, visible = false
    let target = { x:0, y:0 }, current = { x:0, y:0 }
    const html = document.documentElement
    function draw() {
      current.x += (target.x - current.x) * (motion ? .21 : 1)
      current.y += (target.y - current.y) * (motion ? .21 : 1)
      ring.current.style.transform = `translate3d(${current.x}px,${current.y}px,0)`
      frame = Math.abs(current.x-target.x) + Math.abs(current.y-target.y) > .15 ? requestAnimationFrame(draw) : 0
    }
    function hide() {
      visible = false; root.current.dataset.visible = 'false'
      html.classList.remove('custom-cursor')
      html.style.setProperty('--pointer-x','0px'); html.style.setProperty('--pointer-y','0px')
      cancelAnimationFrame(frame); frame = 0
    }
    function move(e) {
      if (!fine.matches || e.pointerType !== 'mouse') { hide(); return }
      target = { x:e.clientX, y:e.clientY }
      if (!visible) { current = {...target}; visible = true; html.classList.add('custom-cursor') }
      root.current.dataset.visible = 'true'
      root.current.dataset.interactive = String(!!e.target.closest('a,button,[role="button"],summary'))
      root.current.dataset.text = String(!!e.target.closest('input,textarea,[contenteditable="true"]'))
      dot.current.style.transform = `translate3d(${target.x}px,${target.y}px,0)`
      html.style.setProperty('--pointer-x', `${motion ? (e.clientX/innerWidth-.5)*8 : 0}px`)
      html.style.setProperty('--pointer-y', `${motion ? (e.clientY/innerHeight-.5)*8 : 0}px`)
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const out = e => { if (!e.relatedTarget) hide() }
    const down = () => { root.current.dataset.down = 'true' }
    const up = () => { root.current.dataset.down = 'false' }
    const visibility = () => { if (document.hidden) hide() }
    document.addEventListener('pointermove',move,{passive:true})
    document.addEventListener('pointerout',out)
    document.addEventListener('pointerdown',down)
    document.addEventListener('pointerup',up)
    document.addEventListener('visibilitychange',visibility)
    window.addEventListener('blur',hide); fine.addEventListener('change',hide)
    return () => {
      cancelAnimationFrame(frame); html.classList.remove('custom-cursor')
      cursor.dataset.visible = 'false'
      html.style.removeProperty('--pointer-x'); html.style.removeProperty('--pointer-y')
      document.removeEventListener('pointermove',move); document.removeEventListener('pointerout',out)
      document.removeEventListener('pointerdown',down); document.removeEventListener('pointerup',up)
      document.removeEventListener('visibilitychange',visibility)
      window.removeEventListener('blur',hide); fine.removeEventListener('change',hide)
    }
  }, [motion])
  return <div ref={root} className="cursor" aria-hidden="true" data-visible="false"><div ref={ring} className="cursor-ring"><i/></div><div ref={dot} className="cursor-dot"><i/></div></div>
}

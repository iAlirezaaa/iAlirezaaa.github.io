import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { email, routes } from './data'
import { officialLinks } from './i18n'

export default function Navigation({ position, path, close, navigate, tr, localPath, isFa }) {
  const panel = useRef(null)
  const [point, setPoint] = useState({ x:position.x, y:position.y })
  useLayoutEffect(() => {
    const rect = panel.current.getBoundingClientRect()
    setPoint({ x:Math.max(12, Math.min(position.x, innerWidth - rect.width - 12)), y:Math.max(12, Math.min(position.y, innerHeight - rect.height - 12)) })
  }, [position])
  useEffect(() => {
    const previous = document.activeElement
    const initial = panel.current.querySelector('[aria-current="page"]') || panel.current.querySelector('a')
    initial?.focus()
    const resize = () => close()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); previous?.focus() }
  }, [close])
  function keys(event) {
    const items = [...panel.current.querySelectorAll('a, button')]
    const current = items.indexOf(document.activeElement)
    let next = current
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) next = (current + 1) % items.length
    else if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault(); items[next].focus()
  }
  return <div className="menu-layer" onPointerDown={(e) => { if (e.target === e.currentTarget) close() }} onContextMenu={(e) => e.preventDefault()}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={tr('Explore the realm')} dir={isFa ? 'rtl' : 'ltr'} className="command-menu" style={{ left:point.x, top:point.y }} onKeyDown={keys}>
      <div className="menu-heading"><span>{tr('THE REALM / INDEX')}</span><button onClick={close} aria-label={tr('Close navigation')}>ESC</button></div>
      <nav aria-label={tr('Main navigation')}>{routes.map(([href, label, subtitle], i) => <a key={href} href={localPath(href)} aria-current={path === href ? 'page' : undefined} onClick={(e) => navigate(e, localPath(href))}><small>0{i}</small><span>{tr(label)}<em>{tr(subtitle)}</em></span><b aria-hidden="true">↗</b></a>)}{isFa && <a href="/fa/blog/"><small>05</small><span>وبلاگ<em>یادداشت‌های علیرضا عسگرپور</em></span><b aria-hidden="true">↗</b></a>}</nav>
      <div className="menu-social" aria-label={tr('Official profiles')}>{officialLinks.map(link => <a href={link.href} key={link.href} target="_blank" rel="noopener noreferrer">{tr(link.name)} ↗</a>)}<a href={`mailto:${email}`}>{tr('Email')} ↗</a></div>
      <p className="menu-note">{tr('Stories. Systems. One realm.')}</p>
    </div>
  </div>
}

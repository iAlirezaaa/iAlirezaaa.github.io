// REVIEW: canonical linked reading and optional, local-only reading history.
const key = 'hades-reading-trail-v1';
const canonical = value => typeof value === 'string' && /^\/fa\/blog\/(?:notes\/)?[a-z0-9-]+\/$/.test(value) && !/^\/fa\/blog\/(?:tags|categories|notes)\/$/.test(value);
export function installReadingTrail({document, graph, here, storage}) {
  const nodes = graph.nodes.filter(n => canonical(n.url) && typeof n.title === 'string');
  const byUrl = new Map(nodes.map(n => [n.url, n]));
  const current = nodes.find(n => n.url.replace(/\/$/, '') === here);
  const saved = storage.read(key, {});
  let enabled = saved?.enabled === true;
  let visits = Array.isArray(saved?.visits) ? [...new Set(saved.visits.filter(url => byUrl.has(url)))].slice(0, 12) : [];
  const persist = () => storage.write(key, {enabled, visits: enabled ? visits : []});
  const remember = () => { if (enabled && current) visits = [current.url, ...visits.filter(url => url !== current.url)].slice(0, 12); };
  if (enabled && current) { remember(); persist(); }
  const fill = (list, items) => {
    list.replaceChildren();
    for (const node of items) {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = node.url; a.textContent = node.title; a.dir = 'auto'; li.append(a); list.append(li);
    }
  };
  const related = document.querySelector('[data-reading-related]');
  if (related && current) {
    const ids = new Set(graph.links.flatMap(l => l.source === current.id ? [l.target] : l.target === current.id ? [l.source] : []));
    const connected = nodes.filter(n => n.id !== current.id && ids.has(n.id));
    fill(related.querySelector('[data-reading-out]'), connected.filter(n => graph.links.some(l => l.source === current.id && l.target === n.id)));
    fill(related.querySelector('[data-reading-in]'), connected.filter(n => !graph.links.some(l => l.source === current.id && l.target === n.id)));
    for (const group of related.querySelectorAll('[data-reading-group]')) group.hidden = !group.querySelector('li');
    related.hidden = !connected.length;
  }
  const history = document.querySelector('[data-reading-history]');
  if (!history) return;
  const toggle = history.querySelector('[data-reading-toggle]'), clear = history.querySelector('[data-reading-clear]');
  const status = history.querySelector('[data-reading-status]'), list = history.querySelector('[data-reading-visits]');
  function render(message) {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? 'توقف و پاک کردن تاریخچه' : 'فعال کردن تاریخچه';
    clear.disabled = !visits.length;
    fill(list, enabled ? visits.map(url => byUrl.get(url)) : []);
    status.textContent = message || (enabled ? (visits.length ? 'آخرین نوشته‌های بازشده' : 'هنوز نوشته‌ای ثبت نشده است.') : 'خاموش است؛ چیزی ثبت نمی‌شود.');
  }
  toggle.addEventListener('click', () => { enabled = !enabled; if (!enabled) visits = []; else remember(); render(persist() ? '' : 'ذخیره در این مرورگر ممکن نیست؛ تغییر فقط برای همین صفحه اعمال شد.'); });
  clear.addEventListener('click', () => { visits = []; render(persist() ? 'تاریخچه پاک شد.' : 'تاریخچهٔ این صفحه پاک شد؛ ذخیره‌سازی در دسترس نیست.'); });
  render(); history.hidden = false;
}

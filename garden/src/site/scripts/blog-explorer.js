import { normalizeSearchText } from './hades.js';

// The full catalogue remains server-rendered. Filtering never fetches or hides
// unpublished content, and links remain usable when JavaScript is unavailable.
export function matchesDiscovery(item, { q = '', kind = '', category = '', topic = '' } = {}) {
  const compact = value => normalizeSearchText(value).replace(/\s+/g, '');
  const words = normalizeSearchText(q).split(/\s+/).filter(Boolean);
  return (!kind || item.kind === kind) && (!category || item.category === category) &&
    (!topic || item.topics.split(' ').includes(topic)) &&
    words.every(word => compact(item.search).includes(compact(word)));
}

export function compareDiscovery(a, b, order) {
  if (order === 'shortest') return Number(a.minutes) - Number(b.minutes) || a.index - b.index;
  if (order === 'title') return a.title.localeCompare(b.title, 'fa') || a.index - b.index;
  return b.date.localeCompare(a.date) || a.index - b.index;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('[data-blog-explorer]');
  if (form) {
    const fields = Object.fromEntries(['q', 'kind', 'category', 'topic', 'sort'].map(name => [name, form.elements.namedItem(name)]));
    const items = [...document.querySelectorAll('[data-explorer-item]')].map((element, index) => ({ element, index, ...element.dataset }));
    const lists = [...document.querySelectorAll('[data-explorer-list]')];
    const count = form.querySelector('[data-explorer-count]');
    const empty = document.querySelector('[data-explorer-empty]');
    const reset = form.querySelector('[type="reset"]');
    const numbers = new Intl.NumberFormat('fa-IR');
    const totalArticles = items.filter(item => item.kind === 'article').length;
    const totalNotes = items.length - totalArticles;
    let inputTimer;

    function readURL() {
      const params = new URLSearchParams(location.search);
      for (const [name, field] of Object.entries(fields)) {
        const value = params.get(name) || (name === 'sort' ? 'newest' : '');
        field.value = name === 'q' ? value.slice(0, 200) : [...field.options].some(option => option.value === value) ? value : name === 'sort' ? 'newest' : '';
      }
    }

    function apply(updateURL = true) {
      const filters = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));
      const filtered = Boolean(filters.q.trim() || filters.kind || filters.category || filters.topic || filters.sort !== 'newest');
      let shown = 0;
      for (const item of items) {
        const visible = matchesDiscovery(item, filters);
        item.element.hidden = !visible;
        if (visible) shown++;
      }
      for (const list of lists) {
        const sorted = items.filter(item => item.element.parentElement === list).sort((a, b) => compareDiscovery(a, b, filters.sort));
        list.append(...sorted.map(item => item.element));
        list.closest('[data-explorer-section]').hidden = !sorted.some(item => !item.element.hidden);
      }
      document.body.classList.toggle('is-filtering', filtered);
      empty.hidden = shown !== 0;
      reset.disabled = !filtered;
      count.textContent = filtered ? numbers.format(shown) + ' از ' + numbers.format(items.length) + ' نوشته' : numbers.format(totalArticles) + ' مقاله · ' + numbers.format(totalNotes) + ' یادداشت';
      if (updateURL) {
        const url = new URL(location.href);
        for (const [key, value] of Object.entries(filters)) {
          if (value && !(key === 'sort' && value === 'newest')) url.searchParams.set(key, value);
          else url.searchParams.delete(key);
        }
        try { history.replaceState(null, '', url); } catch { /* Filtering also works in a local HTML preview. */ }
      }
    }

    form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(inputTimer); apply(); });
    fields.q.addEventListener('input', () => { clearTimeout(inputTimer); inputTimer = setTimeout(apply, 100); });
    for (const field of Object.values(fields).filter(field => field !== fields.q)) field.addEventListener('change', () => { clearTimeout(inputTimer); apply(); });
    function clearFilters() {
      clearTimeout(inputTimer);
      for (const [name, field] of Object.entries(fields)) field.value = name === 'sort' ? 'newest' : '';
      apply();
      form.querySelector('summary')?.focus({ preventScroll: true });
    }
    form.addEventListener('reset', event => { event.preventDefault(); clearFilters(); });
    document.querySelector('[data-explorer-reset]')?.addEventListener('click', clearFilters);
    addEventListener('popstate', () => { readURL(); apply(false); });
    // Keep the editorial lead visible; advanced choices are one tap away.
    form.querySelector('details').open = false;
    readURL();
    apply(false);
    form.hidden = false;
  }
}

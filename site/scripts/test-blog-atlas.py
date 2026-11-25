"""Browser QA for the rebuilt HADES reading site, served from the actual build.

Checks the one-of-each navigation contract, real graph interaction, responsive
reading, and opt-in comment safety. It never posts to GitHub or claims a deploy.
"""
import json
from html.parser import HTMLParser
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[1]
output = root / "atlas-evidence"
output.mkdir(exist_ok=True)
origin = "http://127.0.0.1:8765"
home = origin + "/fa/blog/"
mobile_breakpoint = 1100
results = []
server = subprocess.Popen(
    [sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1", "--directory", str(root / "dist")],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)

FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex='0']"
LABELS = """el => {
  const labels = [...el.querySelectorAll('.graph-node text')].filter(e => {
    const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)!==0;
  }).map(e => e.getBoundingClientRect());
  let intersections=0;
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j];
    if(a.width&&b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)intersections++;
  }
  return {visible:labels.length,intersections};
}"""
SNAPSHOT = """el=>({ready:el.dataset.graphReady,scope:el.dataset.scope,count:Number(el.dataset.graphCount),
  urls:[...el.querySelectorAll('.graph-node')].map(a=>a.getAttribute('href')).sort()})"""
POSITION = """el=>{const v=el.ownerSVGElement.viewBox.baseVal;
  return [Number(el.getAttribute('cx'))/v.width,Number(el.getAttribute('cy'))/v.height]}"""
REMOVED = (
    '.workspace-strip', '.workspace-ribbon', '.topbar-links', '.reader-inline-toc',
    '[data-workspace-panes]', '[data-workspace-width]', '[data-workspace-focus]',
    '[data-reading-history]', '[data-reading-related]', '[data-reading-relation]',
    '[data-recent-reading]', '[data-atlas-preview]', '[data-blog-explorer]',
    '[data-tree-filter]', '.garden-directory-nav', '[data-local-depth]',
    '[data-graph-option]', '[data-graph-pan]', '.graph-atlas-settings',
    '[data-setting="measure"]', '[data-setting="leading"]',
)


class TreeLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            self.urls.append(attrs['href'])


def assert_no_overflow(page, width):
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), (width, page.url, 'horizontal page overflow')


def assert_focus_trapped(page, selector):
    """Use actual Tab/Shift+Tab and a background focus attempt, not ARIA alone."""
    panel = page.locator(selector)
    for end, key in ((-1, 'Tab'), (0, 'Shift+Tab')):
        count = panel.evaluate("""(el,{selector,end})=>{
          const targets=[...el.querySelectorAll(selector)].filter(n=>{
            const s=getComputedStyle(n);return n.getClientRects().length&&s.visibility!=='hidden'&&!n.closest('[inert]');
          });
          targets.at(end)?.focus();return targets.length;
        }""", {"selector": FOCUSABLE, "end": end})
        assert count > 0, (selector, 'no keyboard targets')
        page.keyboard.press(key)
        assert panel.evaluate('(el)=>el.contains(document.activeElement)'), (selector, key, 'focus escaped')
    page.locator('#content').evaluate('(el)=>el.focus()')
    assert panel.evaluate('(el)=>el.contains(document.activeElement)'), (selector, 'background accepted focus')


def open_panel(page, width, name):
    panel = page.locator('#garden-' + name)
    if width <= mobile_breakpoint and panel.evaluate('(el)=>el.inert'):
        page.locator(f'[data-panel-open="{name}"]').click()
    assert panel.is_visible() and not panel.evaluate('(el)=>el.inert'), (width, name, 'panel unavailable')
    return panel


def close_panel(page, width, name):
    if width > mobile_breakpoint:
        return
    page.keyboard.press('Escape')
    panel = page.locator('#garden-' + name)
    opener = page.locator(f'[data-panel-open="{name}"]')
    assert panel.evaluate('(el)=>el.inert'), (width, name, 'closed panel not inert')
    assert opener.get_attribute('aria-expanded') == 'false'
    assert opener.evaluate('(el)=>document.activeElement===el'), (width, name, 'focus not restored')
    assert not page.locator('#content').evaluate('(el)=>el.inert')


def assert_dialog_return(page, width, actual_opener, mobile_panel):
    page.keyboard.press('Escape')
    target = page.locator(f'[data-panel-open="{mobile_panel}"]') if width <= mobile_breakpoint else actual_opener
    assert target.evaluate('(el)=>document.activeElement===el'), (width, 'dialog opener focus not restored')


def assert_shell(page, width, expected_tree_urls, content_page=False):
    page.wait_for_selector('[data-filetree][data-tree-ready="true"]', state='attached')
    assert page.locator('html').get_attribute('dir') == 'rtl'
    assert page.locator('html').get_attribute('lang') == 'fa'
    assert page.locator('main').count() == 1
    assert page.locator('main h1').count() == 1
    assert page.locator('[data-note-body]').count() == 1
    assert page.locator('#garden-navigation').count() == 1
    assert page.locator('#garden-context').count() == 1
    for selector in ('[data-panel-open="navigation"]', '[data-panel-open="context"]',
                     '[data-search-open]', '[data-settings-open]', '[data-global-graph-open]',
                     '[data-local-graph]', '[data-global-graph]', '.garden-wordmark'):
        assert page.locator(selector).count() == 1, (width, page.url, 'duplicate or missing control', selector)
    assert page.locator('#garden-navigation [data-search-open]').count() == 1
    assert page.locator('#garden-navigation [data-settings-open]').count() == 1
    assert page.locator('#garden-context [data-global-graph-open]').count() == 1
    assert page.locator('.garden-wordmark').get_attribute('href') == '/fa/blog/'
    assert page.locator('.garden-topbar a').count() == 0, (width, 'duplicate home link in mobile header')
    for selector in REMOVED:
        assert page.locator(selector).count() == 0, (width, page.url, 'removed UI remains', selector)
    assert page.locator('[data-toc]').count() <= 1
    assert page.locator('[data-graph-scope]').count() == (1 if content_page else 0)
    assert page.evaluate("localStorage.getItem('hades-reading-trail-v1')") is None
    actual_tree = page.locator('[data-filetree]').evaluate("el=>[...el.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).sort()")
    assert actual_tree == expected_tree_urls, (width, 'canonical tree parity', actual_tree, expected_tree_urls)
    nav, context = page.locator('#garden-navigation'), page.locator('#garden-context')
    if width <= mobile_breakpoint:
        assert page.locator('.garden-topbar').is_visible()
        for name in ('navigation', 'context'):
            panel = page.locator('#garden-' + name)
            assert panel.evaluate('(el)=>el.inert'), (width, name, 'drawer initially interactive')
            button = page.locator(f'[data-panel-open="{name}"]')
            assert button.is_visible() and button.get_attribute('aria-expanded') == 'false'
            open_panel(page, width, name)
            assert panel.get_attribute('role') == 'dialog' and panel.get_attribute('aria-modal') == 'true'
            assert page.locator('#content').evaluate('(el)=>el.inert')
            assert page.locator('.garden-topbar').evaluate('(el)=>el.inert')
            other = context if name == 'navigation' else nav
            assert other.evaluate('(el)=>el.inert')
            assert_focus_trapped(page, '#garden-' + name)
            close_panel(page, width, name)
    else:
        assert not page.locator('.garden-topbar').is_visible()
        for name in ('navigation', 'context'):
            assert not page.locator(f'[data-panel-open="{name}"]').is_visible()
        assert nav.is_visible() and context.is_visible()
        assert not nav.evaluate('(el)=>el.inert') and not context.evaluate('(el)=>el.inert')
        n, c, m = nav.bounding_box(), context.bounding_box(), page.locator('main').bounding_box()
        assert c['x'] + c['width'] <= m['x'] + 2, (width, 'context not left of reading pane', c, m)
        assert m['x'] + m['width'] <= n['x'] + 2, (width, 'navigation not right of reading pane', m, n)
        assert m['width'] >= 400, (width, 'reading pane cramped', m)
    page.evaluate('document.fonts.ready')
    assert page.evaluate("document.fonts.check('16px Mikhak')&&[...document.fonts].some(f=>/Mikhak/i.test(f.family)&&f.status==='loaded')"), (width, 'actual Mikhak face not loaded')
    assert page.locator('[data-note-body]').evaluate("el=>getComputedStyle(el).fontFamily.includes('Mikhak')&&parseFloat(getComputedStyle(el).fontSize)>=16")
    assert_no_overflow(page, width)


def check_search_and_settings(page, width):
    open_panel(page, width, 'navigation')
    search = page.locator('[data-search-open]')
    search.click()
    dialog = page.locator('#garden-search')
    assert dialog.is_visible()
    assert page.locator('#garden-search-input').evaluate('(el)=>document.activeElement===el')
    assert_focus_trapped(page, '#garden-search')
    field = page.locator('#garden-search-input')
    field.fill('DDPM')
    page.wait_for_function("document.querySelector('#garden-search-results')?.textContent.includes('DDPM')")
    assert page.locator('#garden-search-results a').count() > 0
    assert_dialog_return(page, width, search, 'navigation')
    assert not dialog.is_visible()
    # The shortcut is available even when the mobile navigation is closed.
    page.keyboard.press('Control+k')
    assert dialog.is_visible()
    field.fill('')
    page.wait_for_function("document.querySelectorAll('#garden-search-results a').length>1")
    links = page.locator('#garden-search-results a')
    second = links.nth(1).get_attribute('href')
    assert second and second != urllib.parse.urlparse(page.url).path, 'search navigation must change the page'
    field.press('ArrowDown')
    assert page.locator('#garden-search-results a[aria-current="true"]').get_attribute('href') == second
    field.press('Enter')
    page.wait_for_url(origin + second)
    assert page.locator('[data-note-body]').inner_text().strip(), 'keyboard search opened an empty page'
    page.goto(home, wait_until='load')
    page.wait_for_selector('[data-filetree][data-tree-ready="true"]', state='attached')
    open_panel(page, width, 'navigation')
    settings = page.locator('[data-settings-open]')
    original_size = page.locator('[data-note-body]').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)')
    settings.click()
    assert page.locator('#garden-settings').is_visible()
    assert_focus_trapped(page, '#garden-settings')
    theme = page.locator('[data-setting="theme"]')
    theme.select_option('dark')
    dark = page.locator('body').evaluate('el=>getComputedStyle(el).backgroundColor')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    theme.select_option('light')
    light = page.locator('body').evaluate('el=>getComputedStyle(el).backgroundColor')
    assert dark != light, (width, 'theme select did not change appearance', dark, light)
    page.locator('[data-setting="size"]').select_option('large')
    assert page.locator('[data-note-body]').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)') > original_size
    assert_dialog_return(page, width, settings, 'navigation')
    page.reload(wait_until='load')
    assert page.locator('html').get_attribute('data-theme') == 'light'
    assert page.locator('html').get_attribute('data-size') == 'large'
    open_panel(page, width, 'navigation')
    settings.click()
    assert page.locator('[data-setting="theme"]').input_value() == 'light'
    assert page.locator('[data-setting="size"]').input_value() == 'large'
    page.locator('[data-settings-reset]').click()
    assert page.locator('html').get_attribute('data-theme') == 'system'
    assert page.locator('html').get_attribute('data-size') == 'regular'
    assert_dialog_return(page, width, settings, 'navigation')
    assert_no_overflow(page, width)


def wait_graph(page, selector):
    page.wait_for_selector(selector + '[data-graph-ready="true"] .graph-node', state='attached')
    graph = page.locator(selector)
    graph.wait_for(state='visible')
    page.evaluate('document.fonts.ready')
    page.wait_for_function("""selector=>{const c=document.querySelector(selector),s=c?.querySelector('svg');
      if(!s)return false;const b=s.getBoundingClientRect(),v=s.viewBox.baseVal;
      return b.width>0&&b.height>0&&Math.abs(v.width-Math.max(200,c.clientWidth))<2&&Math.abs(v.height-Math.max(200,c.clientHeight))<2;
    }""", arg=selector)
    return graph


def assert_graph_urls(graph, expected, scope):
    state = graph.evaluate(SNAPSHOT)
    assert state['ready'] == 'true' and state['scope'] == scope, ('graph scope', state, scope)
    assert state['urls'] == sorted(expected) and state['count'] == len(expected), ('graph URL parity', state, expected)
    assert len(state['urls']) == len(set(state['urls'])), ('duplicate graph nodes', state)
    assert graph.locator('.graph-node').evaluate_all("els=>els.every(a=>a.getAttribute('aria-label')&&a.getAttribute('href')?.startsWith('/fa/blog/'))")
    # Two reciprocal links share one visible line. Compare undirected pairs,
    # while retaining all directed links for local-neighbor/backlink checks.
    expected_ids = {str(nodes_by_url[path]['id']) for path in expected}
    expected_edges = {
        tuple(sorted((str(edge['source']), str(edge['target']))))
        for edge in links
        if str(edge['source']) in expected_ids and str(edge['target']) in expected_ids
        and edge['source'] != edge['target']
    }
    drawn = graph.locator('.graph-edge').evaluate_all('els=>els.map(e=>[e.dataset.source,e.dataset.target].sort())')
    actual_edges = {tuple(edge) for edge in drawn}
    assert actual_edges == expected_edges and len(drawn) == len(expected_edges), ('graph edge parity', actual_edges, expected_edges)
    labels = graph.evaluate(LABELS)
    assert labels['intersections'] == 0, ('overlapping graph labels', labels)
    return state


def assert_edges_follow(graph, node_id):
    assert graph.evaluate("""(el,id)=>{
      const n=[...el.querySelectorAll('.graph-node')].find(a=>a.dataset.graphId===id),c=n?.querySelector('circle:not(.graph-hit)');
      const edges=[...el.querySelectorAll('.graph-edge')].filter(e=>e.dataset.source===id||e.dataset.target===id);
      return c&&edges.length>0&&edges.every(e=>{const k=e.dataset.source===id?'1':'2';
        return Math.abs(Number(e.getAttribute('x'+k))-Number(c.getAttribute('cx')))<.01&&
               Math.abs(Number(e.getAttribute('y'+k))-Number(c.getAttribute('cy')))<.01});
    }""", node_id), ('edges did not follow moved node', node_id)


def pointer_drag(page, touch, x, y, dx, dy):
    if touch:
        session = page.context.new_cdp_session(page)
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
        for step in range(1, 6):
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx * step / 5, 'y': y + dy * step / 5, 'id': 1}]})
        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        session.detach()
    else:
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + dx, y + dy, steps=5)
        page.mouse.up()


def check_global_interactions(page, width, expected_urls):
    touch = width <= 430
    opener = page.locator('[data-global-graph-open]')
    opener.click()
    assert page.locator('#garden-graph').is_visible()
    graph = wait_graph(page, '[data-global-graph]')
    state = assert_graph_urls(graph, expected_urls, 'all')
    assert_focus_trapped(page, '#garden-graph')
    for selector in ('[data-graph-zoom="in"]', '[data-graph-zoom="out"]', '[data-graph-reset]'):
        assert page.locator('#garden-graph ' + selector).count() == 1
        assert page.locator('#garden-graph ' + selector).is_visible()
    # Choose an actually connected node so edge tracking is a substantive check.
    node_index = graph.evaluate("""el=>[...el.querySelectorAll('.graph-node')].findIndex(n=>
      [...el.querySelectorAll('.graph-edge')].some(e=>e.dataset.source===n.dataset.graphId||e.dataset.target===n.dataset.graphId))""")
    assert node_index >= 0, 'public graph has no connected nodes'
    node = graph.locator('.graph-node').nth(node_index)
    dot = node.locator('circle:not(.graph-hit)').first
    node_id = node.get_attribute('data-graph-id')
    node.focus()
    assert graph.evaluate(LABELS)['intersections'] == 0
    original_normalized = dot.evaluate(POSITION)
    original = [float(dot.get_attribute(k)) for k in ('cx', 'cy')]
    box, bounds = dot.bounding_box(), graph.bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    dx = 30 if x < bounds['x'] + bounds['width'] / 2 else -30
    dy = 18 if y < bounds['y'] + bounds['height'] / 2 else -18
    before_url = page.url
    pointer_drag(page, touch, x, y, dx, dy)
    page.wait_for_function("document.querySelector('[data-global-graph]')?.dataset.layoutChanged==='true'")
    moved = [float(dot.get_attribute(k)) for k in ('cx', 'cy')]
    assert sum(abs(a - b) for a, b in zip(original, moved)) > 8, (width, 'drag did not move node', original, moved)
    assert page.url == before_url, (width, 'drag unexpectedly navigated')
    assert_edges_follow(graph, node_id)
    node.focus()
    node.press('ArrowRight')
    assert float(dot.get_attribute('cx')) > moved[0], (width, 'keyboard move failed')
    assert_edges_follow(graph, node_id)
    reset = page.locator('#garden-graph [data-graph-reset]')
    reset.click()
    assert graph.get_attribute('data-layout-changed') is None
    assert max(abs(a - b) for a, b in zip(original_normalized, dot.evaluate(POSITION))) < .003, (width, 'reset did not restore original normalized position')
    node.focus()
    node.press('ArrowRight')
    page.locator('[data-graph-zoom="in"]').click()
    before_resize = dot.evaluate(POSITION)
    scale_before = float(graph.get_attribute('data-scale'))
    assert scale_before > 1
    old_viewbox = graph.locator('svg').get_attribute('viewBox')
    resized_width = 940 if width > mobile_breakpoint else width + 24
    page.set_viewport_size({'width': resized_width, 'height': 780})
    page.wait_for_function("old=>document.querySelector('[data-global-graph] svg').getAttribute('viewBox')!==old", arg=old_viewbox)
    wait_graph(page, '[data-global-graph]')
    assert max(abs(a - b) for a, b in zip(before_resize, dot.evaluate(POSITION))) < .003, (width, 'resize lost normalized node position')
    assert abs(float(graph.get_attribute('data-scale')) - scale_before) < .001, (width, 'resize lost zoom')
    page.set_viewport_size({'width': width, 'height': 900})
    wait_graph(page, '[data-global-graph]')
    reset.click()
    assert float(graph.get_attribute('data-scale')) == 1
    page.locator('[data-graph-zoom="out"]').click()
    assert float(graph.get_attribute('data-scale')) < 1
    reset.click()
    # A background drag changes the camera, not a node or the document scroll.
    scene = graph.locator('[data-graph-scene]')
    transform = scene.get_attribute('transform')
    background = graph.evaluate("""el=>{
      const r=el.getBoundingClientRect();
      for(const fy of [.12,.88,.25,.75])for(const fx of [.12,.88,.25,.75]){
        const x=r.left+r.width*fx,y=r.top+r.height*fy,t=document.elementFromPoint(x,y);
        if(t&&el.contains(t)&&!t.closest('.graph-node'))return {x,y};
      }
      return null;
    }""")
    assert background, (width, 'no usable graph background')
    pointer_drag(page, touch, background['x'], background['y'], 22, 13)
    assert scene.get_attribute('transform') != transform, (width, 'background pan failed')
    assert page.url == before_url
    reset.click()
    if touch:
        # Real two-finger input must zoom the graph while the page stays unzoomed.
        bounds = graph.bounding_box()
        x, y = bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] * .18
        radius = min(55, bounds['width'] * .18)
        session = page.context.new_cdp_session(page)
        points = lambda r: [{'x': x - r, 'y': y, 'id': 1}, {'x': x + r, 'y': y, 'id': 2}]
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': points(radius)})
        for factor in (1.15, 1.3, 1.5):
            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': points(radius * factor)})
        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        session.detach()
        assert float(graph.get_attribute('data-scale')) > 1.05, (width, 'pinch did not zoom graph')
        assert page.evaluate('Math.abs(visualViewport.scale-1)<.01'), (width, 'pinch zoomed page instead of graph')
        reset.click()
    assert_graph_urls(graph, expected_urls, 'all')
    assert_no_overflow(page, width)
    page.locator('#garden-graph').screenshot(path=str(output / f'graph-dialog-{width}.png'))
    assert_dialog_return(page, width, opener, 'context')
    assert not page.locator('#garden-graph').is_visible()
    # After closing, the miniature must remain intact and usable.
    open_panel(page, width, 'context')
    mini = wait_graph(page, '[data-local-graph]')
    assert_graph_urls(mini, expected_urls, 'all')
    opener.click()
    graph = wait_graph(page, '[data-global-graph]')
    link = graph.locator('.graph-node').nth(node_index)
    destination = link.get_attribute('href')
    assert destination and destination != urllib.parse.urlparse(page.url).path, 'graph navigation must change the page'
    if touch:
        b = link.locator('circle:not(.graph-hit)').first.bounding_box()
        page.touchscreen.tap(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
    elif width == 1440:
        link.focus()
        link.press('Enter')
    else:
        link.locator('circle:not(.graph-hit)').first.click()
    page.wait_for_url(origin + destination)
    assert page.locator('[data-note-body]').inner_text().strip(), (width, 'graph navigation opened empty page')
    return state


def check_content_graph(page, width, page_url, expected_urls, nodes_by_url, links):
    current = nodes_by_url[page_url]
    ids = {n['id']: n['url'] for n in nodes_by_url.values()}
    neighbors = {current['id']}
    incoming = set()
    for edge in links:
        if edge['source'] == current['id'] and edge['target'] in ids:
            neighbors.add(edge['target'])
        if edge['target'] == current['id'] and edge['source'] in ids:
            neighbors.add(edge['source'])
            incoming.add(ids[edge['source']])
    expected_local = sorted(ids[i] for i in neighbors)
    incoming.discard(page_url)
    open_panel(page, width, 'context')
    local = wait_graph(page, '[data-local-graph]')
    assert_graph_urls(local, expected_local, 'local')
    center = local.locator('.graph-node[data-current="true"]')
    assert center.count() == 1 and center.get_attribute('href') == page_url
    assert center.evaluate("""el=>{const v=el.ownerSVGElement.viewBox.baseVal,c=el.querySelector('circle:not(.graph-hit)');
      return Math.abs(Number(c.getAttribute('cx'))/v.width-.5)<.08&&Math.abs(Number(c.getAttribute('cy'))/v.height-.5)<.08}"""), (width, 'active page not centered in local graph')
    center.focus()
    assert local.evaluate(LABELS)['intersections'] == 0
    toggle = page.locator('[data-graph-scope]')
    assert toggle.is_visible() and toggle.get_attribute('aria-pressed') == 'false'
    toggle.click()
    page.wait_for_function("document.querySelector('[data-local-graph]')?.dataset.scope==='all'")
    assert_graph_urls(local, expected_urls, 'all')
    assert toggle.get_attribute('aria-pressed') == 'true'
    assert local.locator('.graph-node[data-current="true"]').count() == 1
    toggle.click()
    page.wait_for_function("document.querySelector('[data-local-graph]')?.dataset.scope==='local'")
    assert_graph_urls(local, expected_local, 'local')
    assert toggle.get_attribute('aria-pressed') == 'false'
    backlinks = page.locator('[data-backlinks]')
    assert backlinks.count() <= 1
    actual = sorted(backlinks.locator('a[href]').evaluate_all('els=>els.map(a=>a.getAttribute("href"))'))
    assert actual == sorted(incoming), (width, 'backlink parity', actual, sorted(incoming))
    assert len(actual) == len(set(actual)), (width, 'duplicate backlinks')
    if page.locator('[data-toc]').count():
        assert page.locator('[data-toc] a[href]').evaluate_all("""els=>els.every(a=>{
          const u=new URL(a.href);let id;try{id=decodeURIComponent(u.hash.slice(1));}catch{id=u.hash.slice(1)}
          return u.pathname===location.pathname&&Boolean(document.getElementById(id));
        })"""), (width, 'table of contents points to missing headings')
    page.locator('#garden-context').screenshot(path=str(output / f'article-context-{width}.png'))
    close_panel(page, width, 'context')
    assert_no_overflow(page, width)
    return len(expected_local)


def check_comments(page, width, comment_state):
    comments = page.locator('[data-blog-comments]')
    assert comments.count() == 1
    assert not comment_state['requests'], (width, 'comments requested without visitor consent', comment_state['requests'])
    issue = comments.get_attribute('data-issue')
    assert issue and issue.isdigit()
    write = comments.locator('.comment-write')
    assert write.get_attribute('href') == 'https://github.com/iAlirezaaa/iAlirezaaa.github.io/issues/' + issue + '#new_comment_field'
    unsafe = '<img src=x onerror=alert(1)> TEST_COMMENT'
    comment_state.update(status=200, body=[{'id': 123456, 'body': unsafe, 'user': {'login': 'fixture-user'}, 'created_at': '2026-11-25T10:00:00Z'}])
    comments.locator('[data-comments-load]').press('Enter')
    page.wait_for_function("document.querySelector('[data-comments-list]')?.textContent.includes('TEST_COMMENT')")
    assert len(comment_state['requests']) == 1
    method, request_url = comment_state['requests'][0]
    assert method == 'GET'
    assert request_url == 'https://api.github.com/repos/iAlirezaaa/iAlirezaaa.github.io/issues/' + issue + '/comments?per_page=100'
    assert comments.locator('.blog-comment-body').inner_text() == unsafe
    assert comments.locator('[data-comments-list] img').count() == 0
    assert_no_overflow(page, width)
    comments.screenshot(path=str(output / f'comments-{width}.png'))
    comment_state.update(status=403, body={'message': 'rate limit'})
    comments.locator('[data-comments-load]').click()
    page.wait_for_function("document.querySelector('[data-comments-status]')?.textContent.includes('ممکن نشد')")
    assert write.is_visible()
    assert all(method == 'GET' for method, _ in comment_state['requests'])


try:
    for _ in range(60):
        try:
            urllib.request.urlopen(home, timeout=2).close()
            break
        except OSError:
            time.sleep(.25)
    else:
        raise RuntimeError('Built blog server unavailable')
    raw_graph = json.loads((root / 'dist/fa/garden/graph.json').read_text(encoding='utf-8'))
    raw_nodes = raw_graph['nodes'].values() if isinstance(raw_graph['nodes'], dict) else raw_graph['nodes']
    nodes_by_url = {n['url']: n for n in raw_nodes if not n.get('hide') and not n.get('private')}
    expected_urls = sorted(nodes_by_url)
    assert expected_urls and all(u.startswith('/fa/blog/') for u in expected_urls)
    for canonical in expected_urls:
        assert (root / 'dist' / urllib.parse.unquote(canonical).lstrip('/') / 'index.html').is_file(), ('missing canonical output', canonical)
    links = raw_graph.get('links', raw_graph.get('edges', []))
    tree_parser = TreeLinks()
    tree_parser.feed((root / 'dist/fa/garden/filetree.html').read_text(encoding='utf-8'))
    expected_tree_urls = sorted(tree_parser.urls)
    assert len(expected_tree_urls) == len(set(expected_tree_urls)), 'generated tree duplicates canonical paths'
    assert set(expected_urls) <= set(expected_tree_urls), 'generated tree misses published content'
    article_url = next(u for u in expected_urls if '/notes/' not in u)
    note_url = next(u for u in expected_urls if '/notes/' in u)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (320, 390, 430, 1024, 1440):
            context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce', has_touch=width <= 430)
            page = context.new_page()
            page.set_default_timeout(20000)
            errors, failed_assets = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed_assets.append((response.status, response.url)) if response.url.startswith(origin + '/') and response.status >= 400 else None)
            # Intercept every comment read before loading any page. A premature
            # request therefore fails the opt-in assertion and never hits GitHub.
            comment_state = {'status': 200, 'body': [], 'requests': []}
            def comment_route(route):
                comment_state['requests'].append((route.request.method, route.request.url))
                route.fulfill(status=comment_state['status'], headers={'Access-Control-Allow-Origin': '*'}, json=comment_state['body'])
            page.route('https://api.github.com/repos/iAlirezaaa/iAlirezaaa.github.io/issues/*/comments*', comment_route)
            page.goto(home, wait_until='load')
            assert page.locator('[data-blog-comments]').count() == 0
            assert_shell(page, width, expected_tree_urls)
            page.screenshot(path=str(output / f'home-{width}.png'), full_page=False)
            check_search_and_settings(page, width)
            open_panel(page, width, 'context')
            mini = wait_graph(page, '[data-local-graph]')
            assert_graph_urls(mini, expected_urls, 'all')
            mini.screenshot(path=str(output / f'miniature-{width}.png'))
            global_state = check_global_interactions(page, width, expected_urls)
            page.goto(origin + article_url, wait_until='load')
            assert_shell(page, width, expected_tree_urls, content_page=True)
            page.screenshot(path=str(output / f'article-{width}.png'), full_page=False)
            local_count = check_content_graph(page, width, article_url, expected_urls, nodes_by_url, links)
            check_comments(page, width, comment_state)
            # A native note and a directory use the same shell; a directory's
            # miniature is the global graph rather than an empty current-node graph.
            for path, content_page in ((note_url, True), ('/fa/blog/categories/', False)):
                page.goto(origin + path, wait_until='load')
                assert_shell(page, width, expected_tree_urls, content_page=content_page)
                open_panel(page, width, 'context')
                graph = wait_graph(page, '[data-local-graph]')
                if content_page:
                    assert graph.get_attribute('data-scope') == 'local'
                    assert graph.locator('.graph-node[data-current="true"]').get_attribute('href') == path
                else:
                    assert_graph_urls(graph, expected_urls, 'all')
                    assert page.locator('[data-blog-comments]').count() == 0
                close_panel(page, width, 'context')
            assert not errors, (width, 'uncaught browser errors', errors)
            assert not failed_assets, (width, 'failed built resources', failed_assets)
            results.append({'width': width, 'status': 'PASS', 'global_nodes': len(global_state['urls']),
                            'article_local_nodes': local_count, 'canonical_tree_links': len(expected_tree_urls),
                            'touch_drag_and_pinch': width <= 430, 'page_errors': errors, 'failed_assets': failed_assets})
            context.close()
        browser.close()
finally:
    (output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    server.terminate()
print(json.dumps(results, ensure_ascii=False, indent=2))

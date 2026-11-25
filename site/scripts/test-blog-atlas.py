"""Chromium smoke test for built blog knowledge atlas; no production claims."""
import json
from html.parser import HTMLParser
import pathlib
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[1]
output = root / "atlas-evidence"
output.mkdir(exist_ok=True)
server = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1", "--directory", str(root / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
url = "http://127.0.0.1:8765/fa/blog/"
results = []
check_labels = """el => {
  const labels = [...el.querySelectorAll('.graph-node text')].filter(e => getComputedStyle(e).visibility === 'visible').map(e => e.getBoundingClientRect());
  let intersections = 0;
  for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++){
    const a=labels[i], b=labels[j];
    if(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) intersections++;
  }
  return {visible:labels.length, intersections};
}"""
try:
    for _ in range(60):
        try:
            urllib.request.urlopen(url, timeout=2).close()
            break
        except OSError:
            time.sleep(.25)
    else:
        raise RuntimeError("Built blog server unavailable")
    # Compare canonical URL sets against the actual built graph, not a hard-coded count.
    raw_graph = json.loads((root / 'dist/fa/garden/graph.json').read_text(encoding='utf-8'))
    expected_urls = sorted(n['url'] for n in raw_graph['nodes'].values() if not n.get('hide') and not n.get('private'))
    class TreeLinks(HTMLParser):
        def __init__(self):
            super().__init__()
            self.urls = []
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == 'a' and attrs.get('href'):
                self.urls.append(attrs['href'])
    tree_parser = TreeLinks()
    tree_parser.feed((root / 'dist/fa/garden/filetree.html').read_text(encoding='utf-8'))
    expected_tree_urls = sorted(tree_parser.urls)
    assert set(expected_urls) <= set(expected_tree_urls), ('built tree misses public nodes', expected_urls, expected_tree_urls)
    snapshot = """el => ({ready:el.dataset.graphReady, kind:el.dataset.graphKind, count:Number(el.dataset.graphCount), urls:[...el.querySelectorAll('.graph-node')].map(a=>a.getAttribute('href')).sort()})"""
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (320, 390, 430, 1440):
            page = browser.new_page(viewport={"width": width, "height": 900}, reduced_motion="reduce")
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(url, wait_until="load")
            recent = page.locator('[data-recent-reading]')
            recent.wait_for(state='visible')
            assert recent.locator('ol a').count() == 0
            assert page.evaluate("localStorage.getItem('hades-reading-trail-v1')") is None
            assert recent.locator('[data-recent-manage]').get_attribute('href') == '#reading-history-title'
            # Workspace explorer stays docked on desktop and uses the existing accessible drawer on phones.
            nav = page.locator('#garden-navigation')
            query = page.locator('[data-tree-filter]')
            page.wait_for_selector('[data-filetree][data-tree-ready]', state='attached')
            assert nav.locator('[data-filetree]').get_attribute('data-tree-ready') == 'true', (width, 'tree initialization failed', errors, nav.locator('[data-filetree]').inner_html()[:500])
            if width <= 900:
                assert nav.evaluate('(el)=>el.inert')
                page.locator('.mobile-tree-toggle').click()
            assert nav.is_visible() and not nav.evaluate('(el)=>el.inert'), (width,'explorer unavailable')
            assert page.locator('.workspace-strip').count() == 1
            tree = nav.locator('[data-filetree]')
            urls = tree.evaluate("el=>[...el.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).sort()")
            assert urls == expected_tree_urls, (width, 'rendered tree URL parity', urls, expected_tree_urls, tree.inner_html()[:1000])
            all_titles = len(urls)
            query.fill('DDPM')
            visible_titles = page.locator('[data-filetree] .tree-note:not([hidden]) a')
            assert visible_titles.count() >= 1 and visible_titles.count() < all_titles
            assert any('DDPM' in title for title in visible_titles.all_text_contents())
            query.fill('zz-no-such-title-zz')
            assert page.locator('[data-filetree] .tree-note:not([hidden])').count() == 0
            query.press('Escape')
            assert query.input_value() == '' and page.locator('[data-filetree] .tree-note:not([hidden])').count() == all_titles
            if width <= 900:
                page.keyboard.press('Escape')
                assert nav.evaluate('(el)=>el.inert')
                assert page.locator('.mobile-tree-toggle').evaluate('(el)=>document.activeElement===el')
            if width > 900:
                controls = page.locator('[data-workspace-panes]')
                assert controls.is_visible()
                controls.locator('summary').click()
                slider = controls.locator('[data-workspace-width="navigation"]')
                slider.press('End')
                assert slider.input_value() == '300'
                assert abs(nav.bounding_box()['width'] - 300) <= 2
                toggle = controls.locator('[data-workspace-toggle="navigation"]')
                toggle.click()
                assert not nav.is_visible() and nav.evaluate('(el)=>el.inert')
                toggle.click()
                assert nav.is_visible() and not nav.evaluate('(el)=>el.inert')
                focus = controls.locator('[data-workspace-focus]')
                focus.click()
                assert focus.get_attribute('aria-pressed') == 'true' and not nav.is_visible()
                focus.click()
                assert nav.is_visible() and focus.get_attribute('aria-pressed') == 'false'
                assert slider.input_value() == '300'
                controls.locator('[data-workspace-reset]').click()
                assert slider.input_value() == '230'
                controls.locator('summary').click()
            else:
                assert not page.locator('[data-workspace-panes]').is_visible()
            page.screenshot(path=str(output / f"workspace-{width}.png"), full_page=False)
            preview = page.locator("[data-atlas-preview]")
            page.wait_for_selector('[data-atlas-preview][data-graph-ready="true"] .graph-node')
            page.evaluate("document.fonts.ready")
            preview.scroll_into_view_if_needed()
            preview_result = preview.evaluate(check_labels)
            assert preview_result["intersections"] == 0, (width, preview_result)
            before = preview.evaluate(snapshot)
            assert before['urls'] == expected_urls and before['count'] == len(expected_urls), (width, 'preview', before, expected_urls)
            preview.locator('.graph-node').first.focus()
            assert 'ارتباط' in page.locator('[data-atlas-detail]').inner_text()
            assert 'مقاله' in page.locator('[data-atlas-count]').inner_text()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (width, "page overflow")
            preview.screenshot(path=str(output / f"preview-{width}.png"))
            page.locator(".atlas-preview-header button").click()
            graph = page.locator("[data-global-graph]")
            page.wait_for_selector('[data-global-graph][data-graph-ready="true"] .graph-node')
            page.evaluate("document.fonts.ready")
            assert not page.locator('[data-graph-option="motion"]').is_checked()
            modal = graph.evaluate(snapshot)
            after = preview.evaluate(snapshot)
            full_count = len(modal['urls'])
            # Native modal makes the background inert. Check the complete URL
            # sets of each interactive view, before opening and after closing.
            assert modal['kind'] == 'all' and modal['urls'] == expected_urls and modal['count'] == full_count, (width, 'graph parity', before, modal, after, expected_urls)
            assert graph.evaluate(check_labels)["intersections"] == 0
            assert graph.locator(".graph-node").first.get_attribute("aria-label")
            graph.locator(".graph-node").first.focus()
            assert "ارتباط" in page.locator("[data-graph-detail]").inner_text()
            page.locator('[data-graph-zoom="in"]').click()
            assert float(graph.get_attribute("data-scale")) > 1
            page.wait_for_timeout(300) # allow ResizeObserver to settle; camera must survive
            assert float(graph.get_attribute('data-scale')) > 1, (width, 'camera reset after resize')
            assert graph.evaluate(check_labels)["intersections"] == 0
            page.locator('[data-graph-pan="right"]').click()
            assert graph.evaluate(check_labels)["intersections"] == 0
            page.locator('[data-graph-zoom="reset"]').click()
            assert graph.get_attribute("data-scale") == "1"
            page.locator(".graph-atlas-settings summary").click()
            initial_counts = {kind: graph.locator(f'.graph-node[data-kind="{kind}"]').count() for kind in ("article", "note")}
            assert all(initial_counts.values()) and sum(initial_counts.values()) == full_count, (width, initial_counts, graph.inner_html()[:500])
            for kind, expected in initial_counts.items():
                page.locator('[data-graph-option="kind"]').select_option(kind)
                page.wait_for_function("""({kind,count}) => {
                    const el=document.querySelector('[data-global-graph]');
                    return el.dataset.graphReady==='true' && el.dataset.graphKind===kind && Number(el.dataset.graphCount)===count &&
                        el.querySelectorAll('.graph-node').length===count &&
                        el.querySelectorAll('.graph-node[data-kind="'+kind+'"]').length===count;
                }""", arg={"kind":kind,"count":expected})
                assert page.locator('[data-graph-pages] a').count() == expected
                assert graph.evaluate(check_labels)["intersections"] == 0
            page.locator('[data-graph-option="kind"]').select_option("all")
            page.wait_for_function("""count => {
                const el=document.querySelector('[data-global-graph]');
                return el.dataset.graphReady==='true' && el.dataset.graphKind==='all' && el.querySelectorAll('.graph-node').length===count;
            }""", arg=full_count)
            page.locator('[data-graph-option="spread"]').evaluate("(el)=>{el.value='140';el.dispatchEvent(new Event('change',{bubbles:true}))}")
            assert graph.evaluate(check_labels)["intersections"] == 0
            page.locator('[data-graph-option="labels"]').select_option("off")
            page.wait_for_function("Array.from(document.querySelectorAll('[data-global-graph] .graph-node text')).every(el=>getComputedStyle(el).visibility==='hidden')")
            assert graph.evaluate(check_labels)["visible"] == 0
            page.locator('[data-graph-option="labels"]').select_option("auto")
            page.locator('[data-graph-option="spread"]').evaluate("(el)=>{el.value='100';el.dispatchEvent(new Event('change',{bubbles:true}))}")
            page.locator(".graph-atlas-settings summary").click()
            page.locator("#garden-graph").screenshot(path=str(output / f"dialog-{width}.png"))
            page.keyboard.press("Escape")
            assert not page.locator("#garden-graph").is_visible()
            page.wait_for_function("""urls=>{const c=document.querySelector('[data-atlas-preview]');return c.dataset.graphReady==='true'&&JSON.stringify([...c.querySelectorAll('.graph-node')].map(a=>a.getAttribute('href')).sort())===JSON.stringify(urls)}""",arg=expected_urls)
            restored=preview.evaluate(snapshot)
            assert restored['urls']==expected_urls and restored['count']==full_count, (width,'restored inline atlas',restored)
            assert preview.evaluate(check_labels)['intersections']==0
            if width == 1440:
                article = next(u for u in expected_urls if '/notes/' not in u)
                page.goto('http://127.0.0.1:8765' + article, wait_until='load')
                controls = page.locator('[data-workspace-panes]')
                controls.locator('summary').click()
                context = page.locator('#garden-context')
                toggle = controls.locator('[data-workspace-toggle="context"]')
                assert context.is_visible()
                toggle.click()
                assert not context.is_visible() and context.evaluate('(el)=>el.inert')
                toggle.click()
                slider = controls.locator('[data-workspace-width="context"]')
                slider.press('End')
                assert slider.input_value() == '280'
                assert abs(context.bounding_box()['width'] - 280) <= 2
                controls.locator('[data-workspace-focus]').click()
                assert not context.is_visible() and not page.locator('#garden-navigation').is_visible()
                controls.locator('[data-workspace-focus]').click()
                assert context.is_visible() and slider.input_value() == '280'
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                controls.locator('[data-workspace-reset]').click()
                controls.locator('summary').click()
                page.screenshot(path=str(output / 'workspace-article-1440.png'),full_page=False)
            # Real canonical graph links and local opt-in history (including reload).
            article_url = next(u for u in expected_urls if '/notes/' not in u)
            page.goto('http://127.0.0.1:8765' + article_url, wait_until='load')
            history = page.locator('[data-reading-history]')
            history.wait_for(state='visible')
            assert history.locator('[data-reading-toggle]').get_attribute('aria-pressed') == 'false'
            assert page.evaluate("localStorage.getItem('hades-reading-trail-v1')") is None
            current = raw_graph['nodes'][article_url]
            node_by_id = {n['id']:n['url'] for n in raw_graph['nodes'].values() if n['url'] in expected_urls}
            links = raw_graph.get('links', raw_graph.get('edges', []))
            related_urls = sorted({node_by_id[e['target'] if e['source']==current['id'] else e['source']] for e in links if (e['source']==current['id'] and e['target'] in node_by_id or e['target']==current['id'] and e['source'] in node_by_id)} - {article_url})
            related = page.locator('[data-reading-related]')
            actual = sorted(related.locator('a[href]').evaluate_all("(els)=>els.map(a=>a.getAttribute('href'))"))
            assert actual == related_urls, (width, actual, related_urls)
            relation_filter = related.locator('[data-reading-relation]')
            if related_urls:
                assert relation_filter.is_visible()
                expected_relations = {}
                for url_item in related_urls:
                    node_id = raw_graph['nodes'][url_item]['id']
                    outgoing = any(e['source']==current['id'] and e['target']==node_id for e in links)
                    incoming = any(e['target']==current['id'] and e['source']==node_id for e in links)
                    expected_relations[url_item] = 'mutual' if outgoing and incoming else 'outgoing' if outgoing else 'incoming'
                actual_relations = related.locator('li[data-relation]').evaluate_all("(els)=>Object.fromEntries(els.map(el=>[el.querySelector('a').getAttribute('href'),el.dataset.relation]))")
                assert actual_relations == expected_relations, (width,actual_relations,expected_relations)
                relation_filter.focus()
                relation_filter.press('Home')
                relation_filter.press('ArrowDown')
                assert relation_filter.input_value() == 'mutual'
                for relation in ('mutual','outgoing','incoming','all'):
                    relation_filter.select_option(relation)
                    expected_visible = sorted(u for u,r in expected_relations.items() if relation=='all' or r==relation)
                    actual_visible = sorted(related.locator('li[data-relation]:visible a').evaluate_all("(els)=>els.map(a=>a.getAttribute('href'))"))
                    assert actual_visible == expected_visible, (width,relation,actual_visible,expected_visible)
                related.screenshot(path=str(output / f"reading-relations-{width}.png"))
            toggle = history.locator('[data-reading-toggle]')
            toggle.focus()
            toggle.press('Space')
            assert toggle.get_attribute('aria-pressed') == 'true'
            assert history.locator('[data-reading-visits] a').count() == 1
            page.reload(wait_until='load')
            history.wait_for(state='visible')
            assert toggle.get_attribute('aria-pressed') == 'true'
            assert history.locator('[data-reading-visits] a').count() == 1
            if related_urls:
                page.goto('http://127.0.0.1:8765' + related_urls[0], wait_until='load')
                history.wait_for(state='visible')
                assert history.locator('[data-reading-visits] a').count() == 2
            page.goto(url, wait_until='load')
            recent.wait_for(state='visible')
            expected_recent = [related_urls[0], article_url] if related_urls else [article_url]
            assert recent.locator('ol a').evaluate_all("(els)=>els.map(a=>a.getAttribute('href'))") == expected_recent
            recent.screenshot(path=str(output / f"recent-reading-{width}.png"))
            recent.locator('[data-recent-manage]').press('Enter')
            assert page.evaluate("location.hash") == '#reading-history-title'
            assert history.is_visible()
            history.locator('[data-reading-clear]').click()
            assert recent.locator('ol a').count() == 0
            history.scroll_into_view_if_needed()
            page.screenshot(path=str(output / f"reading-trail-{width}.png"), full_page=False)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            assert history.locator('[data-reading-clear]').is_disabled()
            assert history.locator('[data-reading-visits] a').count() == 0
            toggle.click()
            assert recent.locator('ol a').count() == 0
            assert page.evaluate("JSON.parse(localStorage.getItem('hades-reading-trail-v1')).enabled === false")
            assert not errors, (width, errors)
            results.append({"width": width, "nodes": full_count, "counts": initial_counts, "preview": preview_result, "background_while_modal": after, "restored_count": restored["count"], "console_page_errors": errors, "status": "PASS"})
            page.close()
        browser.close()
finally:
    (output / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    server.terminate()
print(json.dumps(results, indent=2))

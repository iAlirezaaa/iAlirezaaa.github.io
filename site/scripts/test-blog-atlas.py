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
            page = browser.new_page(viewport={"width": width, "height": 900}, reduced_motion="reduce", has_touch=width <= 430)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(url, wait_until="load")
            assert page.locator('[data-blog-comments]').count() == 0
            assert page.locator('[data-recent-reading]').count() == 0
            assert page.evaluate("localStorage.getItem('hades-reading-trail-v1')") is None
            # Exactly one actual primary action, shared across all viewports.
            for selector in ('[data-panel-open="navigation"]','[data-search-open]','[data-global-graph-open]','[data-settings-open]'):
                assert page.locator(selector).count() == 1, (width, 'duplicate control',selector)
                assert page.locator(selector).is_visible(), (width, 'missing visible control',selector)
            for selector in ('.workspace-strip','.workspace-ribbon','.topbar-links','.garden-search-button','[data-tree-filter]','.garden-directory-nav'):
                assert page.locator(selector).count() == 0, (width, 'duplicate menu remains',selector)
            nav = page.locator('#garden-navigation')
            nav_button = page.locator('[data-panel-open="navigation"]')
            page.wait_for_selector('[data-filetree][data-tree-ready="true"]',state='attached')
            if width <= 900:
                assert nav.evaluate('(el)=>el.inert')
                nav_button.click()
            assert nav.is_visible() and not nav.evaluate('(el)=>el.inert')
            assert nav_button.get_attribute('aria-expanded') == 'true'
            tree=nav.locator('[data-filetree]')
            urls=tree.evaluate("el=>[...el.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).sort()")
            assert urls == expected_tree_urls, (width,'rendered tree URL parity',urls,expected_tree_urls)
            if width <= 900:
                page.keyboard.press('Escape')
                assert nav.evaluate('(el)=>el.inert')
                assert nav_button.evaluate('(el)=>document.activeElement===el')
            else:
                nav_button.press('Space')
                assert not nav.is_visible() and nav_button.get_attribute('aria-expanded') == 'false'
                nav_button.press('Space')
                assert nav.is_visible() and nav_button.get_attribute('aria-expanded') == 'true'
            search = page.locator('[data-search-open]')
            search.click()
            assert page.locator('#garden-search').is_visible()
            page.locator('#garden-search-input').fill('DDPM')
            page.wait_for_function("document.querySelector('#garden-search-results')?.textContent.includes('DDPM')")
            page.keyboard.press('Escape')
            assert not page.locator('#garden-search').is_visible()
            assert search.evaluate('(el)=>document.activeElement===el')
            if width > 900:
                page.locator('[data-settings-open]').click()
                controls=page.locator('[data-workspace-panes]')
                controls.locator('summary').click()
                slider=controls.locator('[data-workspace-width="navigation"]')
                slider.press('End')
                assert slider.input_value() == '300'
                assert abs(nav.bounding_box()['width']-300) <= 2
                focus=controls.locator('[data-workspace-focus]')
                focus.click()
                assert not nav.is_visible()
                focus.click()
                assert nav.is_visible()
                assert slider.input_value() == '300'
                controls.locator('[data-workspace-reset]').click()
                assert slider.input_value() == '230'
                page.keyboard.press('Escape')
            page.evaluate('document.fonts.ready')
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
            page.locator("[data-global-graph-open]").click()
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
            # Mouse or actual Chromium touch input moves a node and all its connected edges.
            node = graph.locator('.graph-node').first
            dot = node.locator('circle:not(.graph-hit)').first
            node_id = node.get_attribute('data-graph-id')
            graph.scroll_into_view_if_needed()
            # Responsive reflow can change the coordinate system when inspector text wraps.
            # Compare actual relative positions to the original home position, not stale pixels.
            position = """el=>{const v=el.ownerSVGElement.viewBox.baseVal;return [Number(el.getAttribute('cx'))/v.width,Number(el.getAttribute('cy'))/v.height]}"""
            page.wait_for_function("""()=>{const c=document.querySelector('[data-global-graph]'),v=c.querySelector('svg').viewBox.baseVal;return v.width===Math.max(200,c.clientWidth)&&v.height===Math.max(200,c.clientHeight)}""")
            original_normalized = dot.evaluate(position)
            original = (float(dot.get_attribute('cx')), float(dot.get_attribute('cy')))
            box = dot.bounding_box()
            bounds = graph.bounding_box()
            x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
            dx = 28 if x < bounds['x'] + bounds['width']/2 else -28
            dy = 14 if y < bounds['y'] + bounds['height']/2 else -14
            previous_url = page.url
            if width <= 430:
                cdp = page.context.new_cdp_session(page)
                cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+dx/2,'y':y+dy/2}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+dx,'y':y+dy}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                cdp.detach()
            else:
                page.mouse.move(x,y)
                page.mouse.down()
                page.mouse.move(x+dx,y+dy,steps=5)
                page.mouse.up()
            page.wait_for_function("document.querySelector('[data-global-graph]')?.dataset.layoutChanged==='true'")
            moved = (float(dot.get_attribute('cx')),float(dot.get_attribute('cy')))
            assert abs(moved[0]-original[0])+abs(moved[1]-original[1]) > 8, (width,original,moved)
            assert page.url == previous_url, (width,'drag navigated away')
            assert graph.evaluate("""(el,id)=>{const n=[...el.querySelectorAll('.graph-node')].find(a=>a.dataset.graphId===id);const c=n.querySelector('circle:not(.graph-hit)');const edges=[...el.querySelectorAll('.graph-edge')].filter(e=>e.dataset.source===id||e.dataset.target===id);return edges.length>0&&edges.every(e=>{const k=e.dataset.source===id?'1':'2';return e.getAttribute('x'+k)===c.getAttribute('cx')&&e.getAttribute('y'+k)===c.getAttribute('cy')})}""", node_id)
            node.focus()
            node.press('ArrowRight')
            assert float(dot.get_attribute('cx')) > moved[0]
            assert graph.evaluate(check_labels)['intersections'] == 0
            reset_button = page.locator('[data-graph-zoom="reset"]')
            reset_button.scroll_into_view_if_needed()
            reset_button.click()
            assert graph.get_attribute('data-layout-changed') is None, (width, 'reset click did not fire')
            reset_normalized = dot.evaluate(position)
            assert max(abs(a-b) for a,b in zip(original_normalized, reset_normalized)) < .003, (width, 'reset relative position', original_normalized, reset_normalized)
            assert graph.get_attribute('data-layout-changed') is None
            # Resize while a node has been moved, then check normalized position and camera.
            node.focus()
            node.press('ArrowRight')
            page.locator('[data-graph-zoom="in"]').click()
            before_resize = dot.evaluate(position)
            old_viewbox = graph.locator('svg').get_attribute('viewBox')
            page.set_viewport_size({'width':width+24,'height':850})
            page.wait_for_function("old=>document.querySelector('[data-global-graph] svg').getAttribute('viewBox')!==old",arg=old_viewbox)
            assert max(abs(a-b) for a,b in zip(before_resize,dot.evaluate(position))) < .003, (width, 'node position lost on resize')
            assert float(graph.get_attribute('data-scale')) > 1
            page.set_viewport_size({'width':width,'height':900})
            page.wait_for_function("""()=>{const c=document.querySelector('[data-global-graph]'),v=c.querySelector('svg').viewBox.baseVal;return v.width===Math.max(200,c.clientWidth)&&v.height===Math.max(200,c.clientHeight)}""")
            page.locator('[data-graph-zoom="reset"]').click()
            page.locator('[data-graph-zoom="in"]').click()
            assert float(graph.get_attribute("data-scale")) > 1
            page.wait_for_timeout(300) # allow ResizeObserver to settle; camera must survive
            assert float(graph.get_attribute('data-scale')) > 1, (width, 'camera reset after resize')
            assert graph.evaluate(check_labels)["intersections"] == 0
            page.locator('.graph-atlas-settings summary').click()
            page.locator('[data-graph-pan="right"]').click()
            page.locator('.graph-atlas-settings summary').click()
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
                context = page.locator('#garden-context')
                toggle=page.locator('[data-panel-open="context"]')
                assert context.is_visible()
                toggle.click()
                assert not context.is_visible() and context.evaluate('(el)=>el.inert')
                toggle.click()
                page.locator('[data-settings-open]').click()
                controls=page.locator('[data-workspace-panes]')
                controls.locator('summary').click()
                slider=controls.locator('[data-workspace-width="context"]')
                slider.press('End')
                assert slider.input_value() == '280'
                assert abs(context.bounding_box()['width'] - 280) <= 2
                controls.locator('[data-workspace-reset]').click()
                page.keyboard.press('Escape')
                assert context.is_visible()
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
                page.screenshot(path=str(output / 'workspace-article-1440.png'),full_page=False)
            # Real canonical graph links and local opt-in history (including reload).
            article_url = next(u for u in expected_urls if '/notes/' not in u)
            page.goto('http://127.0.0.1:8765' + article_url, wait_until='load')
            comments = page.locator('[data-blog-comments]')
            assert comments.count() == 1
            issue = comments.get_attribute('data-issue')
            assert issue and issue.isdigit()
            write = comments.locator('.comment-write')
            assert write.get_attribute('href') == 'https://github.com/iAlirezaaa/iAlirezaaa.github.io/issues/' + issue + '#new_comment_field'
            api = 'https://api.github.com/repos/iAlirezaaa/iAlirezaaa.github.io/issues/' + issue + '/comments?per_page=100'
            # Synthetic read-only response; never post a test comment publicly.
            unsafe = '<img src=x onerror=alert(1)> TEST_COMMENT'
            response = [{"id":123456,"body":unsafe,"user":{"login":"fixture-user"},"created_at":"2026-11-25T10:00:00Z"}]
            page.route(api, lambda route: route.fulfill(status=200, headers={"Access-Control-Allow-Origin":"*"}, json=response))
            comments.locator('[data-comments-load]').press('Enter')
            page.wait_for_function("document.querySelector('[data-comments-list]')?.textContent.includes('TEST_COMMENT')")
            assert comments.locator('.blog-comment-body').inner_text() == unsafe
            assert comments.locator('[data-comments-list] img').count() == 0
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            comments.screenshot(path=str(output / f"comments-{width}.png"))
            page.unroute(api)
            page.route(api, lambda route: route.fulfill(status=403, headers={"Access-Control-Allow-Origin":"*"}, json={"message":"rate limit"}))
            comments.locator('[data-comments-load]').click()
            page.wait_for_function("document.querySelector('[data-comments-status]')?.textContent.includes('ممکن نشد')")
            assert write.is_visible()
            page.unroute(api)
            history = page.locator('[data-reading-history]')
            page.wait_for_selector('[data-reading-history]:not([hidden])',state='attached')
            assert history.locator('[data-reading-toggle]').get_attribute('aria-pressed') == 'false'
            assert page.locator('.reader-inline-toc').count() == 0
            assert page.locator('[data-global-graph-open]').count() == 1
            assert page.locator('[data-search-open]').count() == 1
            assert page.locator('[data-settings-open]').count() == 1
            assert page.evaluate("localStorage.getItem('hades-reading-trail-v1')") is None
            current = raw_graph['nodes'][article_url]
            node_by_id = {n['id']:n['url'] for n in raw_graph['nodes'].values() if n['url'] in expected_urls}
            links = raw_graph.get('links', raw_graph.get('edges', []))
            related_urls = sorted({node_by_id[e['target'] if e['source']==current['id'] else e['source']] for e in links if (e['source']==current['id'] and e['target'] in node_by_id or e['target']==current['id'] and e['source'] in node_by_id)} - {article_url})
            related = page.locator('[data-reading-related]')
            page.wait_for_selector('[data-reading-related][data-related-ready="true"]',state='attached')
            actual = sorted(related.locator('a[href]').evaluate_all("(els)=>els.map(a=>a.getAttribute('href'))"))
            assert actual == related_urls, (width, actual, related_urls)
            local = page.locator('[data-local-graph]')
            if width < 1241:
                page.locator('.mobile-context-toggle').click()
            local.wait_for(state='visible')
            page.wait_for_selector('[data-local-graph][data-graph-ready="true"] .graph-node')
            page.evaluate("document.fonts.ready")
            center = local.locator('.graph-node[data-current="true"]')
            assert center.count() == 1
            assert center.evaluate("""el=>{const s=el.closest('svg').viewBox.baseVal; const c=el.querySelector('circle:not(.graph-hit)');return Math.abs(Number(c.getAttribute('cx'))-s.width/2)<1&&Math.abs(Number(c.getAttribute('cy'))-s.height/2)<1}""")
            detail = page.locator('[data-local-detail]')
            assert center.get_attribute('aria-label') in detail.inner_text()
            assert 'ارتباط' in page.locator('[data-local-count]').inner_text()
            other = local.locator('.graph-node[data-current="false"]').first
            if other.count():
                other.focus()
                assert other.get_attribute('aria-label') in detail.inner_text()
                assert local.locator('.graph-edge.is-related').count() > 0
                center.focus()
                assert center.get_attribute('aria-label') in detail.inner_text()
            assert local.evaluate(check_labels)['intersections'] == 0
            depth_control = page.locator('[data-local-depth]')
            if depth_control.count():
                assert depth_control.is_visible()
                valid_ids = set(node_by_id)
                for depth in (2,3,1):
                    found = {current['id']}
                    for _ in range(depth):
                        found |= {e['target'] for e in links if e['source'] in found and e['target'] in valid_ids} | {e['source'] for e in links if e['target'] in found and e['source'] in valid_ids}
                    depth_control.select_option(str(depth))
                    expected_depth_urls = sorted(node_by_id[i] for i in found)
                    page.wait_for_function("""urls=>{const c=document.querySelector('[data-local-graph]');return c.dataset.graphReady==='true'&&JSON.stringify([...c.querySelectorAll('.graph-node')].map(a=>a.getAttribute('href')).sort())===JSON.stringify(urls)}""",arg=expected_depth_urls)
                    assert local.evaluate(check_labels)['intersections'] == 0
            page.locator('[data-local-graph-section]').screenshot(path=str(output / f"local-inspector-{width}.png"))
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
            if width < 1241:
                page.keyboard.press('Escape')
                assert not page.locator('#garden-context').is_visible()
            page.locator('[data-settings-open]').click()
            history.locator('summary').click()
            toggle = history.locator('[data-reading-toggle]')
            toggle.focus()
            toggle.press('Space')
            assert toggle.get_attribute('aria-pressed') == 'true'
            assert history.locator('[data-reading-visits] a').count() == 1
            page.reload(wait_until='load')
            page.locator('[data-settings-open]').click()
            history.wait_for(state='visible')
            history.locator('summary').click()
            assert toggle.get_attribute('aria-pressed') == 'true'
            assert history.locator('[data-reading-visits] a').count() == 1
            if related_urls:
                page.goto('http://127.0.0.1:8765' + related_urls[0], wait_until='load')
                page.locator('[data-settings-open]').click()
                history.wait_for(state='visible')
                history.locator('summary').click()
                assert history.locator('[data-reading-visits] a').count() == 2
            page.goto(url, wait_until='load')
            assert page.locator('[data-recent-reading]').count() == 0
            page.locator('[data-settings-open]').click()
            history.wait_for(state='visible')
            history.locator('summary').click()
            expected_recent = [related_urls[0],article_url] if related_urls else [article_url]
            assert history.locator('[data-reading-visits] a').evaluate_all("(els)=>els.map(a=>a.getAttribute('href'))") == expected_recent
            history.locator('[data-reading-clear]').click()
            assert history.locator('[data-reading-visits] a').count() == 0
            assert history.locator('[data-reading-clear]').is_disabled()
            toggle.click()
            assert page.evaluate("JSON.parse(localStorage.getItem('hades-reading-trail-v1')).enabled === false")
            page.keyboard.press('Escape')
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            assert not errors, (width, errors)
            results.append({"width": width, "nodes": full_count, "counts": initial_counts, "preview": preview_result, "background_while_modal": after, "restored_count": restored["count"], "console_page_errors": errors, "status": "PASS"})
            page.close()
        browser.close()
finally:
    (output / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    server.terminate()
print(json.dumps(results, indent=2))

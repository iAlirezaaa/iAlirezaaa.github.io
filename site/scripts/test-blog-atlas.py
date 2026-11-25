"""Chromium smoke test for built blog knowledge atlas; no production claims."""
import json
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
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (320, 390, 430, 1440):
            page = browser.new_page(viewport={"width": width, "height": 900}, reduced_motion="reduce")
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(url, wait_until="load")
            preview = page.locator("[data-atlas-preview]")
            preview.locator(".graph-node").first.wait_for()
            page.evaluate("document.fonts.ready")
            preview.scroll_into_view_if_needed()
            preview_result = preview.evaluate(check_labels)
            assert preview_result["intersections"] == 0, (width, preview_result)
            assert preview.locator(".graph-node").count() >= 12
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (width, "page overflow")
            preview.screenshot(path=str(output / f"preview-{width}.png"))
            page.locator(".atlas-preview-header button").click()
            graph = page.locator("[data-global-graph]")
            graph.locator(".graph-node").first.wait_for()
            page.evaluate("document.fonts.ready")
            assert not page.locator('[data-graph-option="motion"]').is_checked()
            full_count = graph.locator(".graph-node").count()
            assert full_count == preview.locator(".graph-node").count()
            assert graph.evaluate(check_labels)["intersections"] == 0
            assert graph.locator(".graph-node").first.get_attribute("aria-label")
            graph.locator(".graph-node").first.focus()
            assert "ارتباط" in page.locator("[data-graph-detail]").inner_text()
            page.locator('[data-graph-zoom="in"]').click()
            assert float(graph.get_attribute("data-scale")) > 1
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
                    return el.dataset.graphKind===kind && Number(el.dataset.graphCount)===count &&
                        el.querySelectorAll('.graph-node').length===count &&
                        el.querySelectorAll('.graph-node[data-kind="'+kind+'"]').length===count;
                }""", arg={"kind":kind,"count":expected})
                assert page.locator('[data-graph-pages] a').count() == expected
                assert graph.evaluate(check_labels)["intersections"] == 0
            page.locator('[data-graph-option="kind"]').select_option("all")
            page.wait_for_function("""count => {
                const el=document.querySelector('[data-global-graph]');
                return el.dataset.graphKind==='all' && el.querySelectorAll('.graph-node').length===count;
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
            assert not errors, (width, errors)
            results.append({"width": width, "nodes": full_count, "counts": initial_counts, "preview": preview_result, "console_page_errors": errors, "status": "PASS"})
            page.close()
        browser.close()
finally:
    (output / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    server.terminate()
print(json.dumps(results, indent=2))

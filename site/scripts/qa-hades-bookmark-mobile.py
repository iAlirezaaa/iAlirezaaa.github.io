#!/usr/bin/env python3
"""Real Chromium FA/EN bookmark gallery QA at 320/390/430 CSS pixels."""
from __future__ import annotations
import functools
import http.server
import json
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SERVE = ROOT / "site/public"
SHOTS = ROOT / "bookmark-mobile-review-proofs"
SHOTS.mkdir(exist_ok=True)
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SERVE))
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=httpd.serve_forever, daemon=True)
thread.start()
BASE = f"http://127.0.0.1:{httpd.server_address[1]}"
results = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for lang, route in [("EN", "/hades/library/bookmarks/"),
                            ("FA", "/hades/fa/library/bookmarks/")]:
            for width in [320, 390, 430]:
                page = browser.new_page(viewport={"width": width, "height": 940},
                                        device_scale_factor=1)
                errors = []
                page.on("pageerror", lambda err: errors.append(str(err)))
                response = page.goto(BASE + route, wait_until="load")
                assert response and response.status == 200, (lang, width, response)
                page.locator("img").first.wait_for(state="visible")
                data = page.evaluate("""() => ({
                    scrollWidth: document.documentElement.scrollWidth,
                    viewportWidth: innerWidth,
                    imgs: [...document.images].map(i => ({
                        src:i.currentSrc.split('/').pop(),
                        loaded:i.complete && i.naturalWidth>0
                    })),
                    pdf: [...document.querySelectorAll('a')].filter(a=>a.href.endsWith('.pdf')).length,
                    zip: [...document.querySelectorAll('a')].filter(a=>a.href.endsWith('.zip')).length,
                    manifest: [...document.querySelectorAll('a')].filter(a=>a.href.endsWith('.json')).length,
                    dir: document.documentElement.getAttribute('dir'),
                    lang: document.documentElement.getAttribute('lang')
                })""")
                assert data["scrollWidth"] <= width+1, (lang, width, data)
                assert all(i["loaded"] for i in data["imgs"]), (lang,width,data["imgs"])
                assert data["pdf"] >= 1 and data["zip"] >= 1 and data["manifest"] >= 1, data
                assert data["lang"].lower() == lang.lower(), data
                assert data["dir"] == ("rtl" if lang=="FA" else "ltr"), data
                assert not errors, errors
                name = f"HADES_Bookmark_Gallery_{lang}_{width}_REVIEW.png"
                page.screenshot(path=str(SHOTS / name),full_page=True, animations="disabled")
                results.append({"lang":lang,"width":width,"status":"PASS",
                                "images":len(data["imgs"]), "scrollWidth":data["scrollWidth"]})
                page.close()
        browser.close()
finally:
    httpd.shutdown()
assert len(results) == 6
(SHOTS/"QA_6_viewports_REVIEW.json").write_text(
    json.dumps({"state":"PUBLIC REVIEW — NOT FINAL","results":results},indent=2)+"\n",
    encoding="utf-8")
print(json.dumps({"status":"PASS","runs":results},ensure_ascii=False))

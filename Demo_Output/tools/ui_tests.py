"""TC-08 (confidence filter) and TC-27 (alert date filter) through the real UI (headless Edge)."""
import os, json, re, urllib.request, collections
from playwright.sync_api import sync_playwright
ROOT = r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield"
PPE = ROOT + r"\Test_Data\PPE.jpg"
SHOT = ROOT + r"\Demo_Output\screenshots"
out = {}

def api(path):
    return json.load(urllib.request.urlopen("http://127.0.0.1:8000" + path, timeout=60))

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    pg.goto("http://127.0.0.1:5173/"); pg.wait_for_timeout(1000)
    pg.fill("input[placeholder='Enter username']", "admin")
    pg.fill("input[placeholder='Enter password']", os.environ["VS_ADMIN_PASSWORD"])
    pg.click("button[type=submit]"); pg.wait_for_selector(".sidebar-nav-item", timeout=120000); pg.wait_for_timeout(2000)

    # ---------- TC-08
    pg.locator(".sidebar-nav-item", has_text="AI Safety Monitoring").first.click(); pg.wait_for_timeout(1500)
    pg.locator("input[type=file]").first.set_input_files(PPE); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="Run AI Detection").click()
    pg.wait_for_selector("text=Image Detection Results", timeout=120000); pg.wait_for_timeout(1500)
    def classes():
        return [re.sub(r"\s+", " ", t).strip()[:60] for t in pg.locator(".class-summary-header").all_inner_texts()]
    before = classes()
    pg.screenshot(path=SHOT + r"\tc08_conf_0.png")
    pg.locator("input[type=range]").first.fill("50"); pg.wait_for_timeout(800)
    after = classes()
    pg.screenshot(path=SHOT + r"\tc08_conf_50.png")
    out["TC-08"] = {"before_0pct": before, "after_50pct": after}

    # ---------- TC-27
    resolved = []
    page = 1
    while True:
        d = api(f"/api/alerts?status_filter=Resolved&show_recent_resolved=false&limit=100&page={page}")
        resolved += [a for a in d["alerts"] if a.get("resolved_at")]
        if page >= d["pagination"]["total_pages"]: break
        page += 1
    # group by UTC date of resolved_at
    def utc_date(s):
        from datetime import datetime, timezone
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).date().isoformat()
    by_day = collections.Counter(utc_date(a["resolved_at"]) for a in resolved)
    out["resolved_total"] = len(resolved); out["by_day"] = dict(by_day)
    day = by_day.most_common(1)[0][0]
    pg.locator(".sidebar-nav-item", has_text="Alerts").first.click(); pg.wait_for_timeout(2500); pg.get_by_text("Resolved Alerts").first.click(); pg.wait_for_timeout(1500)
    pg.fill("input.filter-date", day); pg.wait_for_timeout(2500)
    shown = pg.locator(".filter-results").inner_text()
    pg.screenshot(path=SHOT + r"\tc27_date_filter.png")
    api_count = api(f"/api/alerts?date_filter={day}&limit=100")["pagination"]["total_alerts"]
    pg.fill("input.filter-date", "2020-01-01"); pg.wait_for_timeout(2000)
    empty = pg.locator(".filter-results").inner_text()
    out["TC-27"] = {"date": day, "ui_text": re.sub(r"\s+", " ", shown), "expected_count_from_data": by_day[day],
                    "api_total_for_date": api_count, "ui_text_date_without_alerts": re.sub(r"\s+", " ", empty)}
    b.close()
json.dump(out, open(ROOT + r"\Demo_Output\reports\ui_test_results.json", "w"), indent=2)
print(json.dumps(out, indent=2))

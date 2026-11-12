"""Captures high-resolution screenshots of the working VisionShield app (2x scale) for PPT / poster / README.
Reads the admin password from env VS_ADMIN_PASSWORD."""
import os
from playwright.sync_api import sync_playwright
ROOT = r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield"
OUT = ROOT + r"\Demo_Output\screenshots\final"
PPE = ROOT + r"\Test_Data\PPE.jpg"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    ctx = b.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=2)
    pg = ctx.new_page()
    def shot(name): pg.wait_for_timeout(900); pg.screenshot(path=f"{OUT}/{name}.png"); print("saved", name)
    def nav(label): pg.locator(".sidebar-nav-item", has_text=label).first.click(); pg.wait_for_timeout(3500)
    def top(sel):
        pg.evaluate("s=>{const e=document.querySelector(s)||[...document.querySelectorAll('h1,h2,h3,span,div')].find(x=>x.textContent.trim()===s); if(e) e.scrollIntoView({block:'start'})}", sel)
        pg.wait_for_timeout(900)

    pg.goto("http://127.0.0.1:5173/"); pg.wait_for_timeout(2000); shot("01_login")
    pg.fill("input[placeholder='Enter username']", "admin")
    pg.fill("input[placeholder='Enter password']", os.environ["VS_ADMIN_PASSWORD"])
    pg.click("button[type=submit]"); pg.wait_for_selector(".sidebar-nav-item", timeout=120000); pg.wait_for_timeout(3500)
    shot("02_dashboard")

    nav("Alerts"); pg.get_by_text("Resolved Alerts").first.click(); pg.wait_for_timeout(2500); shot("03_alerts")

    nav("AI Safety Monitoring")
    pg.locator("input[type=file]").first.set_input_files(PPE); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="Run AI Detection").click()
    pg.wait_for_selector("text=Image Detection Results", timeout=180000); pg.wait_for_timeout(2500)
    shot("04_ai_safety_upload")
    pg.mouse.wheel(0, 650); shot("04b_ai_safety_result")

    nav("Sensor Analytics"); shot("05_sensor_analytics")

    nav("Live Monitoring"); shot("06_live_monitoring")
    pg.mouse.wheel(0, 900); shot("06b_live_charts")

    import json, urllib.request
    jobs = json.load(urllib.request.urlopen("http://127.0.0.1:8000/api/process/jobs"))["jobs"]
    pg.evaluate("j=>localStorage.setItem('visionshield_process_jobs', JSON.stringify(j))", jobs)
    nav("Process Detection"); shot("07_process_detection")
    pg.get_by_role("button", name="Load Result").first.click()
    pg.wait_for_selector("text=SOP Process Sequence", timeout=60000); pg.wait_for_timeout(1500)
    top("SOP Process Sequence"); shot("08_process_sop")
    pg.mouse.wheel(0, 520); shot("08b_process_alerts_stats")
    v = pg.locator("video").last
    v.scroll_into_view_if_needed(); pg.wait_for_timeout(1000)
    v.evaluate("v=>{v.muted=true; v.currentTime=24; v.pause();}"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('video').scrollIntoView({block:'center'})"); pg.wait_for_timeout(800)
    shot("08c_process_annotated_video")

    nav("Settings"); shot("09_settings")      # top of page only (no contact details)
    nav("Maintenance Management"); shot("10_maintenance")
    nav("User Management"); shot("11_user_management")
    b.close()

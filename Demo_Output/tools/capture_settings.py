import os
from playwright.sync_api import sync_playwright
OUT = r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output\screenshots\final"
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=2).new_page()
    pg.goto("http://127.0.0.1:5173/"); pg.wait_for_timeout(1500)
    pg.fill("input[placeholder='Enter username']", "admin"); pg.fill("input[placeholder='Enter password']", os.environ["VS_ADMIN_PASSWORD"])
    pg.click("button[type=submit]"); pg.wait_for_selector(".sidebar-nav-item", timeout=120000); pg.wait_for_timeout(2500)
    pg.locator(".sidebar-nav-item", has_text="Settings").first.click(); pg.wait_for_timeout(3000)
    pg.mouse.move(900, 500); pg.mouse.wheel(0, -4000); pg.wait_for_timeout(1000)
    txt = pg.inner_text("body")
    print("email visible on screen text:", "@gmail" in txt.split("Alert Notifications")[0] if "Alert Notifications" in txt else "n/a")
    pg.screenshot(path=OUT + r"\09_settings.png"); b.close()

import os
import sys, json
from playwright.sync_api import sync_playwright
OUT=r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output\screenshots"
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge",headless=True)
    pg=b.new_page(viewport={"width":1600,"height":900})
    errs=[]
    pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.on("response",lambda r: errs.append(f"HTTP {r.status} {r.url}") if r.status>=400 else None)
    pg.goto("http://127.0.0.1:5173/"); pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+r"\00_login.png")
    print([i.get_attribute("placeholder") for i in pg.query_selector_all("input")])
    pg.fill("input[placeholder='Enter username']","admin"); pg.fill("input[placeholder='Enter password']",os.environ["VS_ADMIN_PASSWORD"])
    pg.click("button[type=submit]"); pg.wait_for_timeout(4000)
    pg.screenshot(path=OUT+r"\01_dashboard.png")
    print([ (x.inner_text().strip().replace("\n"," ")) for x in pg.query_selector_all(".sidebar button")])
    print(errs)
    b.close()

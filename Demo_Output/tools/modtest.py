import os
import json
from playwright.sync_api import sync_playwright
OUT=r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output\screenshots"
pages=["Dashboard","Alerts","AI Safety Monitoring","Sensor Analytics","Live Monitoring","Process Detection","Settings","Maintenance Management","User Management"]
rep={}
with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge",headless=True)
    pg=b.new_page(viewport={"width":1600,"height":900})
    errs=[]
    pg.on("console",lambda m: errs.append("console: "+m.text[:200]) if m.type=="error" else None)
    pg.on("response",lambda r: errs.append(f"HTTP {r.status} {r.url}") if r.status>=400 else None)
    pg.on("pageerror",lambda e: errs.append("pageerror: "+str(e)[:200]))
    pg.goto("http://127.0.0.1:5173/"); pg.wait_for_timeout(1000)
    pg.fill("input[placeholder='Enter username']","admin"); pg.fill("input[placeholder='Enter password']",os.environ["VS_ADMIN_PASSWORD"])
    pg.click("button[type=submit]"); pg.wait_for_timeout(3000)
    for i,n in enumerate(pages):
        errs.clear()
        pg.locator(".sidebar-nav-item",has_text=n).first.click(); pg.wait_for_timeout(3500)
        pg.screenshot(path=f"{OUT}/{i+1:02d}_{n.replace(' ','_')}.png")
        txt=pg.inner_text("main") if pg.query_selector("main") else pg.inner_text("body")
        print("=====",n,"| errors:",errs[:6]); print(txt[:700].replace("\n"," | "))
    b.close()

from playwright.sync_api import sync_playwright
import os
ROOT = r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output"
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": 4608, "height": 3456})
    pg.goto("file:///" + (ROOT + r"\poster\poster.html").replace("\\", "/")); pg.wait_for_timeout(2500)
    over = pg.evaluate("""()=>{const r=[];document.querySelectorAll('.col').forEach((c,i)=>{r.push([i,c.scrollHeight,c.clientHeight])});return r}""")
    print("columns [idx, scrollH, clientH]:", over)
    print("main:", pg.evaluate("(()=>{const m=document.querySelector('main');return [m.scrollHeight,m.clientHeight]})()"))
    pg.pdf(path=ROOT + r"\poster\G49_Poster.pdf", width="48in", height="36in", print_background=True, page_ranges="1")
    pg.screenshot(path=ROOT + r"\poster\preview.png"); b.close()

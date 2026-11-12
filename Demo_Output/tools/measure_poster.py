from playwright.sync_api import sync_playwright
ROOT = r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output"
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": 4608, "height": 3456})
    pg.goto("file:///" + (ROOT + r"\poster\poster.html").replace("\\", "/")); pg.wait_for_timeout(2500)
    print(pg.evaluate("""()=>({cols:[...document.querySelectorAll('.col')].map(c=>Math.round(c.getBoundingClientRect().height)),
      main:Math.round(document.querySelector('main').getBoundingClientRect().top), footerTop:Math.round(document.querySelector('footer').getBoundingClientRect().top), mainH:Math.round(document.querySelector('main').clientHeight)})"""))
    b.close()

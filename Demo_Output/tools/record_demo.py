import os
import time, json, os, glob, shutil
from playwright.sync_api import sync_playwright
ROOT=r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield"
CLIP=ROOT+r"\Demo_Output\video\VisionShield_foundry_demo_1min.mp4"
PPE=ROOT+r"\Test_Data\PPE.jpg"
VID=ROOT+r"\Demo_Output\tools\raw"
shutil.rmtree(VID,ignore_errors=True); os.makedirs(VID)
SHOT=ROOT+r"\Demo_Output\screenshots"
INIT="""
(()=>{
 const mk=()=>{
  if(document.getElementById('__cur'))return;
  const c=document.createElement('div');c.id='__cur';
  c.style.cssText='position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(255,200,0,.55);border:2px solid #b45309;pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);transition:left .02s,top .02s';
  const cap=document.createElement('div');cap.id='__cap';
  cap.style.cssText='position:fixed;z-index:2147483646;left:50%;bottom:26px;transform:translateX(-50%);max-width:1100px;padding:12px 26px;border-radius:12px;background:rgba(10,25,50,.92);color:#fff;font:600 20px Segoe UI,Arial;text-align:center;opacity:0;transition:opacity .4s;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.35)';
  document.documentElement.appendChild(c);document.documentElement.appendChild(cap);
  document.addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'},true);
 };
 if(document.documentElement)mk();document.addEventListener('DOMContentLoaded',mk);setInterval(mk,500);
})();
"""
marks={}
def main():
  with sync_playwright() as p:
    b=p.chromium.launch(channel="msedge",headless=True,args=["--autoplay-policy=no-user-gesture-required"])
    ctx=b.new_context(viewport={"width":1600,"height":900},record_video_dir=VID,record_video_size={"width":1600,"height":900})
    ctx.add_init_script(INIT)
    pg=ctx.new_page(); T0=time.time()
    errs=[]
    pg.on("console",lambda m: errs.append("console: "+m.text[:160]) if m.type=="error" else None)
    pg.on("response",lambda r: errs.append(f"HTTP {r.status} {r.url}") if r.status>=400 else None)
    t=lambda: round(time.time()-T0,1)
    def cap(txt):
      pg.evaluate("t=>{const c=document.getElementById('__cap'); if(!c)return; c.textContent=t; c.style.opacity=t?1:0}",txt)
    def hold(s): pg.wait_for_timeout(int(s*1000))
    def mv(loc,steps=35):
      bb=loc.bounding_box(); pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2,steps=steps)
    def click(loc,pause=0.4):
      loc.scroll_into_view_if_needed(); mv(loc); hold(pause); loc.click()
    def scroll(total,step=40,delay=25):
      n=int(abs(total)/step)
      for _ in range(n):
        pg.mouse.wheel(0,step if total>0 else -step); pg.wait_for_timeout(delay)
    def nav(name):
      click(pg.locator(".sidebar-nav-item",has_text=name).first)
    # 1 Intro
    pg.goto("http://127.0.0.1:5173/"); hold(2)
    marks['intro']=t()
    cap("VisionShield - AI-Based Foundry Monitoring System"); pg.mouse.move(800,450,steps=20); hold(6)
    cap("Real-time sensor monitoring, AI PPE safety detection and SOP process verification for foundry operations"); hold(9)
    cap("React dashboard  |  FastAPI backend  |  MongoDB  |  YOLOv8 models"); hold(7)
    cap("")
    # 2 Login + dashboard
    marks['login']=t()
    u=pg.locator("input[placeholder='Enter username']"); click(u); pg.keyboard.type("admin",delay=110); hold(0.4)
    w=pg.locator("input[placeholder='Enter password']"); click(w); pg.keyboard.type(os.environ["VS_ADMIN_PASSWORD"],delay=110); hold(0.5)
    cap("Secure role-based login (Administrator)"); click(pg.locator("button[type=submit]")); hold(4)
    marks['dashboard']=t()
    cap("Dashboard: system status, monitoring status, sensor readings and active alerts"); mv(pg.get_by_text("System Status").first); hold(5)
    mv(pg.get_by_text("Active Alerts").first); hold(4)
    cap("Latest temperature and weight readings with normal-range checks"); pg.mouse.move(700,420,steps=25); hold(5)
    scroll(500); hold(2); cap("Foundry CCTV stream embedded on the dashboard"); hold(5); scroll(-500); hold(1.5)
    pg.screenshot(path=SHOT+r"\rec_dashboard.png")
    # 3 Alerts
    marks['alerts']=t(); cap("")
    nav("Alerts"); hold(2); cap("Alert Management: active vs resolved alerts, filtered by type and status"); hold(5)
    scroll(450); hold(4); scroll(-450); hold(1)
    # AI safety
    marks['ai']=t(); nav("AI Safety Monitoring"); hold(2)
    cap("AI Safety Monitoring: YOLOv8 PPE detection (helmet, vest, boots, gloves...)"); hold(3)
    pg.locator("input[type=file]").first.set_input_files(PPE); hold(1.5)
    cap("Uploading a site photo for PPE compliance analysis")
    click(pg.get_by_role("button",name="Run AI Detection")); hold(1)
    try: pg.wait_for_selector("text=Image Detection Results",timeout=90000)
    except Exception as e: print("PPE wait fail",e)
    hold(1); cap("Actual model output: detected classes with confidence scores")
    scroll(300); hold(6); pg.screenshot(path=SHOT+r"\rec_ppe_result.png")
    # 4 Sensor + Live
    marks['sensor']=t(); cap(""); nav("Sensor Analytics"); hold(2)
    cap("Sensor Analytics: every temperature / weight reading stored in MongoDB with status"); hold(5)
    scroll(350); hold(4); scroll(-350)
    marks['live']=t(); nav("Live Monitoring"); hold(2)
    cap("Live Monitoring: service health, CCTV feed, process stage and sensor trends"); hold(6)
    scroll(600); hold(2); cap("Real-time temperature and weight trend charts (auto-refresh 5s)"); hold(7)
    scroll(600); hold(5); cap("Historical monitoring and daily production report"); scroll(500); hold(6)
    pg.screenshot(path=SHOT+r"\rec_live.png")
    # 5 Process Detection
    marks['proc']=t(); cap(""); nav("Process Detection"); hold(2)
    cap("Process Detection: runs 3 SOP models and enforces the step order")
    hold(4)
    cap("Selecting the 1-minute foundry clip (trimmed from the 6-minute Cam2 recording)")
    pg.locator(".file-upload-label").first.scroll_into_view_if_needed(); mv(pg.locator(".file-upload-label").first); hold(1)
    pg.locator(".upload-card input[type=file]").set_input_files(CLIP); hold(2.5)
    cap("Running AI process detection on the uploaded video")
    click(pg.get_by_role("button",name="Run Process Detection")); marks['proc_run']=t(); hold(6)
    cap("Background job: frames are analysed by the scrap-weighing, furnace-charging and magnesium models")
    marks['wait_start']=t()
    pg.wait_for_selector("text=SOP Process Sequence",timeout=900000)
    marks['wait_end']=t(); hold(1.5)
    cap("Results: SOP step sequence verified from real detections")
    pg.locator("text=SOP Process Sequence").first.scroll_into_view_if_needed(); hold(5)
    scroll(380); cap("SOP alerts (out-of-order steps flagged) and mandatory Magnesium step check"); hold(7)
    scroll(400); cap("Video statistics: 1237 frames processed, detection counts per model"); hold(6)
    scroll(500); cap("Annotated output video with detection boxes"); hold(3)
    try:
      v=pg.locator("video").last; v.scroll_into_view_if_needed(); hold(1); mv(v); v.evaluate("v=>{v.muted=true;v.play()}")
    except Exception as e: print("video",e)
    hold(8); pg.screenshot(path=SHOT+r"\rec_process_result.png")
    # 6 Other modules
    marks['settings']=t(); cap(""); nav("Settings"); hold(2)
    cap("Settings: system name, operational thresholds and data-monitoring controls"); mv(pg.get_by_text("Operational Thresholds").first); hold(5)
    scroll(300); hold(4); scroll(-300)
    marks['maint']=t(); nav("Maintenance Management"); hold(2)
    cap("Maintenance Management: equipment schedule, due-soon and overdue tracking"); hold(7)
    marks['users']=t(); nav("User Management"); hold(2)
    cap("User Management: Administrator, Supervisor and Operator accounts with status control"); hold(8)
    marks['end']=t(); nav("Dashboard"); hold(2)
    cap("VisionShield: sensor monitoring + AI safety + SOP process verification in one platform"); hold(7)
    cap("Thank you"); hold(4)
    marks['total']=t()
    print("ERRS",errs)
    ctx.close(); b.close()
  json.dump(marks,open(VID+r"\marks.json","w"))
  print(marks)
main()

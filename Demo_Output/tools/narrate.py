import asyncio, subprocess, re, json, os
import edge_tts
FF=r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\backend\.venv\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
D=r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output"
W=D+r"\tools\voice"; os.makedirs(W,exist_ok=True)
VOICE="en-US-AriaNeural"
# (start, end, text)
S=[
(3.0,25.0,"Welcome to VisionShield, an AI-based foundry monitoring system. It combines real-time sensor monitoring, AI safety detection and process verification, to help foundries keep workers safe and operations consistent. It is built with React, FastAPI, MongoDB and YOLO models."),
(26.0,37.0,"Let's log in as an administrator. Access is role based, with secure authentication."),
(37.5,65.0,"This is the dashboard. At the top we see the system status, monitoring status, the number of stored sensor readings, and active alerts. Below are the latest furnace temperature and metal weight, checked against their normal ranges, and the live foundry camera feed."),
(66.0,80.0,"The Alerts page lists active and resolved alerts, with filters, so supervisors can quickly find and resolve problems."),
(81.0,112.5,"In AI Safety Monitoring, a YOLO model checks protective equipment. I upload a site photo and run detection. The system returns the real result: helmets, vests and boots, each with a confidence score, and an annotated image."),
(113.5,126.0,"Sensor Analytics shows every temperature and weight reading stored in the database, with its status and time."),
(127.0,165.0,"Live Monitoring brings it together. We see service health, the camera stream, the current process stage, and live trend charts for temperature and weight. Further down are historical monitoring and the daily production report."),
(166.5,198.0,"Now the main feature, Process Detection. I select this one minute clip, cut from the furnace camera recording, and run detection. Three trained models analyse every frame in the background, while the system checks the correct order of the process steps. This takes a few minutes, so the wait is sped up here."),
(198.8,232.0,"The results are ready. All three steps were detected: scrap weighing, furnace charging, and the mandatory magnesium treatment. The system also raised alerts when steps appeared out of order. The statistics show all twelve hundred and thirty seven frames were processed, with the number of detections per model, and the annotated output video shows the detections on screen."),
(233.3,246.0,"In Settings, administrators configure temperature and weight thresholds, and data monitoring."),
(246.6,256.0,"Maintenance Management tracks equipment schedules, highlighting what is due soon or overdue."),
(256.8,267.0,"And User Management controls administrator, supervisor and operator accounts."),
(268.0,281.0,"That is VisionShield: sensor monitoring, AI safety detection and process verification, in one platform. Thank you for watching."),
]
def dur(p):
    r=subprocess.run([FF,"-hide_banner","-i",p],capture_output=True,text=True).stderr
    m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r); return int(m[1])*3600+int(m[2])*60+float(m[3])
async def main():
    plan=[]
    for i,(a,b,t) in enumerate(S):
        raw=f"{W}/n{i}.mp3"
        await edge_tts.Communicate(t,VOICE,rate="-3%").save(raw)
        d=dur(raw); slot=b-a; tempo=max(1.0,d/slot)
        out=raw
        if tempo>1.0:
            out=f"{W}/n{i}_f.mp3"
            subprocess.run([FF,"-y","-loglevel","error","-i",raw,"-filter:a",f"atempo={tempo:.3f}",out],check=True)
        plan.append((a,out,d,slot,round(tempo,3))); print(i,round(d,1),"slot",round(slot,1),"tempo",round(tempo,2))
    args=[FF,"-y","-loglevel","error","-i",D+r"\recording\VisionShield_Demo.mp4"]
    for _,o,_,_,_ in plan: args+=["-i",o]
    fc=";".join(f"[{i+1}:a]adelay={int(a*1000)}|{int(a*1000)}[v{i}]" for i,(a,*_ ) in enumerate(plan))
    fc+=";"+"".join(f"[v{i}]" for i in range(len(plan)))+f"amix=inputs={len(plan)}:normalize=0,volume=1.6,apad[a]"
    args+=["-filter_complex",fc,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","160k","-shortest",D+r"\recording\VisionShield_Demo_Narrated.mp4"]
    subprocess.run(args,check=True)
asyncio.run(main())

"""TC-18: run the real ingest_sensor_reading() against a fake in-memory DB (no writes to MongoDB, no alerts sent)."""
import sys, os, json
sys.path.insert(0, r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\backend")
os.chdir(r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\backend")
import main

class Col:
    def __init__(self): self.docs = []
    def insert_one(self, d):
        self.docs.append(d)
        class R: inserted_id = "fake"
        return R()
class FakeDB(dict):
    def __missing__(self, k):
        self[k] = Col(); return self[k]

LIMITS = {"min_temperature": 1500, "max_temperature": 1600, "min_weight": 500, "max_weight": 650,
          "refresh_interval": 5, "monitoring_enabled": True}
main.get_current_settings = lambda: dict(LIMITS)
main.dispatch_alerts_from_settings = lambda *a, **k: None
cases = [(1500, 500), (1600, 650), (1500, 650), (1600, 500),
         (1499.9, 575), (1600.1, 575), (1550, 499.9), (1550, 650.1)]
out = []
for t, w in cases:
    main.db = FakeDB()
    r = main.ingest_sensor_reading(t, w)
    alerts = main.db["alerts"].docs
    out.append({"temp": t, "weight": w, "alert_created": bool(alerts),
                "problems": alerts[0]["problems"] if alerts else []})
for o in out: print(o)
json.dump(out, open(r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield\Demo_Output\reports\boundary_test.json", "w"), indent=2)

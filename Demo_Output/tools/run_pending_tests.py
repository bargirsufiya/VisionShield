"""Executes the pending VisionShield test cases that can be run safely against the local app.
Reads the admin password from env VS_ADMIN_PASSWORD. Writes results to Demo_Output/reports/pending_test_results.json
"""
import os, sys, json, io, urllib.request, urllib.error, uuid, importlib
BASE = "http://127.0.0.1:8000"
ROOT = r"C:\Users\bargi\Downloads\VisionShield (2)\VisionShield"
res = {}

def call(method, path, body=None, headers=None, raw=None):
    h = headers or {}
    data = raw
    if body is not None:
        data = json.dumps(body).encode(); h = {**h, "Content-Type": "application/json"}
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ---- TC-02 unsupported file
boundary = uuid.uuid4().hex
payload = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"notes.txt\"\r\n"
           f"Content-Type: text/plain\r\n\r\nthis is not a video\r\n--{boundary}--\r\n").encode()
st, body = call("POST", "/api/process/video-detect", raw=payload,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
res["TC-02"] = {"status": st, "body": body[:200]}

# ---- TC-23 admin-only API with a non-admin (invalid) token
st, body = call("DELETE", "/api/maintenance/000000000000000000000000", {"admin_token": "not-a-valid-token"})
st2, body2 = (None, None)
res["TC-23"] = {"status": st, "body": body[:200]}

# ---- TC-20 e-mail alert (login -> token -> test-notification to the address the user supplied)
st, body = call("POST", "/api/auth/login", {"username": "admin", "password": os.environ["VS_ADMIN_PASSWORD"]})
tok = json.loads(body).get("session_token") if st == 200 else None
res["login"] = st
if tok:
    st, body = call("POST", "/api/test-notification",
                    {"session_token": tok, "target_type": "email", "destination": "bargirsufiya17@gmail.com"})
    res["TC-20"] = {"status": st, "body": body[:300]}

json.dump(res, open(ROOT + r"\Demo_Output\reports\pending_test_results.json", "w"), indent=2)
print(json.dumps(res, indent=2))

import csv
rows = list(csv.DictReader(open("diag.csv")))
keys = [k for k in rows[0] if k != "second"]
for k in keys:
    hi = [int(r["second"]) for r in rows if float(r[k]) >= 0.5]
    mx = max(float(r[k]) for r in rows)
    print(f"{k:24} max={mx:.2f}  secs>=0.5: {len(hi)}  first={hi[0] if hi else '-'}  last={hi[-1] if hi else '-'}")
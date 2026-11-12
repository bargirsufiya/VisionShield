import csv

rows = list(csv.DictReader(open("diag.csv")))
keys = [k for k in rows[0] if k != "second"]

print("sec   " + "  ".join(f"{k[:8]:>8}" for k in keys))
for i in range(0, len(rows), 10):
    chunk = rows[i:i + 10]
    vals = [sum(float(r[k]) for r in chunk) / len(chunk) for k in keys]
    print(f"{chunk[0]['second']:>4}  " + "  ".join(f"{v:8.2f}" for v in vals))
# -*- coding: utf-8 -*-
"""独立对账（v2）：只用 12 张权威表重算，与 dashboard.json 比对。"""
import json, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import build_dashboard as B

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(ROOT, "data", "dashboard.json"), encoding="utf-8"))
E, W = [], []

for t in D["teams"]:
    code, sc, f = t["code"], t["score"], t["finance"]
    daily = [x for x in sc["daily"] if x["d"] and not x["off"] and x["d"] <= (t["as_of_day"] or 31)]
    s = sum(x["dia"] for x in daily)
    if s != sc["mtd_dia"]:
        E.append(f"{code}: 逐日合计 {s:,} != 汇总 {sc['mtd_dia']:,}")
    if sc.get("total_cell") and abs(sc["total_cell"] - s) > 1:
        W.append(f"{code}: 记分表第3行合计 {sc['total_cell']:,} vs 逐日 {s:,}（差 {sc['total_cell']-s:,}）")
    if abs(f["net_thb"] - f["gross_thb"] * 0.65) > 1:
        E.append(f"{code}: 实收 != 流水×65%")
    if abs(f["profit"] - (f["net_thb"] - f["salary"] - f["ops_total"])) > 1:
        E.append(f"{code}: 净利 != 实收−底薪−运营")
    if abs(f["ops_total"] - (f["ops_fixed"] + f["ops_comm"])) > 1:
        E.append(f"{code}: 运营 != 固定+提成")
    ks = sum(m["kpi"] or 0 for m in t["members"] if m["active"])
    if ks != sc["kpi_sum"]:
        E.append(f"{code}: KPI 合计 {ks:,} != {sc['kpi_sum']:,}")
    for m in t["members"]:
        if m["salary"] and m["salary_mtd"] > m["salary"] + 1:
            E.append(f"{code}/{m['nick']}: 底薪 MTD > 月薪")
        if m["salary"] and m["salary"] and m["kpi"] and m["kpi"] / m["salary"] > 25:
            W.append(f"{code}/{m['nick']}: KPI/底薪 = {m['kpi']/m['salary']:.1f}x 异常")

T = D["totals"]
if abs(T["net_thb"] - sum(t["finance"]["net_thb"] for t in D["teams"])) > 2:
    E.append("公会实收 != Σ团队")
if abs(T["profit"] - sum(t["finance"]["profit"] for t in D["teams"])) > 2:
    E.append("公会净利 != Σ团队")
if T["score_dia"] != sum(t["score"]["mtd_dia"] for t in D["teams"]):
    E.append("公会计分表 != Σ团队")

print("=" * 70)
print(f"ERRORS: {len(E)}")
for x in E[:15]: print("  x", x)
print(f"WARN: {len(W)}")
for x in W[:10]: print("  !", x)
print(f"  · 11 队 / {T['members']} 人（在职 {T['active_members']}）")
print(f"  · 记分表 {T['score_dia']:,} 钻 · 实收 {T['net_thb']:,.0f} · 净利 {T['profit']:,.0f}")

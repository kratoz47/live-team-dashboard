#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
直播团队看板 · 数据构建（v2 · 仅用 12 张权威表）

数据源（唯一权威）:
  1) <TEAM> ScoreListGroup.xlsx × 11   团队逐日记分表：钻石 / 日KPI / 观看 / PCU / ACU / 涨粉 / 礼物人数 / Day off
  2) VJ Onboarding Record.xlsx      花名册：KPI / 底薪 / 合同 / 入职 / 状态 / TikTok / 主管

辅助（不参与权威口径，可关闭）:
  3) Employee Database (VJ)__ (12).xlsx 运营成本分表 —— 仅用于算团队净利

已彻底移除：运营 gsheet（成员逐日流水）、TikTok 后台导出。
因此成员层面没有「实际流水」，佣金/人效/净贡献无法计算 —— 看板按「KPI 目标 + 薪酬台账 + 出勤」呈现。
"""
import json, math, os, re, sys, datetime as dt

import entries_store as ES
from collections import OrderedDict, defaultdict

import openpyxl

from config import cfg

DL = cfg.DOWNLOADS_DIR
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "src")  # sync_google.py 自动下载的副本


def src_path(name):
    """优先用 Google 同步下来的副本，没有就用本地手放的文件。"""
    p2 = os.path.join(SRC, name)
    if os.path.exists(p2) or not DL:
        return p2
    return os.path.join(DL, name)


ROSTER_XLSX = src_path(cfg.ROSTER_FILE)
OPSCOST_XLSX = os.path.join(DL, cfg.OPSCOST_FILE) if (DL and cfg.OPSCOST_FILE) else ""
USE_OPS_COST = bool(cfg.USE_OPS_COST and OPSCOST_XLSX)

FX = cfg.FX
PLATFORM_CUT = cfg.PLATFORM_CUT
DIA_PER_USD = cfg.DIA_PER_USD
MC_RATE = cfg.MC_RATE
OPS_RATE = cfg.OPS_RATE

PERIOD_START = dt.date(2026, 11, 1)
PERIOD_END = dt.date(2026, 11, 30)
DAYS_TOTAL = 30

# 团队表与花名映射属于部署数据：见 config.local.py（仓库只带 config.example.py）。
TEAMS = cfg.TEAMS
ALIASES = cfg.ALIASES

def rkey(s):
    s = str(s or "").replace("\n", " ").strip()
    s = re.sub(r"\(.*?\)", "", s).split("/")[0]
    return re.sub(r"[\u0e4c\u0e3a]", "", s).strip()

def nk(s):
    return re.sub(r"[\s\.\-_/\(\)]", "", str(s or "")).lower()

def num(v, default=0.0):
    if v is None: return default
    if isinstance(v, (int, float)): return float(v)
    m = re.search(r"-?\d+(\.\d+)?", str(v).replace(",", ""))
    return float(m.group()) if m else default

def pct(a, b):
    return round(a / b * 100, 1) if b else None

# ---------------------------------------------------------------- 记分表
def parse_goal(txt):
    if not txt: return None, None, None
    t = str(txt)
    m = re.search(r"\(Mc\s*([^\)]+)\)", t, re.I)
    mc = m.group(1).strip() if m else None
    disp = re.split(r"\(Mc", t, flags=re.I)[0].strip()
    g = re.search(r"Goal\s*:?\s*(.*)$", t, re.I)
    goal = None
    if g:
        mm = re.search(r"([\d][\d,\.]*)\s*(M|m|l้าน)?", g.group(1).strip())
        if mm:
            val = float(mm.group(1).replace(",", ""))
            if (mm.group(2) or "").lower() == "m" and val < 1000: val *= 1_000_000
            if val >= 100000: goal = int(val)
    return disp, mc, goal

def parse_score_dates(sh):
    std_v = swap_v = 0
    for r in range(6, sh.max_row + 1):
        raw = sh.cell(r, 1).value
        if isinstance(raw, dt.datetime):
            if raw.month == 11 and raw.day != 11: std_v += 1
            elif raw.day == 11 and raw.month != 11: swap_v += 1
    swapped = swap_v > std_v
    rows = []
    for r in range(6, sh.max_row + 1):
        raw, b = sh.cell(r, 1).value, sh.cell(r, 2).value
        off = isinstance(b, str) and re.search(r"off", b, re.I) is not None
        if raw is None and not off: continue
        day = None
        if isinstance(raw, dt.datetime):
            if swapped:
                if raw.day == 11 and 1 <= raw.month <= 12: day = raw.month
            else:
                if raw.month == 11: day = raw.day
        elif isinstance(raw, str):
            s = raw.strip()
            if re.search(r"DAY\s*OFF|^off", s, re.I): off = True
            else:
                m = re.match(r"(\d{1,2})[/\-](\d{1,2})", s)
                if m: day = int(m.group(1))
        rows.append((r, day if day and 1 <= day <= 31 else None, off))
    return rows, swapped

def load_scorelists():
    out = {}
    for code, meta in TEAMS.items():
        path = src_path(meta["file"])
        if not os.path.exists(path):
            out[code] = {"ok": False}; continue
        wb = openpyxl.load_workbook(path, data_only=True)
        sh = wb.worksheets[0]
        hdr = str(sh.cell(2, 3).value or "")
        disp, mc, goal = parse_goal(hdr)
        total_cell = num(sh.cell(3, 1).value)
        rows, swapped = parse_score_dates(sh)
        daily, seen = [], set()
        for r, day, off in rows:
            if day is None and not off: continue
            if day in seen: continue
            if day: seen.add(day)
            kv = sh.cell(r, 3).value
            kpi = None
            if isinstance(kv, str) and kv.strip().lower() in ("yes", "no", "ใช่", "ไม่"):
                kpi = kv.strip().lower().startswith(("y", "ใ"))
            dia_raw = sh.cell(r, 2).value
            dia = 0 if off else int(num(dia_raw))
            daily.append(dict(
                d=day,
                date=(PERIOD_START + dt.timedelta(days=(day - 1))).isoformat() if day else None,
                dia=dia, dia_raw=(dia_raw if isinstance(dia_raw, (int, float)) else None),
                missing=(not off and dia == 0 and dia_raw is None),
                kpi=kpi,
                view=int(num(sh.cell(r, 4).value)), pcu=int(num(sh.cell(r, 5).value)),
                acu=int(num(sh.cell(r, 6).value)), fans=int(num(sh.cell(r, 7).value)),
                gifters=int(num(sh.cell(r, 8).value)), off=off,
                off_note=str(sh.cell(r, 9).value or "").strip(),
            ))
        daily.sort(key=lambda x: (x["d"] or 99))
        as_of = max([x["d"] for x in daily if x["dia"] > 0], default=None)
        if as_of is None: as_of = max([x["d"] for x in daily if x["d"]], default=None)
        st = [x for x in daily if not x["off"] and x["d"] and (as_of is None or x["d"] <= as_of or x.get("manual"))]
        streamed = [x for x in st if x["dia"] > 0]
        kpi_rows = [x for x in st if x["kpi"] is not None]
        out[code] = dict(
            ok=True, sheet=sh.title, header=hdr, disp=disp, mc=mc, goal=goal, last_day_xlsx=as_of,
            total_cell=int(total_cell), swapped_dates=swapped, daily=daily,
            sum_daily=sum(x["dia"] for x in st), days=len(st), stream_days=len(streamed),
            last_day=as_of,
            kpi_hit=sum(1 for x in kpi_rows if x["kpi"] is True), kpi_marked=len(kpi_rows),
            view=sum(x["view"] for x in st) or None, fans=sum(x["fans"] for x in st) or None,
            metrics_missing=not any(x["view"] for x in st),
            pcu_avg=(round(sum(x["pcu"] for x in streamed) / len(streamed)) if streamed else 0) or None,
            acu_avg=(round(sum(x["acu"] for x in streamed) / len(streamed)) if streamed else 0) or None,
            gifters_avg=(round(sum(x["gifters"] for x in streamed) / len(streamed)) if streamed else 0) or None,
            best=max(streamed, key=lambda x: x["dia"]) if streamed else None,
            off_days=[x["date"] for x in daily if x["off"] and x["date"] and (as_of is None or x["d"] <= as_of)],
            missing_days=[x["d"] for x in st if x["missing"]],
        entry_beyond=sorted({x["d"] for x in st if x.get("manual") and as_of and x["d"] > as_of}),
        )
    return out

# 成本表英文名 -> 花名册昵称（仅用于底薪去重），见 config。
COST_ALIAS = cfg.COST_ALIAS

# ---------------------------------------------------------------- 花名册
def load_roster():
    wb = openpyxl.load_workbook(ROSTER_XLSX, data_only=True)
    sh = wb["VJ Roster"]
    by_team, all_m = defaultdict(list), []
    for r in range(7, sh.max_row + 1):
        v = [sh.cell(r, c).value for c in range(1, 23)]
        if not any(v): continue
        nick = str(v[3] or "").strip()
        name = str(v[2] or "").strip()
        if not (nick or name): continue
        team = re.sub(r"[\u0e4c\u0e3a]", "", str(v[9] or "")).strip()
        m = dict(
            row=r, thai=name, nick=nick, rk=rkey(nick),
            tiktok=re.sub(r"^.*tiktok\.com/@?", "", str(v[8] or "").strip(), flags=re.I).strip("@ "),
            team_raw=team, op=str(v[10] or "").strip(), contract=str(v[11] or "").strip(),
            start=v[12], end=v[13], status=str(v[14] or "").strip(),
            kpi=v[16], salary=v[18], bonus=v[19], note=str(v[20] or "").strip(),
        )
        m["active"] = ("Active" in m["status"]) or ("In Training" in m["status"]) or ("อยู่ระหว่าง" in m["status"])
        by_team[team].append(m); all_m.append(m)
    return by_team, all_m

def fmt_date(v):
    if not isinstance(v, (dt.datetime, dt.date)):
        return None
    if v.year < 2000:   # Excel 里只填了月日
        y = 2025 if v.month > PERIOD_END.month else PERIOD_END.year
        try: return dt.date(y, v.month, v.day).isoformat()
        except ValueError: return dt.date(y, v.month, 28).isoformat()
    return v.isoformat()[:10]

def norm_start(raw):
    if not isinstance(raw, (dt.datetime, dt.date)): return None
    y, mo, d = PERIOD_END.year, raw.month, raw.day
    try: cand = dt.date(y, mo, d)
    except ValueError: cand = dt.date(y, mo, min(d, 28))
    if cand > PERIOD_END:
        try: cand = dt.date(y - 1, mo, d)
        except ValueError: cand = dt.date(y - 1, mo, min(d, 28))
    return cand

# ---------------------------------------------------------------- 运营成本（辅助）
def load_opscost():
    if not USE_OPS_COST or not os.path.exists(OPSCOST_XLSX): return {}
    wb = openpyxl.load_workbook(OPSCOST_XLSX, data_only=True)
    out = {}
    for code, meta in TEAMS.items():
        sn = meta["cost"]
        if not sn or sn not in wb.sheetnames:
            out[code] = None; continue
        sh = wb[sn]
        heads = [str(sh.cell(2, c).value or "").strip().lower() for c in range(1, sh.max_column + 1)]
        base_col = next((i + 1 for i, h in enumerate(heads) if h in ("ฐานเงินเดือน", "เงินเดือน", "base", "底薪", "salary")), 4)
        tot_col = next((i + 1 for i, h in enumerate(heads) if h in ("รวม", "total")), 5)
        staff, total, grand_row = [], 0, None
        for r in range(3, sh.max_row + 1):
            nm = sh.cell(r, 1).value
            if not nm or not str(nm).strip():
                v = sh.cell(r, tot_col).value
                if isinstance(v, (int, float)) and v > 0 and grand_row is None: grand_row = r
                continue
            pos = str(sh.cell(r, 2).value or "").strip()
            base = sh.cell(r, base_col).value
            tot = sh.cell(r, tot_col).value
            amt = int(base) if isinstance(base, (int, float)) and base > 0 else (int(tot) if isinstance(tot, (int, float)) else 0)
            staff.append(dict(name=str(nm).strip(), role=pos, amount=amt,
                              total=int(tot) if isinstance(tot, (int, float)) else 0,
                              is_ops=bool(re.search(r"operation|mc|ronin|lighting", pos, re.I))))
        if grand_row: total = int(num(sh.cell(grand_row, tot_col).value))
        out[code] = dict(sheet=sn, staff=staff, total=total)
    return out

def recompute(sc, as_of=None):
    daily = sc.get("daily") or []
    if as_of is None:
        as_of = max([x["d"] for x in daily if (x["dia"] or 0) > 0] or [0]) or None
        if as_of is None:
            as_of = max([x["d"] for x in daily if x["d"]] or [0]) or None
    st = [x for x in daily if not x["off"] and x["d"] and (as_of is None or x["d"] <= as_of or x.get("manual"))]
    streamed = [x for x in st if x["dia"] > 0]
    kpi_rows = [x for x in st if x["kpi"] is not None]
    sc.update(
        sum_daily=sum(x["dia"] for x in st), days=len(st), stream_days=len(streamed), last_day=as_of,
        kpi_hit=sum(1 for x in kpi_rows if x["kpi"] is True), kpi_marked=len(kpi_rows),
        view=sum(x["view"] for x in st) or None, fans=sum(x["fans"] for x in st) or None,
        metrics_missing=not any(x["view"] for x in st),
        pcu_avg=(round(sum(x["pcu"] for x in streamed) / len(streamed)) if streamed else 0) or None,
        acu_avg=(round(sum(x["acu"] for x in streamed) / len(streamed)) if streamed else 0) or None,
        gifters_avg=(round(sum(x["gifters"] for x in streamed) / len(streamed)) if streamed else 0) or None,
        best=max(streamed, key=lambda x: x["dia"]) if streamed else None,
        missing_days=[x["d"] for x in st if x["missing"]],
        entry_beyond=sorted({x["d"] for x in st if x.get("manual") and as_of and x["d"] > as_of}),
        off_days=[x["date"] for x in daily if x["off"] and x["date"] and (as_of is None or x["d"] <= as_of)],
    )
    return sc


def apply_entries(scores, ents):
    for (code, day), e in ents.items():
        sc = scores.get(code)
        if not sc or not sc.get("ok"):
            continue
        row = next((x for x in sc["daily"] if x["d"] == day), None)
        if not row:
            row = dict(d=day, date=(PERIOD_START + dt.timedelta(days=day - 1)).isoformat(), dia=0,
                       dia_raw=None, missing=False, kpi=None, view=0, pcu=0, acu=0, fans=0,
                       gifters=0, off=False, off_note="")
            sc["daily"].append(row)
            sc["daily"].sort(key=lambda x: x["d"] or 99)
        for k in ("dia", "view", "pcu", "acu", "fans", "gifters"):
            if e.get(k) is not None:
                row[k] = e[k]
        if e.get("off"):
            row["off"] = True
            row["dia"] = 0
        if e.get("kpi") is not None:
            row["kpi"] = e["kpi"]
        row["missing"] = False
        row["manual"] = True
        if e.get("note"):
            row["note"] = e["note"]
    return scores


def en_index():
    """泰文昵称 -> 英文昵称（用作界面主显示名）"""
    out = {}
    for m in ALIASES.values():
        for eng, th in m.items():
            out.setdefault(rkey(th), eng)
    for eng, th in COST_ALIAS.items():
        out.setdefault(rkey(th), eng)
    return out


def tier_for(total_dia):
    if total_dia >= 5_000_000: return 0.30
    if total_dia >= 3_000_000: return 0.25
    if total_dia >= 2_000_000: return 0.20
    return 0.15


# ---------------------------------------------------------------- 主构建
def build():
    scores = load_scorelists()
    AS_OF_XLSX = max([(v.get("last_day") or 0) for v in scores.values()] or [0]) or None
    ents = ES.index()
    if ents:
        apply_entries(scores, ents)
    for _code, _v in scores.items():
        if _v.get("ok"):
            _ends = [_v.get("last_day_xlsx") or 0] + [d for (c, d) in ents if c == _code]
            recompute(_v, max(_ends) or AS_OF_XLSX)
    GLOBAL_AS_OF = AS_OF_XLSX
    roster_team, _ = load_roster()
    EN = en_index()
    opscost = load_opscost()
    mtd_ratio = (GLOBAL_AS_OF or 20) / DAYS_TOTAL

    teams_out = []
    for code, meta in TEAMS.items():
        sc = scores.get(code, {"ok": False})
        mlist = [m for m in roster_team.get(meta["roster"], []) if (m["nick"] or m["thai"])]
        disp, mc, goal = sc.get("disp"), sc.get("mc"), sc.get("goal")
        own_last_day = sc.get("last_day_xlsx") or sc.get("last_day") or GLOBAL_AS_OF
        alias = ALIASES.get(code, {})
        rk_map = {m["rk"]: m for m in mlist if m["rk"]}

        # ---- Day off 名单 -> 每人休息天数
        alias_l = {str(k).lower(): v for k, v in alias.items()}

        def _one(name):
            nm2 = str(name or "").strip()
            if not nm2:
                return None
            key = alias_l.get(nm2.lower()) or nm2
            mm = rk_map.get(rkey(key))
            if mm:
                return mm
            low = nk(nm2)
            cand = [x for x in mlist if nk(x["nick"]) == low or nk(x["rk"]) == low
                    or (EN.get(x["rk"]) and nk(EN[x["rk"]]) == low)]
            if cand:
                return cand[0]
            pool = {}
            for x in mlist:
                pool[nk(x["rk"])] = x
                if EN.get(x["rk"]):
                    pool[nk(EN[x["rk"]])] = x
            import difflib
            close = difflib.get_close_matches(low, list(pool.keys()), n=1, cutoff=0.72)
            return pool[close[0]] if close else None

        def _match_off(nm):
            m0 = _one(nm)
            if m0:
                return m0
            parts = [p for p in re.split(r"\s+", str(nm or "").strip()) if len(p) >= 3]
            if len(parts) > 1:
                hit = [x for x in (_one(p) for p in parts) if x]
                if hit:
                    _match_off.multi = getattr(_match_off, "multi", []) + [x for x in hit[1:]]
                    return hit[0]
            return None
        off_by_rk, unmatched = defaultdict(list), defaultdict(int)
        off_type_by_rk = defaultdict(dict)

        def _otype(txt):
            t = (txt or "").lower()
            if re.search(r"ป่วย|sick|ลาป่วย", t): return "sick"
            if re.search(r"กิจ|personal|ธุระ", t): return "personal"
            if re.search(r"ขาด|absent|ไม่มา|no.?show", t): return "absent"
            if re.search(r"เทรน|train", t): return "training"
            if re.search(r"ลา|leave", t): return "leave"
            return "off"

        for x in sc.get("daily") or []:
            if not x["off_note"] or not x["d"]: continue
            for raw in re.split(r"[/,、]|\s+-\s+|-", x["off_note"]):
                otype = "off"
                nm = raw.strip()
                mo = re.match(r"^(.+?)\s*[(（]\s*([^)）]+)\s*[)）]$", nm)
                if mo:
                    nm, otype = mo.group(1).strip(), _otype(mo.group(2))
                nm = nm.strip().strip("-")
                if not nm or len(nm) < 2: continue
                if re.search(r"PK|COMPANY|OFF|ทีม", nm, re.I): continue
                mm = _match_off(nm)
                if mm:
                    off_by_rk[mm["rk"]].append(x["d"])
                    off_type_by_rk[mm["rk"]][x["d"]] = otype
                else:
                    unmatched[nm] += 1

        # ---- 录入的成员流水
        ent_mem = defaultdict(int)
        ent_mem_days = defaultdict(int)
        ent_mismatch = sum(int((e.get("mismatch") or 0)) for (c, d), e in ents.items() if c == code)
        ent_days = sorted({d for (c, d) in ents if c == code})
        for (c, d), e in ents.items():
            if c != code:
                continue
            for nm, v in (e.get("members") or {}).items():
                ent_mem[nm] += v
                ent_mem_days[nm] += 1
        _tier = tier_for(sc.get("sum_daily") or 0)
        _team_as_of = max([sc.get("last_day_xlsx") or 0] + list(ent_days)) or (GLOBAL_AS_OF or 20)
        _team_ratio = _team_as_of / DAYS_TOTAL
        sc["entry_beyond"] = sorted(d for d in ent_days if d > (sc.get("last_day_xlsx") or 0))
        _st_rows = [x for x in (sc.get("daily") or []) if x["d"] and not x["off"]
                    and (x["d"] <= _team_as_of or x.get("manual"))]
        _data_days = len([x for x in _st_rows if not x.get("missing")])
        _blank_days = len([x for x in _st_rows if x.get("missing")])

        # ---- 成员
        members = []
        for m in mlist:
            st = norm_start(m["start"]) if isinstance(m["start"], (dt.datetime, dt.date)) else None
            start_day = st.day if (st and PERIOD_START <= st <= PERIOD_END) else 1
            _is_out = bool(m["status"]) and any(k in m["status"] for k in ("ออก", "Resigned", "ลาออก"))
            end_day = DAYS_TOTAL
            if _is_out and isinstance(m["end"], (dt.datetime, dt.date)) and m["end"].month == PERIOD_END.month:
                end_day = m["end"].day
            win_end = min(_team_as_of or DAYS_TOTAL, end_day)
            sal_end = min(GLOBAL_AS_OF or DAYS_TOTAL, end_day)
            active_days = max(0, sal_end - (start_day - 1))
            sal = int(num(m["salary"])) if isinstance(m["salary"], (int, float)) else 0
            kpi = int(num(m["kpi"])) if isinstance(m["kpi"], (int, float)) else None
            offs = sorted(set(off_by_rk.get(m["rk"], [])))
            _otypes = off_type_by_rk.get(m["rk"], {})
            _by_type = defaultdict(list)
            for _d in offs:
                _by_type[_otypes.get(_d, "off")].append(_d)
            _edays = int(ent_mem_days.get(m["nick"], 0))
            _need = max(0, _data_days - len(offs))
            _kpi_days = max(0, win_end - (start_day - 1))
            _kpi_mtd = round(kpi * _kpi_days / DAYS_TOTAL) if kpi else None
            _dia = int(ent_mem.get(m["nick"]) or ent_mem.get(rkey(m["nick"])) or 0)
            _comm = None
            if _dia:
                _comm = round((_dia - _kpi_mtd) * _tier * FX / 100) if (_kpi_mtd and _dia > _kpi_mtd) else 0
            _proj = None
            if _dia and kpi and _team_as_of:
                _month = _dia / _team_as_of * DAYS_TOTAL
                _proj = round(max(0, _month - kpi) * _tier * FX / 100)
            _net = (round(_dia / DIA_PER_USD * FX * (1 - PLATFORM_CUT) - round(sal * active_days / DAYS_TOTAL) - (_comm or 0))
                    if _dia else None)
            _roi = (round((_dia / DIA_PER_USD * FX * (1 - PLATFORM_CUT)) / (sal * active_days / DAYS_TOTAL), 2)
                    if (_dia and sal and active_days) else None)
            members.append(dict(
                entry_days=_edays, need_days=_need,
                data_ratio=(round(_edays / _need * 100, 1) if (_need and ent_mem) else None),
                dia=_dia or None, commission=_comm, commission_projection=_proj, net=_net, roi=_roi,
                kpi_progress=(round(_dia / _kpi_mtd * 100, 1) if (_dia and _kpi_mtd) else None),
                kpi_gap=(_dia - _kpi_mtd) if (_dia and _kpi_mtd) else None,
                nick=m["nick"], en=EN.get(m["rk"]) or None, thai=m["thai"], rk=m["rk"], row=m["row"],
                status=m["status"], active=m["active"], contract=m["contract"],
                start=fmt_date(m["start"]), end=fmt_date(m["end"]),
                kpi=kpi, salary=sal, salary_mtd=round(sal * active_days / DAYS_TOTAL),
                salary_raw=str(m["salary"]), active_days=active_days,
                op=m["op"], tiktok=m["tiktok"], bonus=int(num(m["bonus"])),
                off_days=offs, off_count=len(offs),
                off_by_type={k: v for k, v in _by_type.items()},
                sick_days=len(_by_type.get("sick", [])),
                personal_days=len(_by_type.get("personal", [])),
                absent_days=len(_by_type.get("absent", [])),
                training_days=len(_by_type.get("training", [])),
                present_days=max(0, (sc.get("days") or 0) - len(offs)),
                kpi_mtd=_kpi_mtd, kpi_days=_kpi_days, 
            ))
        members.sort(key=lambda x: (-(x["kpi"] or 0), -(x["salary"] or 0)))

        ent_gap = []
        for (c, d), e in sorted(ents.items()):
            if c != code:
                continue
            _td = int(e.get("dia") or 0)
            _ms = sum(int(v) for v in (e.get("members") or {}).values())
            if _td != _ms:
                _listed = set((e.get("members") or {}).keys())
                ent_gap.append(dict(d=d, team_dia=_td, member_sum=_ms, gap=_td - _ms,
                                    listed=len(_listed),
                                    missing=[x["nick"] for x in members
                                             if x.get("active") and x["nick"] not in _listed
                                             and d not in (x.get("off_days") or [])]))

        kpi_sum = sum(m["kpi"] or 0 for m in members if m["active"])
        goal_suggest = int(round(kpi_sum, -4)) if (not goal and kpi_sum) else None
        coverage = round(kpi_sum / goal * 100, 1) if (goal and kpi_sum) else None
        need_mult = round(goal / kpi_sum, 2) if (goal and kpi_sum) else None
        need_head = None
        if goal and kpi_sum:
            act = max(1, sum(1 for m in members if m["active"]))
            need_head = max(0, int(math.ceil(goal / max(kpi_sum / act, 1))) - act)

        gross_dia = sc.get("sum_daily") or 0
        gross_thb = gross_dia / DIA_PER_USD * FX
        net_thb = gross_thb * (1 - PLATFORM_CUT)
        salary_total = sum(m["salary_mtd"] for m in members)

        oc = opscost.get(code)
        ops_fixed = ops_comm = 0; ops_detail = []
        if oc:
            monthly = 0
            for s in oc["staff"]:
                if s["is_ops"]:
                    monthly += s["total"]
                else:
                    _en = COST_ALIAS.get(s["name"]) or alias.get(s["name"]) or s["name"]
                    match = next((m for m in members if nk(m["rk"]) == nk(rkey(_en))), None)
                    if not match:
                        import difflib
                        close = difflib.get_close_matches(rkey(_en),
                                                          [m["rk"] for m in members], n=1, cutoff=0.8)
                        match = next((m for m in members if m["rk"] == close[0]), None) if close else None
                    if match:
                        ded = min(s["amount"], match["salary"])
                        monthly += max(0, s["total"] - ded)
                        ops_detail.append(dict(name=s["name"], nick=match["nick"], en=match.get("en"), role=s["role"], salary=s["total"],
                                               kind="deduct", deducted=ded, kept=max(0, s["total"] - ded)))
                    else:
                        monthly += s["total"]
                        ops_detail.append(dict(name=s["name"], role=s["role"], salary=s["total"], kind="unmatched_keep"))
            ops_fixed = round(monthly * mtd_ratio)
            for s in oc["staff"]:
                if not s["is_ops"]: continue
                r = 0.0; p = s["role"].lower()
                if "mc" in p: r += MC_RATE
                if "operation" in p: r += OPS_RATE
                if r:
                    c = round(gross_thb * r)
                    ops_comm += c
                    ops_detail.append(dict(name=s["name"], role=s["role"], kind="commission", rate=r,
                                           base=round(gross_thb), amount=c))
        ops_total = ops_fixed + ops_comm
        commission_total = sum((m.get("commission") or 0) for m in members) if ent_mem else 0
        commission_projection = sum((m.get("commission_projection") or 0) for m in members) if ent_mem else None
        has_comm = bool(ent_mem)
        total_cost = salary_total + ops_total + commission_total
        profit = net_thb - total_cost

        teams_out.append(dict(
            code=code, name=meta["name"], display=disp or meta["name"], mc=(mc or "—"),
            score=dict(goal=goal, goal_suggest=goal_suggest, kpi_sum=kpi_sum, coverage=coverage,
                       need_mult=need_mult, need_head=need_head,
                       sum_daily=gross_dia, mtd_dia=gross_dia, total_cell=sc.get("total_cell"),
                       days=sc.get("days"), stream_days=sc.get("stream_days"),
                       kpi_hit=sc.get("kpi_hit"), kpi_marked=sc.get("kpi_marked"),
                       view=sc.get("view"), fans=sc.get("fans"),
                       view_conv=(round((sc.get("sum_daily") or 0) / sc["view"], 2) if sc.get("view") else None),
                       gifters_total=(sum(x["gifters"] for x in sc["daily"]
                                          if not x["off"] and x["d"] and x["d"] <= (sc.get("last_day") or 31)) or None),
                       rate_gift=(round(sum(x["gifters"] for x in sc["daily"]
                                            if not x["off"] and x["d"] and x["d"] <= (sc.get("last_day") or 31))
                                        / sc["view"] * 100, 2) if sc.get("view") else None),
                       pcu_avg=sc.get("pcu_avg"), acu_avg=sc.get("acu_avg"), gifters_avg=sc.get("gifters_avg"),
                       metrics_missing=bool(sc.get("metrics_missing")),
                       entry_beyond=sc.get("entry_beyond") or [], entry_mismatch=ent_mismatch,
                       entry_gap=ent_gap,
                       data_days=_data_days, blank_days=_blank_days,
                       coverage_ratio=round(_data_days / _team_as_of * 100, 1) if _team_as_of else None,
                       missing_days=sc.get("missing_days") or [],
                       best_day=sc.get("best"), off_days=sc.get("off_days") or [],
                       daily=sc.get("daily") or [], swapped=sc.get("swapped_dates")),
            finance=dict(gross_dia=gross_dia, gross_thb=round(gross_thb, 2),
                         cut_thb=round(gross_thb * PLATFORM_CUT, 2), net_thb=round(net_thb, 2),
                         salary=round(salary_total, 2),
                         commission=(round(commission_total, 2) if has_comm else None),
                         commission_projection=commission_projection,
                         ops_fixed=ops_fixed, ops_comm=ops_comm, ops_total=ops_total,
                         total_cost=round(total_cost, 2), profit=round(profit, 2),
                         margin=round(profit / net_thb * 100, 1) if net_thb else None,
                         roi=round(net_thb / total_cost, 2) if total_cost else None,
                         ops_available=bool(oc), ops_sheet=(oc or {}).get("sheet"),
                         commission_partial=bool(ent_days) and len(ent_days) < (sc.get("days") or 0),
                         entry_days=ent_days,
                         ops_included=USE_OPS_COST),
            members=members, ops_staff=ops_detail,
            as_of_day=_team_as_of, own_last_day=own_last_day,
            mtd_ratio=round(_team_ratio, 6),
            unmatched_off=dict(unmatched),
        ))

    tot = dict(
        score_dia=sum(t["score"]["mtd_dia"] for t in teams_out),
        gross_thb=sum(t["finance"]["gross_thb"] for t in teams_out),
        cut_thb=sum(t["finance"]["cut_thb"] for t in teams_out),
        net_thb=sum(t["finance"]["net_thb"] for t in teams_out),
        salary=sum(t["finance"]["salary"] for t in teams_out),
        commission=sum(t["finance"]["commission"] or 0 for t in teams_out),
        ops=sum(t["finance"]["ops_total"] for t in teams_out),
        total_cost=sum(t["finance"]["total_cost"] for t in teams_out),
        profit=sum(t["finance"]["profit"] for t in teams_out),
        members=sum(len(t["members"]) for t in teams_out),
        active_members=sum(1 for t in teams_out for m in t["members"] if m["active"]),
        kpi_sum=sum(t["score"]["kpi_sum"] for t in teams_out),
        kpi_hit_days=sum(t["score"]["kpi_hit"] or 0 for t in teams_out),
        kpi_marked_days=sum(t["score"]["kpi_marked"] or 0 for t in teams_out),
        view=sum(t["score"]["view"] or 0 for t in teams_out),
        fans=sum(t["score"]["fans"] or 0 for t in teams_out),
        missing_days=sum(len(t["score"]["missing_days"]) for t in teams_out),
    )
    tot["margin"] = round(tot["profit"] / tot["net_thb"] * 100, 1) if tot["net_thb"] else None
    tot["roi"] = round(tot["net_thb"] / tot["total_cost"], 2) if tot["total_cost"] else None

    flat = []
    for t in teams_out:
        for m in t["members"]:
            mm = dict(m); mm["team"] = t["code"]; mm["team_name"] = t["name"]
            flat.append(mm)

    others = []
    for tn in ("ฺฺBBW", "BBW", "No team"):
        for m in roster_team.get(tn, []):
            others.append(dict(team=tn.replace("\u0e3a", ""), nick=m["nick"], thai=m["thai"],
                               status=m["status"], contract=m["contract"],
                               kpi=int(num(m["kpi"])) if isinstance(m["kpi"], (int, float)) else None,
                               salary=int(num(m["salary"])) if isinstance(m["salary"], (int, float)) else 0,
                               tiktok=m["tiktok"], op=m["op"]))

    alerts = []
    for t in teams_out:
        f = t["finance"]
        if f["margin"] is not None and f["profit"] < 0:
            alerts.append(dict(level="warn", team=t["code"], cat="money",
                               text=f'{t["name"]} 净利 {f["profit"]:,.0f} THB（利润率 {f["margin"]}%，未含佣金）',
                               text_th=f'{t["name"]} กำไรสุทธิ {f["profit"]:,.0f} THB (อัตรากำไร {f["margin"]}%)'))
        if t["score"]["missing_days"]:
            d = t["score"]["missing_days"]
            alerts.append(dict(level="danger", team=t["code"],
                               text=f'{t["name"]} 记分表有 {len(d)} 天钻石空白：{", ".join(str(x) for x in d)} 日',
                               text_th=f'{t["name"]} ตารางคะแนนว่าง {len(d)} วัน: {", ".join(str(x) for x in d)}'))
        if not f["ops_available"]:
            alerts.append(dict(level="info", team=t["code"],
                               text=f'{t["name"]} 无运营成本分表 → 净利只扣底薪，偏高',
                               text_th=f'{t["name"]} ไม่มีตารางต้นทุน → กำไรสุทธิหักแค่เงินเดือน'))
        if t["unmatched_off"]:
            names = "、".join(list(t["unmatched_off"])[:4])
            alerts.append(dict(level="info", team=t["code"],
                               text=f'{t["name"]} Day off 里有花名册找不到的名字：{names}',
                               text_th=f'{t["name"]} ชื่อใน Day off ที่ไม่พบในทะเบียน: {names}'))
    _order = {"danger": 0, "warn": 1, "info": 2}
    alerts.sort(key=lambda a: (_order.get(a["level"], 9), a.get("team") or ""))

    # ---- 诊断
    dgoals, dsalary, dmissing, doff = [], [], [], []
    for t in teams_out:
        sc = t["score"]
        row = dict(team=t["code"], team_name=t["name"], goal=sc["goal"], kpi_sum=sc["kpi_sum"],
                   active=sum(1 for m in t["members"] if m["active"]), dia=sc["mtd_dia"],
                   coverage=sc["coverage"], need_mult=sc["need_mult"], need_head=sc["need_head"],
                   suggest=sc["goal_suggest"])
        if not sc["goal"]:
            row["kind"] = "no_goal"
        elif sc["need_mult"] and sc["need_mult"] > 1.25:
            row["kind"] = "gap"
        elif sc["need_mult"] and sc["need_mult"] < 0.85:
            row["kind"] = "loose"
        else:
            row["kind"] = "ok"
        dgoals.append(row)
        for m in t["members"]:
            s, k = m["salary"] or 0, m["kpi"] or 0
            if s > 60000 or (k and s and k / s > 20):
                dsalary.append(dict(team=t["code"], team_name=t["name"], name=m["nick"], salary=s, kpi=k,
                                    cell="VJ Roster!S%d" % m["row"],
                                    file=cfg.ROSTER_FILE))
        if not t["finance"]["ops_available"]:
            dmissing.append(dict(team=t["code"], team_name=t["name"], kind="ops_sheet",
                                 detail="无运营成本分表（Employee Database 无此队）"))
        if sc["metrics_missing"]:
            dmissing.append(dict(team=t["code"], team_name=t["name"], kind="metrics",
                                 detail="记分表未填观看/PCU/ACU/涨粉列"))
        if t["own_last_day"] and t["as_of_day"] and t["own_last_day"] < t["as_of_day"]:
            dmissing.append(dict(team=t["code"], team_name=t["name"], kind="lag",
                                 detail="记分表只到 %d 日（公会口径 %d 日）" % (t["own_last_day"], t["as_of_day"])))
        if sc["missing_days"]:
            dmissing.append(dict(team=t["code"], team_name=t["name"], kind="blank",
                                 detail="钻石空白日：%s" % "、".join("%d日" % d for d in sc["missing_days"])))
        for nm, cnt in (t["unmatched_off"] or {}).items():
            doff.append(dict(team=t["code"], team_name=t["name"], name=nm, count=cnt))

    diag = dict(goals=dgoals, salary=dsalary, missing=dmissing, unmatched_off=doff,
                counts=dict(salary=len(dsalary), missing=len(dmissing),
                            no_goal=sum(1 for g in dgoals if g["kind"] == "no_goal"),
                            gap=sum(1 for g in dgoals if g["kind"] == "gap"),
                            blank_days=sum(len(t["score"]["missing_days"]) for t in teams_out),
                            unmatched_off=len(doff)))

    out = dict(
        generated_at=dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        period=dict(label="2026年11月", label_en="November 2026", start=PERIOD_START.isoformat(),
                    end=PERIOD_END.isoformat(), days_total=DAYS_TOTAL, as_of=GLOBAL_AS_OF,
                    as_of_min=min([t["as_of_day"] or 99 for t in teams_out] or [GLOBAL_AS_OF]),
                    as_of_max=max([t["as_of_day"] or 0 for t in teams_out] or [GLOBAL_AS_OF])),
        fx=dict(usd_thb=FX, platform_cut=PLATFORM_CUT, dia_per_usd=DIA_PER_USD, mc_rate=MC_RATE, ops_rate=OPS_RATE),
        totals=tot, teams=teams_out, members=flat, others=others, alerts=alerts, diag=diag,
        entries=dict(updated_at=ES.load().get("updated_at"),
                     days=sorted({d for (c, d) in ents})),
        basis=dict(member_revenue=bool(ents), commission=bool(ents),
                   note="成员级流水未提供 → 佣金/人效/净贡献不可计算；团队净利 = 实收 − 底薪 − 运营成本（未含佣金）"),
        sources=[
            dict(name="团队记分表 × 11", name_th="ตารางคะแนนทีม × 11",
                 path="data/src/<TEAM> ScoreListGroup.xlsx",
                 kind="团队逐日战绩 + Day off 出勤", kind_th="ผลงานรายวัน + การหยุด", tier="权威", auth=True),
            dict(name="VJ 花名册", name_th="ทะเบียนพนักงาน VJ", path=cfg.ROSTER_FILE,
                 kind="KPI / 底薪 / 合同 / 入职 / 状态 / TikTok", kind_th="KPI / เงินเดือน / สัญญา / สถานะ",
                 tier="权威", auth=True),
            dict(name="运营成本分表", name_th="ตารางต้นทุนปฏิบัติการ", path=cfg.OPSCOST_FILE or "—",
                 kind="MC / 运营 / Ronin / Lighting —— 仅用于净利", kind_th="ใช้คำนวณกำไรสุทธิเท่านั้น",
                 tier="辅助", auth=False),
        ],
    )
    return out

if __name__ == "__main__":
    data = build()
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "dashboard.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    t = data["totals"]
    print(f"[OK] {out}  {os.path.getsize(out)/1024:.0f} KB")
    print(f"  团队 {len(data['teams'])} | 成员 {t['members']} (在职 {t['active_members']}) | KPI 合计 {t['kpi_sum']:,}")
    print(f"  记分表 {t['score_dia']:,} 钻 | 实收 {t['net_thb']:,.0f} | 底薪 {t['salary']:,.0f} | 运营 {t['ops']:,.0f} | 净利 {t['profit']:,.0f} ({t['margin']}%)")
    for tm in data["teams"]:
        f = tm["finance"]
        print(f'    {tm["code"]:<5} {tm["name"]:<13} 成员{len(tm["members"]):>3} 钻{tm["score"]["mtd_dia"]:>10,} 达标{tm["score"]["kpi_hit"]}/{tm["score"]["kpi_marked"]} 净利{f["profit"]:>12,.0f}')

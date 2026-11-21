# -*- coding: utf-8 -*-
"""运营手工录入的每日成绩（团队级 + 成员级），存 data/entries.json。"""
import json, os, re, datetime as dt

ROOT = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(ROOT, "data", "entries.json")
PERIOD = ("2026-11-01", "2026-11-30")   # 与 build_dashboard 的账期一致
FIELDS = ("dia", "view", "pcu", "acu", "fans", "gifters")


def _empty():
    return {"version": 1, "updated_at": None, "data": {}}


def load():
    if not os.path.exists(PATH):
        return _empty()
    try:
        with open(PATH, encoding="utf-8") as f:
            j = json.load(f)
        if not isinstance(j.get("data"), dict):
            return _empty()
        return j
    except Exception:
        return _empty()


def save(j):
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    j["updated_at"] = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tmp = PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(j, f, ensure_ascii=False, indent=1)
    os.replace(tmp, PATH)
    return j


def _int(v):
    if v in (None, "", "-"):
        return None
    try:
        return int(float(str(v).replace(",", "")))
    except Exception:
        return None


def normalize(date, team, payload):
    """校验并规整一条录入。返回 (entry, error)。"""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", str(date or ""))
    if not m:
        return None, "日期格式应为 YYYY-MM-DD"
    if not (PERIOD[0] <= date <= PERIOD[1]):
        return None, "日期必须在本账期 %s ~ %s 内（收到 %s）" % (PERIOD[0], PERIOD[1], date)
    if not team or not re.match(r"^[A-Za-z0-9\-]{1,12}$", team):
        return None, "团队代码无效"
    e = {"team": team, "date": date}
    for k in FIELDS:
        v = _int(payload.get(k))
        if v is not None and v < 0:
            return None, "%s 不能为负数" % k
        e[k] = v
    e["kpi"] = None if payload.get("kpi") in (None, "", "null") else bool(payload.get("kpi"))
    e["off"] = bool(payload.get("off"))
    e["note"] = str(payload.get("note") or "")[:200]
    members = payload.get("members") or {}
    if not isinstance(members, dict):
        return None, "members 必须是 {昵称: 钻石} 对象"
    clean = {}
    for k, v in members.items():
        n = _int(v)
        if n is not None and n < 0:
            return None, "成员 %s 的钻石不能为负数" % k
        if n is not None:
            clean[str(k).strip()] = n
    e["members"] = clean
    tot = sum(clean.values())
    if e["dia"] is None and tot:
        e["dia"] = tot
    if e["dia"] is not None and tot and e["dia"] != tot:
        e["mismatch"] = tot - e["dia"]
    return e, None


def upsert(entry):
    j = load()
    d = j["data"].setdefault(entry["date"], {})
    d[entry["team"]] = entry
    save(j)
    return j


def delete(date, team):
    j = load()
    d = j["data"].get(date) or {}
    if team in d:
        del d[team]
    if not d:
        j["data"].pop(date, None)
    save(j)
    return j


def index():
    """{(team, day_number): entry} 供 build 叠加。"""
    j = load()
    out = {}
    for date, teams in j["data"].items():
        try:
            day = int(date[8:10])
        except Exception:
            continue
        for team, e in teams.items():
            out[(team, day)] = e
    return out


# ---------------------------------------------------------------- 智能粘贴解析
_DATE_RE = re.compile(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})")
_TEAM_HINT = re.compile(r"^\s*(group|team|ทีม|团队|队伍|กลุ่ม)\s*[:\-]?\s*", re.I)
_SKIP = re.compile(r"^\s*(pk\s*star|mvp|note|remark|หมายเหตุ|备注|ผู้ชนะ)\b", re.I)
_TOTAL = re.compile(r"^\s*(total|ยอดรวม|รวม|总计|合计|流水|gmv)\b", re.I)
_BULLET = re.compile(r"^[\-\*\u2022\u00b7\u25cf\u25aa]+\s*")
_NUMTAIL = re.compile(r"^(.*?)[\s:=：\t]+(-?[\d][\d,\.]*)\s*([KkMm])?\s*$")


def _clean(line):
    s = str(line or "").replace("\u3000", " ").replace("\u00a0", " ")
    s = s.replace("：", ":").replace("，", ",").replace("＝", "=")
    s = _BULLET.sub("", s.strip())
    return re.sub(r"[ \t]+", " ", s).strip()


def _to_num(s):
    m = re.search(r"(-?\d[\d,\.]*)", str(s or ""))
    if not m:
        return None
    v = m.group(1).replace(",", "")
    if v.count(".") > 1:
        v = v.replace(".", "")
    try:
        n = float(v)
    except Exception:
        return None
    tail = str(s)[m.end():m.end() + 1].lower()
    if tail == "k":
        n *= 1000
    elif tail == "m":
        n *= 1000000
    return int(round(n))


def _parse_date(s):
    m = _DATE_RE.search(str(s or ""))
    if not m:
        return None
    if m.group(1):
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        d, mo, y = int(m.group(4)), int(m.group(5)), int(m.group(6))
        if y < 100:
            y += 2000
    try:
        return "%04d-%02d-%02d" % (y, mo, d)
    except Exception:
        return None


def _key(s):
    return re.sub(r"[\s\.\-_/()\[\]]", "", str(s or "")).lower()


def _resolve_member(name, memmap):
    k = _key(name)
    if not k:
        return None
    if k in memmap:
        return memmap[k]
    best = None
    for kk, nick in memmap.items():
        if not kk:
            continue
        if kk.startswith(k) or k.startswith(kk):
            if best is None or abs(len(kk) - len(k)) < abs(len(best[0]) - len(k)):
                best = (kk, nick)
    return best[1] if best else None


def parse_report(text, teams, memmap):
    """解析自由格式日报 / CSV。返回 (entries, errors, unmatched_names)。"""
    tmap = {}
    for code, name in teams:
        tmap[_key(name)] = code
        tmap[_key(code)] = code
        first = name.split()[0]
        if len(first) >= 3:
            tmap.setdefault(_key(first), code)
    tokens = sorted(tmap.keys(), key=len, reverse=True)

    entries, errors, unmatched = [], [], set()
    cur = [None]

    def flush():
        if cur[0] and (cur[0].get("members") or cur[0].get("dia") is not None):
            entries.append(cur[0])
        cur[0] = None

    for i, raw in enumerate(str(text or "").splitlines(), 1):
        line = _clean(raw)
        if not line or _SKIP.match(line):
            continue

        # 纯 CSV
        parts = [p.strip() for p in re.split(r"[,\t;]", line)]
        if len(parts) >= 3 and not re.search(r"[:=]", line):
            code_ = tmap.get(_key(parts[0]))
            dt = _parse_date(parts[1])
            if code_ and dt:
                rest = parts[2:]
                if len(rest) >= 2 and _to_num(rest[0]) is None and _to_num(rest[1]) is not None:
                    mname = _resolve_member(rest[0], memmap)
                    if mname is None:
                        unmatched.add(rest[0])
                        errors.append("第%d行：成员「%s」不在花名册" % (i, rest[0]))
                    else:
                        cur[0] = cur[0] if (cur[0] and cur[0]["team"] == code_ and cur[0]["date"] == dt) else {"date": dt, "team": code_, "members": {}}
                        cur[0]["members"][mname] = _to_num(rest[1])
                    continue
                if _to_num(rest[0]) is not None:
                    flush()
                    e = {"date": dt, "team": code_, "dia": _to_num(rest[0]), "members": {}}
                    for idx, k in ((1, "view"), (2, "pcu"), (3, "acu"), (4, "fans"), (5, "gifters")):
                        if len(rest) > idx:
                            e[k] = _to_num(rest[idx])
                    entries.append(e)
                    continue

        # 团队 + 日期 头（有无 Group 前缀都行）
        dt_here = _parse_date(line)
        if dt_here:
            low = _key(line)
            hit = None
            for tok in tokens:
                if tok and tok in low:
                    hit = tmap[tok]
                    break
            if hit:
                flush()
                cur[0] = {"date": dt_here, "team": hit, "members": {}, "note": ""}
                continue
        # 只有团队名、没有日期
        if not dt_here:
            low = _key(line)
            for tok in tokens:
                if tok and len(tok) >= 3 and tok in low:
                    if cur[0] is None or cur[0].get("team") != tmap[tok]:
                        flush()
                        cur[0] = {"date": None, "team": tmap[tok], "members": {}, "note": ""}
                    break
            if cur[0] and not cur[0].get("date"):
                cur[0]["date"] = dt_here
                continue

        # Total
        if _TOTAL.match(line) or _TOTAL.match(_TEAM_HINT.sub("", line)):
            if cur[0] is not None:
                n = _to_num(line.split(":", 1)[-1] if ":" in line else line)
                if n is not None:
                    cur[0]["dia"] = n
            continue

        # 名字 + 数字（: = tab 多空格 单空格 都认）
        m = _NUMTAIL.match(line)
        if m:
            nm = m.group(1).strip(" :=").strip()
            val = _to_num(m.group(2) + (m.group(3) or ""))
            if val is not None and nm and not re.fullmatch(r"[\d,\.]+", nm):
                if cur[0] is None:
                    errors.append("第%d行：成员「%s」前缺少团队/日期" % (i, nm))
                    continue
                nick = _resolve_member(nm, memmap)
                if nick is None:
                    unmatched.add(nm)
                    errors.append("第%d行：成员「%s」不在花名册" % (i, nm))
                    continue
                cur[0]["members"][nick] = val
                continue

        errors.append("第%d行：无法识别「%s」" % (i, line[:40]))

    flush()
    # 同一 team+date 的多段合并
    merged, order = {}, []
    for e in entries:
        k = (e.get("date"), e.get("team"))
        if k in merged:
            merged[k]["members"].update(e.get("members") or {})
            if e.get("dia") is not None:
                merged[k]["dia"] = e["dia"]
        else:
            merged[k] = dict(e)
            merged[k]["members"] = dict(e.get("members") or {})
            order.append(k)
    entries = [merged[k] for k in order]
    out = []
    for e in entries:
        if not e.get("date"):
            errors.append("缺少日期：团队 %s（请把日期写在同一行，如「Group T01 20/11/26」）" % (e.get("team") or "?"))
            continue
        if not e.get("team"):
            errors.append("缺少团队：%s" % e["date"])
            continue
        tot = sum(e.get("members", {}).values())
        if e.get("dia") is None and tot:
            e["dia"] = tot
        if e.get("dia") is not None and tot and e["dia"] != tot:
            e["mismatch"] = tot - e["dia"]
        out.append(e)
    return out, errors, sorted(unmatched)

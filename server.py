#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""直播团队数据看板 · 本地服务器
用法:  python server.py [--port 8777] [--no-browser]
接口:
  GET  /                -> web/index.html
  GET  /api/data        -> data/dashboard.json  (gzip)
  GET  /api/summary     -> 轻量摘要
  POST /api/rebuild     -> 重新从 Excel/CSV 构建并返回摘要
  GET  /api/health
"""
import argparse, gzip, json, mimetypes, os, sys, threading, time, traceback, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import re
import entries_store as ES
import entry_log as EL
import ops_admin as OA
from urllib.parse import urlparse, unquote, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
DATA = os.path.join(HERE, "data")
JSON_PATH = os.path.join(DATA, "dashboard.json")
sys.path.insert(0, HERE)

_lock = threading.Lock()
_cache = {"raw": None, "gz": None, "mtime": 0.0}


def load_bytes():
    """读取(并按需重建) dashboard.json，返回 (text_bytes, gz_bytes)。"""
    if not os.path.exists(JSON_PATH):
        rebuild()
    mt = os.path.getmtime(JSON_PATH)
    with _lock:
        if _cache["mtime"] != mt or _cache["raw"] is None:
            with open(JSON_PATH, "rb") as f:
                raw = f.read()
            _cache.update(raw=raw, gz=gzip.compress(raw, 6), mtime=mt)
        return _cache["raw"], _cache["gz"]



VJ_MODE = False      # --vj：对外只给成绩，剔除一切财务字段
AUTH_REQUIRED = False  # --auth：写操作要求运营 token（默认关闭，谁都能写但留痕）


def strip_finance(d):
    """VJ 视图：去掉薪酬、佣金、成本、净利、运营人员名单。"""
    out = dict(d)
    out["vj"] = True
    out["basis"] = dict(member_revenue=bool((d.get("basis") or {}).get("member_revenue")),
                        commission=False, note="")
    t = dict(d.get("totals") or {})
    for k in ("gross_thb", "cut_thb", "net_thb", "salary", "commission", "ops",
              "total_cost", "profit", "margin", "roi", "kpi_sum"):
        t.pop(k, None)
    t["kpi_sum"] = (d.get("totals") or {}).get("kpi_sum")
    out["totals"] = t
    teams = []
    for tm in d.get("teams") or []:
        x = dict(tm)
        x.pop("finance", None)
        x.pop("ops_staff", None)
        mem = []
        for m in tm.get("members") or []:
            mm = dict(m)
            for k in ("salary", "salary_mtd", "salary_raw", "commission", "net", "roi", "bonus"):
                mm.pop(k, None)
            mm["team"] = tm.get("code")
            mm["team_name"] = tm.get("name")
            mem.append(mm)
        x["members"] = mem
        teams.append(x)
    out["teams"] = teams
    out["members"] = [m for tm in teams for m in tm["members"]]
    oth = []
    for o in (d.get("others") or []):
        oo = dict(o)
        for k in ("salary", "bonus", "kpi"):
            oo.pop(k, None)
        oth.append(oo)
    out["others"] = oth
    out["alerts"] = [a for a in (d.get("alerts") or []) if a.get("cat") != "money"]
    out["sources"] = [s for s in (d.get("sources") or []) if s.get("tier") != "辅助"]
    out["diag"] = None
    out["entries"] = dict(days=(d.get("entries") or {}).get("days") or [])
    return out

def rebuild():
    import importlib
    import build_dashboard
    importlib.reload(build_dashboard)
    t0 = time.time()
    data = build_dashboard.build()
    os.makedirs(DATA, exist_ok=True)
    tmp = JSON_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, JSON_PATH)
    _cache.clear()
    _cache.update(raw=None, gz=None, mtime=0.0)
    return dict(ok=True, seconds=round(time.time() - t0, 2),
                generated_at=data["generated_at"],
                teams=len(data["teams"]), members=data["totals"]["members"],
                score_dia=data["totals"]["score_dia"], profit=data["totals"]["profit"])



# ---------------------------------------------------------------- 报告导出
import csv as _csv, io as _io, html as _html, urllib.parse as _url


def _fmt(n, d=0):
    try:
        return f"{float(n):,.{d}f}"
    except Exception:
        return "—"

def _find(data, team_code, name):
    t = next((x for x in data["teams"] if x["code"] == team_code), None)
    if not t:
        return None, None
    k = (name or "").strip().lower()
    m = None
    for x in t["members"]:
        if (x.get("nick") or "").lower() == k or (x.get("en") or "").lower() == k:
            m = x
            break
    return t, m


def _member_rows(m):
    rows = [
        ("KPI（月）", m.get("kpi")),
        ("KPI（MTD）", m.get("kpi_mtd")),
    ]
    if m.get("dia") is not None:
        rows += [("个人流水（钻）", m.get("dia")), ("KPI 进度%", m.get("kpi_progress"))]
    if m.get("salary") is not None:
        rows += [("底薪（月）", m.get("salary")), ("底薪（MTD）", m.get("salary_mtd"))]
    if m.get("commission") is not None and m.get("dia"):
        rows += [("佣金", m.get("commission")), ("净贡献", m.get("net"))]
    rows += [("休息天数", m.get("off_count")), ("出勤天数", m.get("present_days")),
             ("合同", m.get("contract")), ("入职", (m.get("start") or "—")[:10]),
             ("主管", m.get("op")), ("TikTok", ("@" + m["tiktok"]) if m.get("tiktok") else "—")]
    return rows


def render_member_report(data, team_code, name, lang="zh"):
    t, m = _find(data, team_code, name)
    if not m:
        return None
    e = _html.escape
    offs = "、".join("11-%02d" % d for d in (m.get("off_days") or [])) or "—"
    rows = "".join(
        '<tr><td class="k">%s</td><td class="v">%s</td></tr>' % (e(k), e(_fmt(v) if isinstance(v, (int, float)) else str(v or "—")))
        for k, v in _member_rows(m))
    return """<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<title>%s · %s</title><style>
body{font:14px/1.7 -apple-system,"Segoe UI",sans-serif;color:#1d1d1f;margin:36px;max-width:640px}
h1{font-size:26px;margin:0 0 2px}h2{font-size:13px;color:#86868b;font-weight:500;margin:0 0 18px}
table{width:100%%;border-collapse:collapse;margin-top:10px}
td{padding:9px 6px;border-bottom:1px solid #e5e5ea}
.k{color:#6e6e73;width:44%%}.v{font-weight:600;text-align:right}
.foot{margin-top:22px;color:#86868b;font-size:11px}
</style></head><body>
<h1>%s　<span style="font-weight:500;color:#6e6e73">%s</span></h1>
<h2>%s · MC %s · %s</h2>
<table>%s</table>
<div class="foot">休息日：%s<br>Live Team Dashboard · %s</div>
</body></html>""" % (
        e(m.get("nick") or ""), e(t["name"]), e(m.get("nick") or ""), e(m.get("thai") or ""),
        e(t["name"]), e(t.get("mc") or "—"), e(data["period"]["label"]), rows, e(offs),
        e(data["generated_at"]))


def render_members_csv(data, lang="zh"):
    members = [m for t in data["teams"] for m in t["members"]]
    has_sal = any(m.get("salary") is not None for m in members)
    has_dia = any(m.get("dia") is not None for m in members)
    head = ["团队", "昵称", "英文名", "泰文名", "状态", "合同", "KPI(月)", "KPI(MTD)"]
    if has_dia:
        head += ["个人流水(钻)", "KPI进度%"]
    if has_sal:
        head += ["底薪(月)", "底薪(MTD)"]
    head += ["休息天数", "出勤天数", "入职", "TikTok"]
    buf = _io.StringIO()
    w = _csv.writer(buf)
    w.writerow(head)
    for t in data["teams"]:
        for m in t["members"]:
            row = [t["name"], m.get("nick"), m.get("en") or "", m.get("thai") or "",
                   m.get("status") or "", m.get("contract") or "",
                   m.get("kpi") or "", m.get("kpi_mtd") or ""]
            if has_dia:
                row += [m.get("dia") or "", m.get("kpi_progress") or ""]
            if has_sal:
                row += [m.get("salary") or "", m.get("salary_mtd") or ""]
            row += [m.get("off_count") or 0, m.get("present_days") or 0,
                    (m.get("start") or "")[:10], m.get("tiktok") or ""]
            w.writerow(row)
    return "\ufeff" + buf.getvalue()


def render_member_csv(data, team_code, name, lang="zh"):
    t, m = _find(data, team_code, name)
    if not m:
        return None
    buf = _io.StringIO()
    w = _csv.writer(buf)
    w.writerow(["团队", t["name"], "昵称", m.get("nick") or "", "泰文名", m.get("thai") or ""])
    for k, v in _member_rows(m):
        w.writerow([k, v])
    return "\ufeff" + buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    server_version = "Board/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None, gzipped=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        if gzipped:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        _u = urlparse(self.path)
        path = unquote(_u.path)
        q = {k: v[0] for k, v in parse_qs(_u.query).items()}
        try:
            if path in ("/api/data", "/api/dashboard.json"):
                raw, gz = load_bytes()
                if VJ_MODE:
                    raw = json.dumps(strip_finance(json.loads(raw)), ensure_ascii=False).encode("utf-8")
                    gz = gzip.compress(raw, 6)
                extra = {}
                if q.get("download"):
                    extra["Content-Disposition"] = 'attachment; filename="board-%s.json"' % time.strftime("%Y%m%d")
                if "gzip" in (self.headers.get("Accept-Encoding") or "") and not extra:
                    return self._send(200, gz, gzipped=True)
                return self._send(200, raw, extra=extra)
            if path == "/api/report":
                raw, _ = load_bytes()
                d = json.loads(raw)
                if VJ_MODE:
                    d = strip_finance(d)
                team = q.get("team", ""); name = q.get("name", ""); lang = q.get("lang", "zh"); fmt = q.get("format", "html")
                if lang not in ("zh", "th"): lang = "zh"
                if fmt == "csv":
                    body = render_member_csv(d, team, name, lang)
                    if body is None: return self._json(dict(error="member not found", team=team, name=name), 404)
                    fn = "%s_%s_%s.csv" % (team, re.sub(r"[^A-Za-z0-9_.-]", "_", (name or "vj")), d["period"]["label"].replace("年", "").replace("月", ""))
                    return self._send(200, body.encode("utf-8"), "text/csv; charset=utf-8",
                                      extra={"Content-Disposition": 'attachment; filename="%s"' % fn})
                body = render_member_report(d, team, name, lang)
                if body is None: return self._json(dict(error="member not found", team=team, name=name), 404)
                fn = "%s_%s_report.html" % (team, re.sub(r"[^A-Za-z0-9_.-]", "_", (name or "vj")))
                extra = {} if q.get("inline") else {"Content-Disposition": 'attachment; filename="%s"' % fn}
                return self._send(200, body.encode("utf-8"), "text/html; charset=utf-8", extra=extra)
            if path == "/api/members.csv":
                raw, _ = load_bytes()
                d = json.loads(raw)
                if VJ_MODE:
                    d = strip_finance(d)
                lang = q.get("lang", "zh")
                if lang not in ("zh", "th"): lang = "zh"
                body = render_members_csv(d, lang)
                return self._send(200, body.encode("utf-8"), "text/csv; charset=utf-8",
                                  extra={"Content-Disposition": 'attachment; filename="board-members-%s.csv"' % time.strftime("%Y%m%d")})
            if path == "/api/entries":
                raw, _ = load_bytes()
                d = json.loads(raw)
                j = ES.load()
                teams = [dict(code=t["code"], name=t["name"],
                              members=[dict(nick=m["nick"], kpi=m["kpi"], salary=m["salary"],
                                            active=m["active"]) for m in t["members"]]) for t in d["teams"]]
                return self._json(dict(ok=True, teams=teams, entries=j.get("data") or {},
                                       updated_at=j.get("updated_at"), period=d["period"]))
            if path == "/api/entry/log":
                try:
                    lim = int(q.get("limit") or 100)
                except Exception:
                    lim = 100
                return self._json(dict(ok=True, items=EL.read(min(max(lim, 1), 500))))
            if path == "/api/health":
                return self._json(dict(ok=True, json=os.path.exists(JSON_PATH),
                                       mtime=os.path.getmtime(JSON_PATH) if os.path.exists(JSON_PATH) else None))
            if path == "/api/summary":
                raw, _ = load_bytes()
                d = json.loads(raw)
                return self._json(dict(generated_at=d["generated_at"], period=d["period"],
                                       totals=d["totals"], teams=[dict(code=t["code"], name=t["name"],
                                                                       dia=t["score"]["mtd_dia"],
                                                                       profit=t["finance"]["profit"]) for t in d["teams"]]))
            if path in ("/", "/index.html"):
                return self._serve_file(os.path.join(WEB, "index.html"))
            return self._serve_file(os.path.join(WEB, path.lstrip("/")))
        except FileNotFoundError:
            self._json(dict(error="not found", path=path), 404)
        except Exception:
            self._json(dict(error="server error", detail=traceback.format_exc()[-1200:]), 500)

    def _serve_file(self, full):
        full = os.path.normpath(full)
        if not full.startswith(WEB):
            return self._json(dict(error="forbidden"), 403)
        if not os.path.isfile(full):
            raise FileNotFoundError(full)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            body = f.read()
        self._send(200, body, ctype)

    def _op(self):
        tok = (self.headers.get("X-Edit-Key") or "").strip()
        if not tok:
            q = parse_qs(urlparse(self.path).query)
            tok = (q.get("k") or [""])[0].strip()
        return OA.find(tok)

    def _peer(self):
        ip = self.headers.get("X-Forwarded-For") or self.client_address[0]
        return ip.split(",")[0].strip(), (self.headers.get("User-Agent") or "")[:80]

    def do_POST(self):
        path = urlparse(self.path).path
        _ip, _ua = self._peer()
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            payload = {}
        try:
            if VJ_MODE and path in ("/api/entry", "/api/entry/delete", "/api/entry/csv", "/api/rebuild"):
                return self._json(dict(ok=False, error="VJ 视图只读，请到完整看板录入"), 403)
            _op = self._op()   # 有 token 就记操作人，没 token 也允许写（除非 --auth）
            if AUTH_REQUIRED and path in ("/api/entry", "/api/entry/delete", "/api/entry/csv", "/api/rebuild"):
                if not _op:
                    return self._json(dict(ok=False, error="需要编辑口令：请用运营专属链接（?k=...）打开"),
                                      401)
            if path == "/api/rebuild":
                res = rebuild()
                load_bytes()
                return self._json(res)
            if path == "/api/entry":
                _raw0, _ = load_bytes()
                _codes = {t["code"] for t in json.loads(_raw0)["teams"]}
                if str(payload.get("team") or "") not in _codes:
                    return self._json(dict(ok=False, error="团队代码不存在：%s" % payload.get("team")), 400)
                if AUTH_REQUIRED and not OA.can_write(_op, payload.get("team")):
                    return self._json(dict(ok=False, error="你没有 %s 队的写入权限" % payload.get("team")), 403)
                _team = next((t for t in json.loads(_raw0)["teams"] if t["code"] == payload.get("team")), None)
                _known = set()
                for m in (_team or {}).get("members", []):
                    _known.add(str(m.get("nick") or ""))
                    if m.get("en"):
                        _known.add(str(m["en"]))
                _bad = [k for k in (payload.get("members") or {}) if str(k) not in _known]
                if _bad:
                    return self._json(dict(ok=False, error="成员不在花名册：%s" % "、".join(_bad[:5])), 400)
                e, err = ES.normalize(payload.get("date"), payload.get("team"), payload)
                if err:
                    return self._json(dict(ok=False, error=err), 400)
                ES.upsert(e)
                EL.add("save", e["date"], e["team"], e.get("dia"),
                       len(e.get("members") or {}), e.get("note") or "",
                       ("成员合计不符 %+d" % e["mismatch"]) if e.get("mismatch") else "",
                       ip=_ip, ua=_ua, by=_op.get("name") if _op else "")
                res = rebuild()
                load_bytes()
                return self._json(dict(ok=True, entry=e, rebuild=res))
            if path == "/api/entry/delete":
                _d = str(payload.get("date") or "")
                _t = str(payload.get("team") or "")
                ES.delete(_d, _t)
                EL.add("delete", _d, _t, None, None, "", "删除该日录入", ip=_ip, ua=_ua,
                       by=_op.get("name") if _op else "")
                res = rebuild()
                load_bytes()
                return self._json(dict(ok=True, rebuild=res))
            if path == "/api/entry/csv":
                text = str(payload.get("text") or "")
                _raw, _ = load_bytes()
                d = json.loads(_raw)
                teams = [(t["code"], t["name"]) for t in d["teams"]]
                memmap = {}
                for t in d["teams"]:
                    for m in t["members"]:
                        memmap[ES._key(m["nick"])] = m["nick"]
                        if m.get("en"):
                            memmap[ES._key(m["en"])] = m["nick"]
                entries, errs, unmatched = ES.parse_report(text, teams, memmap)
                _codes = {t["code"] for t in d["teams"]}
                bad = sorted({e["team"] for e in entries if e.get("team") not in _codes})
                if bad:
                    errs.append("未知团队代码：" + ",".join(bad))
                entries = [e for e in entries if e.get("team") in _codes
                           and (not AUTH_REQUIRED or OA.can_write(_op, e.get("team")))]
                saved, parsed = 0, []
                for e in entries:
                    ent, err = ES.normalize(e["date"], e["team"], e)
                    if err:
                        errs.append(err)
                        continue
                    ES.upsert(ent)
                    EL.add("import", ent["date"], ent["team"], ent.get("dia"),
                           len(ent.get("members") or {}), "",
                           ("成员合计不符 %+d" % ent["mismatch"]) if ent.get("mismatch") else "批量导入",
                           ip=_ip, ua=_ua, by=_op.get("name") if _op else "")
                    saved += 1
                    parsed.append(dict(team=ent["team"], date=ent["date"], dia=ent.get("dia"),
                                       members=len(ent.get("members") or {}),
                                       mismatch=ent.get("mismatch")))
                res = rebuild()
                load_bytes()
                return self._json(dict(ok=True, saved=saved, errors=errs, unmatched=unmatched,
                                       parsed=parsed, rebuild=res))
            return self._json(dict(error="not found"), 404)
        except Exception:
            return self._json(dict(ok=False, error=traceback.format_exc()[-2000:]), 500)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--vj", action="store_true", help="VJ 视图：剔除财务字段")
    ap.add_argument("--auth", action="store_true", help="写操作要求运营 token（默认关闭）")
    args = ap.parse_args()
    global VJ_MODE, AUTH_REQUIRED
    VJ_MODE = bool(args.vj)
    AUTH_REQUIRED = bool(args.auth)
    load_bytes()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    url = "http://%s:%d/" % (args.host, args.port)
    print("=" * 66)
    print("  直播团队数据看板  ->  %s" % url)
    print("  JSON             ->  %sapi/data%s" % (url, "  [VJ 模式 · 无财务]" if VJ_MODE else ""))
    print("  写入鉴权          ->  %s" % ("需要 token（--auth）" if AUTH_REQUIRED else "关闭（谁都能写，留痕）"))
    print("  数据文件          ->  %s" % JSON_PATH)
    print("  Ctrl+C 停止")
    print("=" * 66)
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()

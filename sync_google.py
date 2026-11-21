# -*- coding: utf-8 -*-
"""从 Google Drive / Sheets 同步 11 张记分表 + 花名册，然后重建看板。

用法:
  python sync_google.py            # 下载 + 重建
  python sync_google.py --no-build # 只下载
"""
import io, json, os, re, sys, time, urllib.request, hashlib, datetime as dt

try:                      # SYSTEM 任务下 stdout 默认 cp1252，中文会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "data", "src")
LOG = os.path.join(ROOT, "data", "sync_log.txt")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

from config import cfg  # noqa: E402  (项目根的部署配置)

FOLDER = cfg.SOURCE_FOLDER_URL
ROSTER = cfg.ROSTER_URL
ROSTER_NAME = cfg.ROSTER_FILE


def log(msg):
    line = "[%s] %s" % (dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    try:
        print(line)
    except Exception:
        pass
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with io.open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def fetch(url, timeout=180):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def list_files():
    html = fetch(FOLDER).decode("utf-8", "replace")
    pat = re.compile(r'aria-label="([^"]+?)\s+Microsoft\s+Excel[^"]*"[^>]*?ssk=\'[^\']*?:([-\w]{25,44})\'')
    out = {}
    for name, ssk in pat.findall(html):
        fid = re.sub(r"-0-\d+$", "", ssk)
        if name.lower().endswith(".xlsx"):
            out[name.strip()] = fid
    return out


def save(name, data):
    os.makedirs(SRC, exist_ok=True)
    path = os.path.join(SRC, name)
    old = None
    if os.path.exists(path):
        old = hashlib.md5(open(path, "rb").read()).hexdigest()
    new = hashlib.md5(data).hexdigest()
    if old == new:
        return False, path, len(data)
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)
    return True, path, len(data)


def main():
    do_build = "--no-build" not in sys.argv
    t0 = time.time()
    try:
        files = list_files()
    except Exception as e:
        log("列目录失败: %s" % e)
        return 1
    if len(files) < 5:
        log("只找到 %d 个记分表，可能文件夹改权限了，放弃本次同步" % len(files))
        return 1

    changed, failed = 0, []
    for name, fid in sorted(files.items()):
        try:
            data = fetch("https://drive.google.com/uc?export=download&id=" + fid)
            if data[:2] != b"PK":
                raise ValueError("不是 xlsx（%d 字节）" % len(data))
            ch, _, size = save(name, data)
            changed += 1 if ch else 0
        except Exception as e:
            failed.append(name)
            log("下载失败 %s: %s" % (name, str(e)[:100]))

    try:
        rdata = fetch(ROSTER)
        if rdata[:2] == b"PK":
            ch, _, size = save(ROSTER_NAME, rdata)
            changed += 1 if ch else 0
        else:
            failed.append(ROSTER_NAME)
    except Exception as e:
        failed.append(ROSTER_NAME)
        log("花名册下载失败: %s" % str(e)[:100])

    log("同步完成：%d 个文件更新，%d 个失败，用时 %.1fs" % (changed, len(failed), time.time() - t0))
    if failed:
        log("失败清单: " + ", ".join(failed))

    if do_build:
        try:
            import importlib
            import build_dashboard
            importlib.reload(build_dashboard)
            data = build_dashboard.build()
            out = os.path.join(ROOT, "data", "dashboard.json")
            with open(out + ".tmp", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            os.replace(out + ".tmp", out)
            t = data["totals"]
            log("重建完成：%d 队 / %d 人 / 流水 %s 钻 / 净利 %s THB" % (
                len(data["teams"]), t["members"], format(t["score_dia"], ","), format(round(t["profit"]), ",")))
        except Exception as e:
            import traceback
            log("重建失败: " + traceback.format_exc()[-600:])
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

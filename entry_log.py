# -*- coding: utf-8 -*-
"""录入操作日志（谁在什么时候改了什么）。"""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(ROOT, "data", "entry_log.json")
MAX = 500


def read(limit=100):
    if not os.path.exists(LOG_PATH):
        return []
    try:
        with open(LOG_PATH, encoding="utf-8") as f:
            j = json.load(f)
        items = j.get("items") or []
    except Exception:
        return []
    return items[:limit]


def add(action, date=None, team=None, dia=None, members=None, note="", detail="", ip="", ua="", by=""):
    items = read(MAX)
    items.insert(0, dict(
        ts=dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        action=action, date=date or "", team=team or "",
        dia=dia, members=members if members is not None else None,
        note=note or "", detail=detail or "", ip=ip or "", by=by or "",
    ))
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    tmp = LOG_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"items": items[:MAX]}, f, ensure_ascii=False, indent=1)
    os.replace(tmp, LOG_PATH)
    return True

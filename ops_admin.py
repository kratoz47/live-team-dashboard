# -*- coding: utf-8 -*-
"""运营账号管理：每人一个 token 链接，可限定能写哪些团队。

用法:
  python ops_admin.py add "运营A" [MT,RT]     # 不带团队 = 全部
  python ops_admin.py list
  python ops_admin.py revoke "运营A"
  python ops_admin.py link "运营A" [--vj]     # 打印可发给对方的链接
"""
import json, os, secrets, sys

from config import cfg

ROOT = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(ROOT, "data", "operators.json")
BASE = cfg.PUBLIC_BASE_URL


def load():
    if not os.path.exists(PATH):
        return {"ops": []}
    try:
        with open(PATH, encoding="utf-8") as f:
            j = json.load(f)
        return j if isinstance(j.get("ops"), list) else {"ops": []}
    except Exception:
        return {"ops": []}


def save(j):
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    tmp = PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(j, f, ensure_ascii=False, indent=1)
    os.replace(tmp, PATH)


def find(token):
    if not token:
        return None
    for o in load()["ops"]:
        if o.get("token") == token:
            return o
    return None


def can_write(op, team):
    if not op:
        return False
    teams = op.get("teams") or ["*"]
    return "*" in teams or team in teams


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    cmd = args[0]
    j = load()
    if cmd == "add":
        name = args[1] if len(args) > 1 else "operator"
        teams = [t.strip() for t in (args[2].split(",") if len(args) > 2 else ["*"]) if t.strip()]
        tok = "ops_" + secrets.token_urlsafe(18)
        j["ops"] = [o for o in j["ops"] if o.get("name") != name]
        j["ops"].append(dict(name=name, token=tok, teams=teams))
        save(j)
        print("已创建：%s  teams=%s" % (name, ",".join(teams)))
        print("链接：%s/board/?k=%s" % (BASE, tok))
    elif cmd == "list":
        for o in j["ops"]:
            print("%-10s %-24s %s" % (o.get("name"), o.get("token"), ",".join(o.get("teams") or ["*"])))
    elif cmd == "revoke":
        name = args[1]
        j["ops"] = [o for o in j["ops"] if o.get("name") != name]
        save(j)
        print("已撤销：" + name)
    elif cmd == "link":
        name = args[1]
        o = next((x for x in j["ops"] if x.get("name") == name), None)
        if not o:
            print("找不到：" + name)
            return
        print("%s/board/?k=%s" % (BASE, o["token"]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()

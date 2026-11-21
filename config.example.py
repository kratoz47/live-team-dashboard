# -*- coding: utf-8 -*-
"""示例配置：复制为 config.local.py 后填写真实值。

config.local.py 不入库；这里只保留结构与占位值。
"""
from collections import OrderedDict

# 本地下载目录（记分表/花名册的兜底位置）；留空表示只用 data/src 下的同步副本。
DOWNLOADS_DIR = ""

# 花名册与运营成本分表的文件名（放在 DOWNLOADS_DIR 或 data/src 下）。
ROSTER_FILE = "VJ Onboarding Record.xlsx"
OPSCOST_FILE = "Employee Database (VJ).xlsx"
USE_OPS_COST = False          # 关掉后团队净利 = 实收 − 底薪（不含运营成本）

# 汇率与分成口径：按你自己的业务填写。
FX = 33.0
PLATFORM_CUT = 0.35
DIA_PER_USD = 100
MC_RATE = 0.01
OPS_RATE = 0.005

# 团队表：code 用于路由与文件名，name 是展示名，file 是记分表文件名，
# roster 是花名册里该队的写法，cost 是运营成本分表里的工作表名前缀。
TEAMS = OrderedDict([
    ("T01", dict(name="TEAM 01", file="TEAM01 ScoreListGroup.xlsx", roster="TEAM 01", cost="")),
    ("T02", dict(name="TEAM 02", file="TEAM02 ScoreListGroup.xlsx", roster="TEAM 02", cost="")),
    ("T03", dict(name="TEAM 03", file="TEAM03 ScoreListGroup.xlsx", roster="TEAM 03", cost="")),
])

# 记分表 Day off 里的英文名 -> 花名册昵称，仅用于把「谁休息」对上人。
ALIASES = {}

# 运营成本分表里的英文名 -> 花名册昵称，仅用于底薪去重。
COST_ALIAS = {}

# 数据源（Google Drive 文件夹 / 花名册表格导出链接）。
SOURCE_FOLDER_URL = "https://drive.google.com/drive/folders/<FOLDER_ID>"
ROSTER_URL = "https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=xlsx&gid=0"

# 对外访问地址（反代/内网穿透入口），用于打印运营链接。
PUBLIC_BASE_URL = "https://<your-host>"

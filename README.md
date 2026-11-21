# 直播团队数据看板

公会（11 个直播团队）的月度成绩与财务看板。数据来自 Google 表格自动同步，运营可在网页上补录每日成绩，保存后自动重算并刷新。

## 两个访问入口

| 用途 | 链接 | 内容 |
|---|---|---|
| 完整看板（管理层 / 运营） | https://<your-host>/board/ | 流水、实收、底薪、运营成本、净利、佣金、录入、诊断 |
| VJ 视图（给主播） | https://<your-host>/vj/ | 只有成绩：流水、KPI 达标、观看、转化率、出勤 |

本地直连：`http://127.0.0.1:8777/`（完整）、`http://127.0.0.1:8778/`（VJ）

VJ 版是**另一个服务实例**（`--vj` 参数），在服务端就把薪酬/佣金/成本/净利字段删掉，前端拿不到，写入一律 403。

## 快速开始

```powershell
# 平时（已配好开机自启，一般不用手动执行）
.\start_servers.cmd          # 起两个服务
python .\sync_google.py      # 从 Google 拉最新表格并重建
python .\build_dashboard.py  # 只用本地文件重建
```

网页右上角也有「重建数据」按钮，等同跑一次 `build_dashboard.py`。

## 部署配置

团队名单、花名映射、汇率/分成、Google 数据源链接与对外地址都是**部署数据**，不写死在代码里：

```powershell
copy config.example.py config.local.py   # 然后按注释填写
```

- `config.example.py`：入库的示例（通用团队代号、占位链接）
- `config.local.py`：本机真实配置，**已被 .gitignore 排除**
- `config.py`：加载器；没有 `config.local.py` 时会给出提示并按示例启动

## 页面

| 页面 | 路由 | 内容 |
|---|---|---|
| 总览 | `#/` | 6 个核心数字、团队流水排名、净利排名、团队卡片、结构对账、预警 |
| 团队 | `#/team/<CODE>` | 目标进度、逐日柱状图、财务拆解、运营岗成本、成员表 |
| 成员榜 | `#/members` | 全公会 KPI / 出勤 / 数据覆盖率，可导出 PNG |
| 录入 | `#/entry` | 团队 + 成员每日成绩录入、日报粘贴、批量导入、操作日志 |
| 诊断 | `#/diagnose` | 目标与 KPI 建议、数据覆盖、缺失项、Day off 未匹配、底薪异常 |
| 口径 | `#/reconcile` | 口径说明与数据源清单 |

右上角可切换 **中文 / ไทย**、**明/暗主题**（跟随系统）。手机端已适配。

## 数据来源

**只认 12 张表**：

- 11 张 `<TEAM> ScoreListGroup.xlsx`（团队逐日记分表）—— 团队官方号流水、日 KPI 达标、观看/PCU/ACU/涨粉/礼物人数、Day off 名单
- 1 张 `VJ Onboarding Record.xlsx`（花名册）—— 成员 KPI、底薪、合同、入职日、状态、TikTok

来源是这两个 Google 地址，每天 06:00 自动同步到 `dashboard/data/src/`：

- 记分表文件夹：https://drive.google.com/drive/folders/<FOLDER_ID>
- 花名册：https://docs.google.com/spreadsheets/d/<SHEET_ID>

辅助（仅用于净利）：`Employee Database (VJ).xlsx` 运营成本分表。

文件路径与链接都在 `config.local.py`（示例见 `config.example.py`）里配置，仓库本身不含真实表格 ID 与团队名单。

## 目录结构

```
dashboard/
├─ config.py              # 部署配置加载器（有 config.local.py 用本地，否则用示例）
├─ config.example.py      # 入库的示例配置（通用团队代号 / 占位链接）
├─ config.local.py        # 本机真实配置（不入库）
├─ build_dashboard.py     # ETL：读 12 张表 → 计算 → data/dashboard.json
├─ server.py              # HTTP 服务：静态文件 + API（含 --vj 只读模式）
├─ entries_store.py       # 手工录入的存取与校验（data/entries.json）
├─ entry_log.py           # 录入操作日志（data/entry_log.json）
├─ ops_admin.py           # 运营 token 管理（可选，--auth 时启用）
├─ sync_google.py         # 从 Google 同步 12 个文件并重建
├─ start_servers.cmd      # 启动两个服务（计划任务调用）
├─ sync_daily.cmd         # 每日同步入口（计划任务调用）
├─ start.cmd              # 手动启动（构建 + 前台起服务）
├─ web/                   # 前端（无框架：原生 JS + SVG）
│  ├─ index.html  style.css  i18n.js
│  ├─ app.js       # 路由、图表、通用组件
│  ├─ views2.js    # 团队页
│  ├─ views3.js    # 总览 / 成员榜 / 抽屉 / 口径页
│  ├─ diagnose.js  # 诊断页
│  ├─ entry.js     # 录入页
│  └─ export.js    # PNG 导出（Canvas）
├─ data/                  # 运行时数据（可备份）
│  ├─ dashboard.json      # 看板唯一数据源
│  ├─ entries.json        # 手工录入
│  ├─ entry_log.json      # 录入日志（最多 500 条）
│  ├─ operators.json      # 运营 token（--auth 用）
│  ├─ src/                # 从 Google 同步下来的原始 xlsx
│  └─ sync_log.txt        # 同步日志
├─ tests/
│  ├─ audit_data.py       # 独立对账（重算 vs JSON）
│  └─ smoke_render.js     # 无头渲染自检
└─ docs/                  # 数据口径、运维、结构与开发文档
```

## 每次改动后怎么验

```powershell
python .\tests\audit_data.py            # 期望 ERRORS 0 / WARN 0
node   .\tests\smoke_render.js .  # 期望 ALL RENDER CHECKS PASSED
```

## 自启动与定时任务

| 任务名 | 触发 | 身份 | 作用 |
|---|---|---|---|
| Dashboard-Servers | 开机（ONSTART） | SYSTEM | 起 8777 + 8778 |
| Dashboard-Sync | 每天 06:00 | SYSTEM | 同步 Google → 重建 |

```powershell
schtasks /Query /TN "Dashboard-Servers" /V /FO LIST
schtasks /Run   /TN "Dashboard-Sync"
schtasks /Delete /TN "Dashboard-Sync" /F
```

## 文档索引

| 文档 | 读者 | 内容 |
|---|---|---|
| [docs/OPS.md](docs/OPS.md) | 运营 | 怎么录数据、报错怎么办 |
| [docs/DATA.md](docs/DATA.md) | 管理层 / 财务 | 每个数字怎么来的、口径与限制 |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | 所有读者 | 每个页面有哪些区块、展示什么、VJ/手机差异 |
| [docs/DEV.md](docs/DEV.md) | 开发 / 维护 | 代码结构、加指标、部署排障 |

## 运行时依赖

Python 3.12 + `openpyxl`。不依赖任何 LLM、不依赖 DSH 运行；DSH 目录里那个 Python 只是解释器之一，脚本已做四级回退（DSH runtime → PATH → C:Python312 → 用户级）。

前端零外部依赖（无 CDN、无在线字体），断网也能打开已生成的看板。
# 开发与维护说明

## 架构

```
浏览器 (web/*.js)
   │  GET  /api/data  (dashboard.json)
   ▼
server.py  ←── data/dashboard.json  ←── build_dashboard.py
   ▲                                        ▲
   │ POST /api/entry                        │ 读 11 张记分表 + 花名册
   │      → entries_store.py                │ + entries.json 叠加
   │      → 进程内调 build_dashboard.build()│
   │                                        │
   └── data/entries.json ───────────────────┘

sync_google.py（每天 06:00，SYSTEM 计划任务）
   → 下载 Google 上的 12 个文件到 data/src/
   → 调 build_dashboard.build() 覆盖 dashboard.json
```

- 服务无状态，唯一真相是 `data/dashboard.json` 与 `data/entries.json`
- 前端零依赖、无构建步骤，改完刷新即可

## 模块职责

| 文件 | 职责 | 关键点 |
|---|---|---|
| `build_dashboard.py` | ETL + 计算 | `load_scorelists / load_roster / load_opscost / apply_entries / recompute / build` |
| `server.py` | HTTP + API | `Handler.do_GET/do_POST`，`--vj` 走 `strip_finance`，缓存按 mtime 失效 |
| `entries_store.py` | 录入存取 | `normalize` 做校验，`parse_report` 解析自由格式/CSV |
| `entry_log.py` | 操作日志 | 最多 500 条，含 IP / 操作人 |
| `ops_admin.py` | token 管理 | `add/list/revoke/link`，`--auth` 时生效 |
| `sync_google.py` | Google 同步 | 解析 Drive 文件夹页拿文件 ID，MD5 比对只写变化 |
| `web/app.js` | 路由 + 通用组件 | `route()`、`applyChrome()`、`teamCard`、`dailyChart`、`rankBars`、主题 |
| `web/views2.js` | 团队页 | `kpiStrip`、`waterfall`、`memberRow`、`renderTeam` |
| `web/views3.js` | 总览/成员榜/抽屉/口径 | `renderOverview`、`renderMembers`、`openMember` |
| `web/diagnose.js` | 诊断页 | 目标建议、覆盖表、异常清单 |
| `web/entry.js` | 录入页 | 表单、日报解析提交、日志表 |
| `web/export.js` | PNG 导出 | Canvas 2x，VJ 模式不含薪资 |
| `web/i18n.js` | 中泰词典 | `tr(key)`，缺 key 自动回落中文 |

## 数据流（一次录入）

```
POST /api/entry
  → 校验：账期 / 团队存在 / 成员在花名册 / 非负
  → entries_store.upsert → data/entries.json
  → build_dashboard.build()
       ① load_scorelists（读 xlsx，解析日期/Goals/日 KPI）
       ② apply_entries（覆盖或新增当天行，打 manual=True）
       ③ recompute(队, as_of)（汇总、覆盖率、空白日）
       ④ 成员：kpi_days / kpi_mtd / 佣金 / 推演 / 数据覆盖
       ⑤ 团队：实收 / 底薪 / 运营 / 佣金 / 净利
       ⑥ 公会：Σ
  → 写 data/dashboard.json
  → 前端 load() 重新拉 JSON 并重绘
```

## 如何加一个新指标（三步）

1. **算**：在 `build_dashboard.py` 的 team dict 或 member dict 里加字段，例如
   `conv2=(round(x / y, 2) if y else None)`
2. **显示**：`web/views2.js`（团队）或 `views3.js`（总览/成员）里取 `sc.字段名` 插进表格/卡片
3. **翻译**：在 `web/i18n.js` 加 `"中文":"ไทย"`

VJ 视图要注意：凡是财务类字段，加到 `server.py` 的 `strip_finance()` 里剔除。

## 测试

```powershell
python .\tests\audit_data.py              # 独立重算对账
node   .\tests\smoke_render.js .  # 4 视图 + 11 队页 + 103 抽屉
```

改前端后至少跑 smoke；改计算后必须跑 audit（会校验 7 条财务恒等式）。

## 部署与自启

| 组件 | 机制 |
|---|---|
| 两个服务 | 计划任务 `Dashboard-Servers`（ONSTART，SYSTEM）→ `start_servers.cmd` |
| 每日同步 | 计划任务 `Dashboard-Sync`（每天 06:00，SYSTEM）→ `sync_daily.cmd` |
| 外网 | Tailscale Funnel：`/board → 8777`、`/vj → 8778`，配置持久化在 `C:\ProgramData\Tailscale\server-state.conf` |
| Python | 四级回退：DSH runtime → PATH → C:Python312 → 用户级；找不到写 `data\boot_error.log` |

服务不依赖 DSH 运行；DSH 关掉、卸载都不影响（只要还有 Python 3.12 + openpyxl）。

## 排障

| 现象 | 查什么 |
|---|---|
| 页面打不开 | `Get-NetTCPConnection -LocalPort 8777`；没有进程就手动跑 `start_servers.cmd` |
| 数据不更新 | 看 `data\sync_log.txt` 最后几行；或手动 `python sync_google.py` |
| 数字对不上 | 跑 `tests\audit_data.py`，它用原始 Excel 重算 |
| 录入保存失败 | 看返回的错误文案；`data\entry_log.json` 里也有记录 |
| 泰文没生效 | `web/i18n.js` 里是否有该 key（缺 key 会回落中文） |
| 端口冲突/重复进程 | `Get-CimInstance Win32_Process -Filter "Name='python.exe'"` 看有没有多份 |

## 备份

要备份的只有三样：

```
dashboard/data/entries.json      # 手工录入（最重要）
dashboard/data/entry_log.json    # 操作日志
dashboard/data/dashboard.json    # 当前看板快照（可随时重建）
```

`data/src/*.xlsx` 是 Google 同步的副本，删了下次同步会重新下载。

## 代码约定

- Python：标准库 + openpyxl，不引第三方框架
- 前端：原生 JS，不用框架/不用构建；函数放全局，后加载的覆盖先加载的（views2/3 覆盖 app.js 同名函数——app.js 里已不再保留这些实现）
- 所有面向用户的中文都要走 `tr()`，并在 `i18n.js` 给泰文
- 长句一律用整句 key + `%s` 占位符，不要把句子拆成碎片翻译

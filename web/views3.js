/* v2 视图层 · 第二部分 */
"use strict";

function renderOverview() {
  var d = S.data, T = d.totals, P = d.period;
  var teams = d.teams.slice().sort(function (a, b) { return b.score.mtd_dia - a.score.mtd_dia; });
  var byProfit = d.teams.slice().sort(function (a, b) { return ((b.finance || {}).profit || 0) - ((a.finance || {}).profit || 0); });
  var maxAbs = Math.max.apply(null, byProfit.map(function (x) { return Math.abs((x.finance || {}).profit || 0); }).concat([1]));

  return '<div class="between" style="margin:6px 0 2px"><div><h1>' + tr("公会总览") + " " + "·" + " " + periodLabel() + '</h1>' +
    '<div class="sub">' + (P.as_of_min && P.as_of_max && P.as_of_min !== P.as_of_max
      ? tr("各队数据各自积累：") + P.as_of_min + "–" + P.as_of_max + " " + tr("日")
      : tr("数据截至") + " " + P.as_of + " " + tr("日")) + " / " + tr("共") + " " + P.days_total + " " + tr("天") + " · " + tr("汇率") + " 1 USD = " + d.fx.usd_thb + " THB · " + tr("平台抽成") + " " + d.fx.platform_cut * 100 + '%</div></div>' +
    '<div class="flex"><span class="chip n">' + tr("钻石") + " ÷ " + d.fx.dia_per_usd + " = USD</span>" + '<span class="chip w">' + tr("成员流水未提供") + '</span></div></div>' +
    kpiStrip(T, P) +

    '<div class="split"><div class="card"><h2>' + tr("团队流水排名") + ' <span class="hint">' + tr("金色虚线") + ' = ' + tr("月度目标进度（仅设有目标的团队）") + '</span></h2>' + rankBars(teams) + '</div>' +
    (VJ ? '<div class="card"><h2>' + tr("KPI 达标率排名") + ' <span class="hint">' + tr("团队日") + ' KPI</span></h2><div class="tbl-wrap"><table><tbody>' +
      byProfit.map(function (t) {
        var r = t.score.kpi_marked ? t.score.kpi_hit / t.score.kpi_marked * 100 : 0;
        return '<tr data-team="' + t.code + '"><td class="l"><b>' + esc(t.name) + '</b></td>' +
          '<td class="num" style="font-weight:700">' + pct(r, 0) + '</td>' +
          '<td class="num sub">' + t.score.kpi_hit + '/' + t.score.kpi_marked + '</td>' +
          '<td style="width:84px"><div class="pbar"><i style="width:' + Math.min(100, r).toFixed(1) + '%"></i></div></td></tr>';
      }).join("") + '</tbody></table></div></div>'
    : '<div class="card"><h2>' + tr("净利排名") + '* <span class="hint">THB · MTD · ' + tr("未含佣金") + '</span></h2><div class="tbl-wrap"><table><tbody>' +
    byProfit.map(function (t) {
      return '<tr data-team="' + t.code + '"><td class="l"><b>' + esc(t.name) + '</b></td>' +
        '<td class="num" style="color:' + (t.finance.profit >= 0 ? "#34c759" : "#ff3b30") + ';font-weight:700">' + (t.finance.profit < 0 ? "−" : "") + thb(Math.abs(t.finance.profit)) + '</td>' +
        '<td class="num" style="width:86px">' + pct(t.finance.margin, 0) + '</td>' +
        '<td style="width:84px"><div class="pbar"><i style="width:' + Math.min(100, Math.abs(t.finance.profit) / maxAbs * 100).toFixed(1) + '%;background:' + (t.finance.profit >= 0 ? "#34c759" : "#ff3b30") + '"></i></div></td></tr>';
    }).join("") + '</tbody></table></div></div>') + '</div>' +

    '<div class="card mt14"><h2>' + tr("团队卡片") + ' <span class="hint">' + tr("点击进入团队详情") + '</span></h2><div class="tcards">' +
    teams.map(function (t, i) { return teamCard(t, i + 1); }).join("") + '</div></div>' +

    (VJ ? "" : '<div class="card mt14"><h2>' + tr("结构对账") + ' <span class="hint">' + tr("记分表流水 / 目标 / 在职 KPI 合计") + '</span></h2><div class="tbl-wrap"><table>' +
    '<thead><tr><th class="l">' + tr("团队") + '</th><th>' + tr("记分表流水") + '</th><th>' + tr("目标") + '</th><th>' + tr("在职 KPI 合计") + '</th><th>' + tr("覆盖率") + '</th><th>' + tr("底薪") + '</th><th>' + tr("运营成本") + '</th><th>' + tr("净利") + '*</th></tr></thead><tbody>' +
    teams.map(function (t) {
      return '<tr data-team="' + t.code + '"><td class="l"><b>' + esc(t.name) + '</b></td>' +
        '<td class="num"><b>' + n(t.score.mtd_dia) + '</b></td>' +
        '<td class="num">' + (t.score.goal ? n(t.score.goal) : '<span class="sub">' + tr("未设目标") + '</span>') + '</td>' +
        '<td class="num">' + n(t.score.kpi_sum) + '</td>' +
        '<td class="num">' + (t.score.coverage == null ? '<span class="sub">—</span>' : pct(t.score.coverage, 0)) + '</td>' +
        '<td class="num">' + n(t.finance.salary) + '</td><td class="num">' + n(t.finance.ops_total) + '</td>' +
        '<td class="num" style="color:' + (t.finance.profit >= 0 ? "#34c759" : "#ff3b30") + ';font-weight:700">' + (t.finance.profit < 0 ? "−" : "") + n(Math.abs(t.finance.profit)) + '</td></tr>';
    }).join("") +
    '<tr class="total-row" style="cursor:default"><td class="l"><b>' + tr("合计") + '</b></td><td class="num"><b>' + n(T.score_dia) + '</b></td><td class="num">—</td>' +
    '<td class="num"><b>' + n(T.kpi_sum) + '</b></td><td class="num">—</td><td class="num"><b>' + n(T.salary) + '</b></td><td class="num"><b>' + n(T.ops) + '</b></td>' +
    '<td class="num"><b>' + n(T.profit) + '</b></td></tr></tbody></table></div>' +
    '<div class="note" style="margin-top:10px">* ' + tr("净利 = 实收 − 底薪 − 运营成本；佣金需成员流水，本期未提供，故未计入。") + '</div></div>') +

    '<div class="card mt14"><h2>' + tr("预警与洞察") + ' <span class="hint">' + d.alerts.length + " " + tr("条") + '</span></h2><div style="display:grid;gap:7px">' +
    (d.alerts.map(function (a) {
      return '<div class="flex" style="align-items:center;gap:9px"><span class="chip ' + (a.level === "danger" ? "b" : a.level === "warn" ? "w" : "n") + '">' +
        (a.level === "danger" ? tr("严重") : a.level === "warn" ? tr("关注") : tr("口径")) + '</span>' +
        '<span style="font-size:12.5px">' + esc(MLANG === "th" ? (a.text_th || a.text) : a.text) + '</span></div>';
    }).join("") || '<div class="empty">' + tr("暂无预警") + '</div>') + '</div></div>';
}

function renderMembers() {
  var all = S.data.members.filter(function (m) { return S.onlyActive ? m.active : true; });
  var list = all.slice().sort(function (a, b) { return (b.kpi || 0) - (a.kpi || 0); });
  return '<div class="between" style="margin:6px 0 4px"><div><h1>' + tr("成员榜") + " " + "·" + " " + tr("全公会") + '</h1>' +
    '<div class="sub">' + all.length + " " + tr("人") + " · " + tr("KPI 合计") + " " + n(list.reduce(function (a, b) { return a + (b.kpi || 0); }, 0)) + " " + tr("钻") + '</div></div>' +
    '<div class="flex"><button class="btn ' + (S.onlyActive ? "pri" : "") + '" data-toggle="active">' + (S.onlyActive ? tr("仅在职") : tr("显示全部")) + '</button>' +
    '<button class="btn" data-pngall="1">' + tr("下载全员") + ' PNG</button>' +
    '<input class="search" id="memSearch" placeholder="' + tr("搜索昵称") + ' / ' + tr("团队…") + '"></div></div>' +
    '<div class="card"><div class="tbl-wrap" style="max-height:calc(100vh - 200px)"><table class="tbl-m"><thead><tr>' +
    '<th class="l">' + tr("团队") + '</th><th class="l">' + tr("成员") + '</th><th class="l">' + tr("状态") + '</th>' +
    '<th>KPI' + tr("（月）") + '</th><th>KPI (MTD)</th>' + (VJ ? "" : '<th>' + tr("底薪") + '</th><th>' + tr("底薪（") + 'MTD）</th>') +
    '<th>' + tr("休息") + '</th><th>' + tr("出勤") + '</th><th class="l">' + tr("合同") + '</th></tr></thead><tbody>' +
    list.map(function (m) {
      return '<tr data-team="' + m.team + '" data-mem="' + esc(m.nick) + '">' +
        '<td class="l"><span class="chip n">' + esc(m.team_name) + '</span></td>' +
        '<td class="l"><b>' + esc(m.en || m.nick) + '</b><div class="sub">' + esc(m.en ? m.nick : (m.thai || "")) + '</div></td>' +
        '<td class="l"><span class="chip ' + (m.active === false ? "b" : "g") + '">' + esc(statusLabel(m.status)) + '</span></td>' +
        '<td class="num">' + (m.kpi ? n(m.kpi) : "—") + '</td>' +
        '<td class="num sub">' + (m.kpi_mtd ? n(m.kpi_mtd) : "—") + '</td>' +
        (VJ ? "" : '<td class="num">' + (m.salary ? n(m.salary) : "—") + '</td>' +
        '<td class="num">' + (m.salary_mtd ? n(m.salary_mtd) : "—") + '</td>') +
        '<td class="num">' + (m.off_count || 0) + '</td><td class="num">' + (m.present_days || 0) + '</td>' +
        '<td class="l sub">' + esc(m.contract || "—") + '</td></tr>';
    }).join("") + '</tbody></table></div></div>';
}

function openMember(teamCode, name) {
  var tm = S.data.teams.find(function (x) { return x.code === teamCode; });
  if (!tm) return;
  var m = tm.members.find(function (x) { return x.nick === name; }) ||
          tm.members.find(function (x) { return (x.nick || "").indexOf(name) === 0; });
  if (!m) return;
  var initials = (m.nick || "?").slice(0, 2);
  var offs = (m.off_days || []).map(function (d) { return "11-" + String(d).padStart(2, "0"); });

  $("#drawer").innerHTML =
    '<button class="x" onclick="closeDrawer()">×</button>' +
    '<div class="dhead"><div class="avatar">' + esc(initials) + '</div>' +
    '<div style="flex:1"><div class="t1">' + esc(m.nick) + ' <span class="sub">' + esc(m.thai || "") + '</span></div>' +
    '<div class="t2">' + esc(tm.name) + " " + "·" + " " + esc(m.contract || "—") + " " + "·" + " " + tr("入职") + " " + esc((m.start || "—").slice(0, 10)) + '</div>' +
    '<div class="flex" style="gap:6px;margin-top:6px"><span class="chip ' + (m.active === false ? "b" : "g") + '">' + esc(statusLabel(m.status)) + '</span>' +
    (m.tiktok ? '<span class="chip n mono">@' + esc(m.tiktok) + '</span>' : "") +
    (m.op ? '<span class="chip n">' + tr("主管") + " " + esc(m.op) + '</span>' : "") + '</div></div></div>' +

    '<div class="mini">' +
    '<div><div class="l">KPI' + tr("（月）") + '</div><div class="v">' + (m.kpi ? n(m.kpi) : "—") + '</div></div>' +
    '<div><div class="l">KPI (MTD · ' + (m.kpi_days || 0) + tr("天") + ')</div><div class="v">' + (m.kpi_mtd ? n(m.kpi_mtd) : "—") + '</div></div>' +
    (m.dia == null ? "" : '<div><div class="l">' + tr("个人流水") + '</div><div class="v">' + n(m.dia) + '</div></div>') +
    (m.kpi_progress == null ? "" : '<div><div class="l">' + tr("KPI 进度") + '</div><div class="v" style="color:' + (m.kpi_progress >= 100 ? "#34c759" : "#ff9500") + '">' + pct(m.kpi_progress, 1) + '</div></div>') +
    (VJ ? "" : '<div><div class="l">' + tr("底薪（") + 'MTD）</div><div class="v">' + (m.salary_mtd ? thb(m.salary_mtd) : "—") + '</div></div>' +
    '<div><div class="l">' + tr("底薪") + '</div><div class="v">' + (m.salary ? thb(m.salary) : "—") + '</div></div>') + '</div>' +

    (VJ || m.commission_projection == null || m.commission == null ? "" : '<div class="mini" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      '<div><div class="l">' + tr("当前佣金（MTD）") + '</div><div class="v">' + thb(m.commission) + '</div></div>' +
      '<div><div class="l">' + tr("按日均推演月末") + '</div><div class="v" style="color:#0071e3">' + thb(m.commission_projection) + '</div></div></div>') +
    '<div class="mini">' +
    (m.data_ratio == null ? "" : '<div><div class="l">' + tr("数据") + '</div><div class="v" style="color:' + (m.data_ratio >= 95 ? "#34c759" : m.data_ratio >= 70 ? "#ff9500" : "#ff3b30") + '">' + (m.entry_days || 0) + '<span class="sub">/' + (m.need_days || 0) + '</span></div></div>') +
    '<div><div class="l">' + tr("出勤") + '</div><div class="v">' + (m.present_days || 0) + '</div></div>' +
    '<div><div class="l">' + tr("休息") + '</div><div class="v">' + (m.off_count || 0) + '</div></div>' +
    '<div><div class="l">' + tr("合同") + '</div><div class="v" style="font-size:13px">' + esc(m.contract || "—") + '</div></div>' +
    '<div><div class="l">' + tr("入职") + '</div><div class="v" style="font-size:13px">' + esc((m.start || "—").slice(0, 10)) + '</div></div></div>' +

    '<div class="card" style="margin-top:14px"><h2>' + tr("休息 / 缺席 / 培训") + ' <span class="hint">' + tr("来自记分表 Day off 列") + '</span></h2>' +
    (function () {
      var T = { off: ["休息", "w"], leave: ["请假", "w"], sick: ["病假", "b"], personal: ["事假", "n"], absent: ["缺席", "b"], training: ["培训", "g"] };
      var by = m.off_by_type || {};
      var keys = Object.keys(by).filter(function (k) { return by[k] && by[k].length; });
      if (!offs.length) return '<div class="empty">' + tr("本月无休息记录") + '</div>';
      return '<div class="flex" style="gap:12px;flex-wrap:wrap;margin-bottom:10px">' +
        keys.map(function (k) {
          var t = T[k] || ["—", "n"];
          return '<span class="sub">' + tr(t[0]) + ' <b>' + by[k].length + '</b></span>';
        }).join("") + '</div>' +
        keys.map(function (k) {
          var t = T[k] || ["—", "n"];
          return '<div style="margin-bottom:8px"><div class="sub" style="margin-bottom:4px">' + tr(t[0]) + '</div>' +
            '<div class="flex" style="gap:6px;flex-wrap:wrap">' +
            by[k].map(function (d) { return '<span class="chip ' + t[1] + '">11-' + String(d).padStart(2, "0") + '</span>'; }).join("") +
            '</div></div>';
        }).join("");
    })() +
    (m.status && /Train/i.test(m.status) ? '<div class="note">' + tr("当前状态为培训中") + '</div>' : '') +
    '<div class="note" style="margin-top:8px">' + tr("记分表只记录「谁休息」。如需区分病假/事假/缺席，请在单元格写成 名字(ลาป่วย) / 名字(sick) / 名字(absent)。") + '</div></div>' +

    '<div class="note mt14">' + tr("KPI / 底薪 / 合同 / 状态来自花名册；出勤来自记分表。") +
    '<br><span style="color:#ff9500">' + tr("成员级实际流水未提供，因此无法计算 KPI 达成率、佣金与人效。") + '</span></div>' +
    '<div class="flex" style="gap:8px;margin-top:16px">' +
    '<button class="btn pri" data-png="1">' + tr("下载成绩单") + ' PNG</button>' +
    '<a class="btn" href="#/team/' + tm.code + '">' + tr("查看团队") + '</a></div>';

  S.curTeam = tm; S.curMember = m;
  $("#drawer").classList.add("on"); $("#mask").classList.add("on");
}

function renderReconcile() {
  var d = S.data;
  return '<h1 style="margin:6px 0 4px">' + tr("口径对账与数据说明") + '</h1>' +
    '<div class="sub" style="margin-bottom:14px">' + tr("本期只看 12 张权威表：11 张记分表 + 花名册。运营 gsheet 与 TikTok 后台导出已全部移出。") + '</div>' +
    '<div class="card"><h2>' + tr("权威口径") + '</h2><div class="note">' +
    '<b>1. ' + tr("团队流水") + '</b>：' + tr("11 张记分表的 Diamond 列逐日相加（= 团队官方号流水）") + '<br>' +
    '<b>2. ' + tr("成员 KPI / 底薪 / 合同 / 状态") + '</b>：' + tr("VJ Onboarding Record.xlsx → VJ Roster") + '<br>' +
    '<b>3. ' + tr("成员出勤") + '</b>：' + tr("记分表 Day off 列的人名，按天累计") + '<br>' +
    '<b>4. ' + tr("实收") + '</b> = ' + tr("流水") + ' × 65%（' + tr("平台抽成") + ' 35%）<br>' +
    '<b>5. ' + tr("团队净利") + '</b> = ' + tr("实收") + ' − ' + tr("底薪") + ' − ' + tr("运营成本") + '（' + tr("未含佣金") + '，' + tr("因为佣金需要成员流水") + '）<br>' +
    '<b>6. ' + tr("运营成本") + '</b>：' + tr("Employee Database (VJ) 分表（辅助，仅用于净利）") +
    '</div></div>' +
    '<div class="split mt14"><div class="card"><h2>' + tr("已知口径缺口") + '</h2><div class="note">' +
    '· ' + tr("成员级实际流水未提供 → 佣金、人效、净贡献、KPI 达成率都算不了") + '<br>' +
    '· ' + tr("记分表有空白日（如 11-14 PK 日），会低估当天流水") + '<br>' +
    '· ' + tr("记分表 Day off 列是人工填的名字，部分对不上花名册") + '<br>' +
    '· ' + tr("部分团队无运营成本分表 → 净利偏高") + '<br>' +
    '· ' + tr("5 个团队未写 GOAL → 目标进度无法计算，诊断页给建议值") +
    '</div></div><div class="card"><h2>' + tr("数据源") + '</h2><div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("口径") + '</th><th class="l">' + tr("文件") + '</th><th class="l">' + tr("用途") + '</th></tr></thead><tbody>' +
    d.sources.map(function (s) {
      var seg = String(s.path).split(/[\\\/]/).filter(Boolean);
      return '<tr style="cursor:default"><td class="l" style="width:56px"><span class="chip ' + (s.auth ? "g" : "n") + '">' + esc(tr(s.tier || "")) + '</span></td>' +
        '<td class="l" style="max-width:236px"><div class="mono" title="' + esc(s.path) + '" style="white-space:normal;word-break:break-all;font-size:10.5px">' + esc(seg.slice(-2).join("\\")) + '</div></td>' +
        '<td class="l" style="font-size:11.5px;white-space:normal">' + esc(MLANG === "th" ? (s.kind_th || s.kind) : s.kind) + '</td></tr>';
    }).join("") + '</tbody></table></div></div></div>';
}

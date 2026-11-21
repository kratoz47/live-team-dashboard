/* v2 视图层：只用 12 张权威表（无成员流水） */
"use strict";

function kpiStrip(T, P) {
  var box = function (cls, label, val, sub) {
    return '<div class="kpi ' + cls + '"><div class="lbl">' + label + '</div><div class="val">' + val + '</div><div class="dlt">' + sub + '</div></div>';
  };
  if (VJ) {
    return '<div class="kpis">' +
      box("t primary", tr("记分表流水"), short(T.score_dia) + "<small>" + tr("钻") + "</small>", tr("截至") + " " + P.as_of + " " + tr("日") + " · " + n(T.score_dia)) +
      box("primary", tr("团队") + " / " + tr("成员"), S.data.teams.length + "<small>" + tr("队") + "</small> " + T.active_members + "<small>" + tr("人") + "</small>", tr("花名册") + " " + T.members + " " + tr("人")) +
      box("primary g", tr("团队日") + " KPI " + tr("达标"), pct(T.kpi_hit_days / Math.max(T.kpi_marked_days, 1) * 100, 0), T.kpi_hit_days + " / " + T.kpi_marked_days + " " + tr("个达标日")) +
      box("", tr("观看总量"), short(T.view), "PCU / ACU / " + tr("涨粉") + " " + tr("见各团队")) +
      box("", tr("成员 KPI 合计"), short(T.kpi_sum) + "<small>" + tr("钻") + "</small>", tr("在职成员 KPI 目标之和")) +
      box("", tr("本月已录入"), (S.data.entries && S.data.entries.days ? S.data.entries.days.length : 0) + "<small>" + tr("天") + "</small>", "") +
      '</div>';
  }
  return '<div class="kpis">' +
    box("t primary", tr("记分表流水"), short(T.score_dia) + "<small>" + tr("钻") + "</small>", tr("截至") + " " + P.as_of + " " + tr("日") + " · " + n(T.score_dia)) +
    box("primary", tr("实收（抽成后）"), short(T.net_thb) + "<small>THB</small>", tr("平台抽成") + " " + thb(T.cut_thb)) +
    box("primary " + (T.profit >= 0 ? "g" : "b"), tr("净利") + "*", (T.profit < 0 ? "−" : "") + short(Math.abs(T.profit)) + "<small>THB</small>", tr("利润率") + " " + pct(T.margin) + " · " + tr("未含佣金")) +
    box("w", tr("底薪") + " + " + tr("运营"), short(T.salary + T.ops) + "<small>THB</small>", tr("底薪") + " " + short(T.salary) + " · " + tr("运营") + " " + short(T.ops)) +
    box("", tr("团队") + " / " + tr("成员"), S.data.teams.length + "<small>" + tr("队") + "</small> " + T.active_members + "<small>" + tr("人") + "</small>", tr("花名册") + " " + T.members + " " + tr("人")) +
    box("g", tr("团队日") + " KPI " + tr("达标"), pct(T.kpi_hit_days / Math.max(T.kpi_marked_days, 1) * 100, 0), T.kpi_hit_days + " / " + T.kpi_marked_days + " " + tr("个达标日")) +
    '</div>';
}

function waterfall(f) {
  var items = [
    { k: tr("实收") + " (" + tr("流水") + "×65%)", v: f.net_thb, c: "#0071e3" },
    { k: tr("主播底薪"), v: -f.salary, c: "#ff3b30" },
    (f.commission ? { k: tr("主播佣金"), v: -f.commission, c: "#ff9500" } : null),
    { k: tr("运营成本"), v: -f.ops_total, c: "#af52de" },
    { k: tr("团队净利") + "*", v: f.profit, c: f.profit >= 0 ? "#34c759" : "#ff3b30" }
  ];
  items = items.filter(function (x) { return x; });
  var base = Math.max(Math.abs(f.net_thb), 1);
  return '<table><tbody>' + items.map(function (it) {
    return '<tr style="cursor:default"><td class="l" style="width:44%">' + it.k + '</td>' +
      '<td class="num" style="color:' + (it.v < 0 ? "#ff3b30" : it.c) + ';font-weight:700">' + (it.v < 0 ? "−" : "") + thb(Math.abs(it.v)) + '</td>' +
      '<td style="width:36%"><div class="pbar"><i style="width:' + Math.min(100, Math.abs(it.v) / base * 100).toFixed(1) + '%;background:' + it.c + '"></i></div></td></tr>';
  }).join("") + '</tbody></table>';
}

function memberRow(m, asOf) {
  var st = m.active === false ? "b" : "g";
  return '<tr data-mem="' + esc(m.nick) + '" data-team="' + (m.team || "") + '">' +
    '<td class="l"><b>' + esc(m.en || m.nick) + '</b><div class="sub">' + esc(m.en ? m.nick : (m.thai || "")) + '</div></td>' +
    '<td class="l"><span class="chip ' + st + '">' + esc(statusLabel(m.status)) + '</span></td>' +
    '<td class="num">' + (m.kpi ? n(m.kpi) : '<span class="sub">—</span>') + '</td>' +
    '<td class="num sub">' + (m.kpi_mtd ? n(m.kpi_mtd) : '<span class="sub">—</span>') + '</td>' +
    (VJ ? "" : '<td class="num">' + (m.salary ? n(m.salary) : '<span class="sub">—</span>') + '</td>' +
    '<td class="num">' + (m.salary_mtd ? n(m.salary_mtd) : '<span class="sub">—</span>') + '</td>') +
    '<td class="num">' + (m.data_ratio == null ? '<span class="sub" title="' + tr("本月还没有该成员的逐日流水") + '">' + tr("未录入") + '</span>'
      : '<span style="color:' + (m.data_ratio >= 95 ? "#34c759" : m.data_ratio >= 70 ? "#ff9500" : "#ff3b30") + ';font-weight:600">' + (m.entry_days || 0) + '</span><span class="sub">/' + (m.need_days || 0) + '</span>') + '</td>' +
    '<td class="num" title="' + esc((m.off_days || []).map(function (d) { return "11-" + String(d).padStart(2, "0"); }).join("、")) + '">' + (m.off_count || 0) + '</td>' +
    '<td class="num">' + (m.present_days || 0) + '</td>' +
    '<td class="l sub">' + esc(m.contract || "—") + '</td>' +
    '<td class="l sub">' + esc((m.start || "—").slice(0, 10)) + '</td></tr>';
}

function memberCard(m, asOf) {
  return '<div class="mcard" data-mem="' + esc(m.nick) + '" data-team="' + (m.team || "") + '">' +
    '<div class="mc-top"><span class="mc-ava">' + esc((m.nick || "?").slice(0, 2)) + '</span>' +
    '<div><div class="mc-nm">' + esc(m.nick) + '</div><div class="sub">' + esc(m.thai || "") + '</div></div>' +
    '<span class="chip ' + (m.active === false ? "b" : "g") + '" style="margin-left:auto">' + esc(statusLabel(m.status)) + '</span></div>' +
    '<div class="mini" style="grid-template-columns:repeat(2,1fr);margin:12px 0 8px">' +
    '<div><div class="l">KPI' + tr("（月）") + '</div><div class="v">' + (m.kpi ? n(m.kpi) : "—") + '</div></div>' +
    '<div><div class="l">' + tr("底薪") + '</div><div class="v">' + (m.salary ? thb(m.salary) : "—") + '</div></div>' +
    '<div><div class="l">' + tr("底薪（") + 'MTD）</div><div class="v">' + (m.salary_mtd ? thb(m.salary_mtd) : "—") + '</div></div>' +
    '<div><div class="l">' + tr("出勤") + '</div><div class="v">' + (m.present_days || 0) + " / " + ((m.present_days || 0) + (m.off_count || 0)) + '</div></div></div>' +
    '<div class="mc-foot"><span class="chip n">' + esc(m.contract || "—") + '</span>' +
    '<span class="chip n">' + tr("入职") + " " + esc((m.start || "—").slice(0, 10)) + '</span>' +
    (m.off_count ? '<span class="chip w">' + tr("休息") + " " + m.off_count + '</span>' : '') + '</div></div>';
}

function renderTeam(code) {
  var tm = S.data.teams.find(function (x) { return x.code === code; });
  if (!tm) return '<div class="empty">' + tr("团队不存在：") + esc(code) + '</div>';
  var f = tm.finance, sc = tm.score;
  var prog = sc.goal ? sc.mtd_dia / sc.goal * 100 : null;
  var active = tm.members.filter(function (m) { return m.active; });
  var mem = (S.memberView === "card" ? active : tm.members.filter(function (m) { return S.onlyActive ? m.active : true; }));
  var hitRate = sc.kpi_marked ? sc.kpi_hit / sc.kpi_marked * 100 : null;

  return '<div class="flex" style="align-items:center;gap:14px;margin:6px 0 4px">' +
    '<a href="#/" class="btn">← ' + tr("返回总览") + '</a>' +
    '<div><h1>' + esc(tm.name) + ' <span class="sub" style="font-weight:600">MC ' + esc(tm.mc) + '</span></h1>' +
    '<div class="sub">' + tm.members.length + " " + tr("名成员（在职") + " " + active.length + '） · ' + tr("数据截至") + " " + tm.as_of_day + " " + tr("日") +
    ' <span class="chip ' + ((sc.coverage_ratio || 0) >= 95 ? "g" : (sc.coverage_ratio || 0) >= 80 ? "w" : "b") + '" style="padding:1px 7px">' +
    tr("已积累") + " " + (sc.data_days || 0) + "/" + tm.as_of_day + " " + tr("天") + " · " + pct(sc.coverage_ratio, 0) + (sc.blank_days ? " · " + tr("空白") + " " + sc.blank_days : "") + '</span>' +
    (tm.own_last_day && tm.own_last_day < tm.as_of_day ? " " + "·" + ' <span style="color:#ff9500">' + tr("本队记分表只到") + " " + tm.own_last_day + " " + tr("日") + '</span>' : '') + '</div></div>' +
    (VJ ? "" : '<div style="margin-left:auto" class="flex"><span class="chip ' + (f.profit >= 0 ? "g" : "b") + '">' + tr("净利") + "* " + (f.profit < 0 ? "−" : "") + thb(Math.abs(f.profit)) + '</span>' +
    '<span class="chip ' + (f.margin >= 25 ? "g" : f.margin >= 0 ? "n" : "b") + '">' + tr("边际") + " " + pct(f.margin, 0) + '</span>' +
    '<span class="chip n">ROI ' + f.roi + 'x</span></div>') + '</div>' +

    '<div class="card"><div class="flex" style="align-items:center;gap:26px">' +
    ring(prog, sc.goal ? tr("月度目标进度") : tr("未设目标"), sc.goal ? pct(prog, 0) : "—") +
    '<div style="flex:1;min-width:260px"><div class="mini" style="grid-template-columns:repeat(6,minmax(0,1fr));margin:0">' +
    '<div><div class="l">' + tr("记分表流水") + '</div><div class="v">' + short(sc.mtd_dia) + '</div></div>' +
    '<div><div class="l">' + tr("目标") + '</div><div class="v">' + (sc.goal ? short(sc.goal) : '— <span class="chip w" style="padding:1px 6px">' + tr("建议") + " " + short(sc.goal_suggest) + '</span>') + '</div></div>' +
    '<div><div class="l">' + (sc.goal && sc.mtd_dia >= sc.goal ? tr("超额") : tr("缺口")) + '</div><div class="v">' + (sc.goal ? short(Math.abs(sc.goal - sc.mtd_dia)) : "—") + '</div></div>' +
    '<div><div class="l">' + tr("日均流水") + '</div><div class="v">' + short(sc.mtd_dia / Math.max(sc.days || 1, 1)) + '</div></div>' +
    '<div><div class="l">' + tr("人均产出") + '</div><div class="v">' + short(sc.mtd_dia / Math.max(active.length, 1)) + '</div></div>' +
    '<div><div class="l">' + tr("观看转化率") + '</div><div class="v" style="color:#0071e3">' + (sc.rate_gift == null ? "—" : sc.rate_gift + "%") + '</div></div>' +
    '<div><div class="l">' + tr("观看总量") + '</div><div class="v">' + short(sc.view) + '</div></div>' +
    '<div><div class="l">PCU ' + tr("均值") + '</div><div class="v">' + n(sc.pcu_avg) + '</div></div>' +
    '<div><div class="l">ACU ' + tr("均值") + '</div><div class="v">' + n(sc.acu_avg) + '</div></div>' +
    '<div><div class="l">' + tr("涨粉") + '</div><div class="v">' + short(sc.fans) + '</div></div>' +
    '<div><div class="l">' + tr("礼物人数均值") + '</div><div class="v">' + n(sc.gifters_avg) + '</div></div>' +
    '<div><div class="l">' + tr("人均观看收益") + '</div><div class="v">' + (sc.view_conv == null ? "—" : sc.view_conv) + '</div></div></div></div></div></div>' +

    '<div class="card mt14"><h2>' + tr("逐日战绩") + ' <span class="hint">' + sc.days + " " + tr("个营业日") + " · " + tr("达标") + " " + sc.kpi_hit + '/' + sc.kpi_marked + " " + tr("天") +
    (sc.off_days.length ? " · " + tr("休息") + " " + sc.off_days.length + " " + tr("天") : '') + '</span></h2>' + dailyChart(tm) +
    '<details style="margin-top:12px"><summary>' + tr("展开逐日明细表（钻石") + ' / ' + tr("日") + 'KPI / ' + tr("观看") + ' / PCU / ACU / ' + tr("涨粉") + ' / ' + tr("礼物人数") + ' / ' + tr("休息备注）") + '</summary>' +
    '<div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th class="l">' + tr("日期") + '</th><th>' + tr("钻石") + '</th><th class="c">' + tr("日") + 'KPI</th><th>' + tr("观看") + '</th><th>PCU</th><th>ACU</th><th>' + tr("涨粉") + '</th><th>' + tr("礼物人数") + '</th><th class="l">' + tr("备注") + '</th></tr></thead><tbody>' +
    (sc.daily || []).filter(function (d) { return d.d && d.d <= (tm.as_of_day || 31); }).map(function (d) {
      return '<tr style="cursor:default"><td class="l">11-' + String(d.d).padStart(2, "0") + '</td>' +
        '<td class="num">' + (d.off ? "—" : (d.missing ? '<span class="chip b">' + tr("空白") + '</span>' : n(d.dia))) + '</td>' +
        '<td class="c">' + (d.kpi === true ? '<span class="chip g">' + tr("达标") + '</span>' : d.kpi === false ? '<span class="chip b">' + tr("未达标") + '</span>' : '<span class="sub">—</span>') + '</td>' +
        '<td class="num">' + n(d.view) + '</td><td class="num">' + n(d.pcu) + '</td><td class="num">' + n(d.acu) + '</td>' +
        '<td class="num">' + n(d.fans) + '</td><td class="num">' + n(d.gifters) + '</td>' +
        '<td class="l sub">' + (d.off ? "DAY OFF" : esc(d.off_note || "")) + '</td></tr>';
    }).join("") + '</tbody></table></div></details></div>' +

    (VJ ? "" : '<div class="split mt14"><div class="card"><h2>' + tr("财务拆解") + ' <span class="hint">MTD · THB</span></h2>' + waterfall(f) +
    '<div class="note mt14"><b>' + tr("流水") + '</b> ' + n(f.gross_dia) + " " + tr("钻") + " → " + thb(f.gross_thb) + "；" + tr("平台抽成") + " " + thb(f.cut_thb) + " → <b>" + tr("实收") + "</b> " + thb(f.net_thb) + "<br>" +
    tr("底薪按入职日折算；运营成本来自成本分表（辅助）；") +
    (f.commission == null
      ? '<span style="color:#ff9500">' + tr("佣金需成员流水，本期未提供 → 净利未含佣金") + '</span>'
      : '<span style="color:#ff9500">' + tr("佣金按已录入天数的成员流水计算（含 ") + thb(f.commission) + tr("）") + '</span>') +
    (f.ops_available ? '' : '<br><span style="color:#ff9500">' + tr("该队无运营成本分表，净利偏高") + '</span>') +
    (sc.entry_mismatch ? '<br><span style="color:#ff9500">' + tr("录入的团队总额与成员合计差") + ' ' + n(sc.entry_mismatch) + ' ' + tr("钻") + '</span>' : '') +
    ((sc.entry_beyond && sc.entry_beyond.length) ? '<br><span style="color:#0071e3">' + tr("含手工录入 %s 天（%s），记分表截止 %s 日").replace("%s", sc.entry_beyond.length).replace("%s", sc.entry_beyond.map(function (d) { return "11-" + String(d).padStart(2, "0"); }).join("、")).replace("%s", tm.own_last_day) + '</span>' : '') +
    (f.commission_partial ? '<br><span style="color:#ff9500">' + tr("佣金只按已录入天数的成员流水计算，非全月") + '</span>' : '') +
    (f.commission_projection ? '<br><span style="color:#0071e3">' + tr("按日均推演月末佣金") + ' ' + thb(f.commission_projection) + '</span>' : '') + '</div></div>' +

    '<div class="card"><h2>' + tr("运营岗成本") + ' <span class="hint"><span class="chip n">' + tr("辅助") + '</span> ' + esc(f.ops_sheet || "") + '</span></h2>' +
    (tm.ops_staff && tm.ops_staff.length
      ? '<div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("姓名") + '</th><th class="l">' + tr("岗位") + '</th><th>' + tr("月薪") + '</th></tr></thead><tbody>' +
        tm.ops_staff.map(function (o) {
          return '<tr style="cursor:default"><td class="l"><b>' + esc(o.en || o.nick || o.name) + '</b>' +
            (o.nick && o.nick !== (o.en || o.name) ? '<div class="sub">' + esc(o.nick) + '</div>' : '') + '</td><td class="l sub">' + esc(o.role || "—") + '</td>' +
            '<td class="num">' + (o.kind === "commission" ? thb(o.amount) + ' <span class="sub">(' + (o.rate * 100) + '% × ' + n(o.base) + ')</span>' : thb(o.salary)) +
            (o.kind === "deduct" ? '<div class="sub" style="font-size:10px">' + tr("扣底薪") + " " + n(o.deducted || 0) + (o.kept ? " · " + tr("保留") + " " + n(o.kept) : "") + '</div>' : '') + '</td></tr>';
        }).join("") + '</tbody></table></div>'
      : '<div class="empty">' + tr("该队无运营成本分表") + '</div>') + '</div></div>') +

    ((sc.entry_gap && sc.entry_gap.length) ? '<div class="card mt14"><h2>' + tr("录入差额来源") + ' <span class="hint">' + tr("团队总额 − 成员合计") + '</span></h2>' +
      '<div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("日期") + '</th><th>' + tr("团队总额") + '</th><th>' + tr("成员合计") + '</th><th>' + tr("差额") + '</th><th class="l">' + tr("未列出的在职成员") + '</th></tr></thead><tbody>' +
      sc.entry_gap.map(function (g) {
        return '<tr style="cursor:default"><td class="l">11-' + String(g.d).padStart(2, "0") + '</td>' +
          '<td class="num">' + n(g.team_dia) + '</td><td class="num">' + n(g.member_sum) + '</td>' +
          '<td class="num" style="font-weight:600;color:' + (g.gap > 0 ? "#ff9500" : "#ff3b30") + '">' + (g.gap > 0 ? "+" : "") + n(g.gap) + '</td>' +
          '<td class="l sub" style="white-space:normal">' + (g.missing && g.missing.length ? esc(g.missing.slice(0, 8).join("、")) + (g.missing.length > 8 ? " …" : "") : "—") + '</td></tr>';
      }).join("") + '</tbody></table></div>' +
      '<div class="note" style="margin-top:8px">' + tr("差额通常是：未列出的人、代播、团队号自身收入。补录这些人即可归零。") + '</div></div>' : "") +

    '<div class="card mt14"><h2>' + tr("成员成绩与") + ' KPI <span class="hint">' + tr("点击任意成员查看详情") + '</span></h2>' +
    '<div class="between" style="margin-bottom:10px"><div class="flex" style="gap:8px">' +
    '<button class="btn ' + (S.onlyActive ? "pri" : "") + '" data-toggle="active">' + (S.onlyActive ? tr("仅在职") : tr("显示全部")) + '</button>' +
    '<button class="btn ' + (S.memberView !== "card" ? "pri" : "") + '" data-view="table">' + tr("表格视图") + '</button>' +
    '<button class="btn ' + (S.memberView === "card" ? "pri" : "") + '" data-view="card">' + tr("卡片视图") + '</button>' +
    '<input class="search" id="memSearch" placeholder="' + tr("搜索昵称…") + '"></div>' +
    '<div class="sub">' + (VJ ? tr("KPI 来自花名册；出勤来自记分表 Day off 列") : tr("KPI 与底薪来自花名册；出勤来自记分表 Day off 列")) + '</div></div>' +
    (S.memberView === "card"
      ? '<div class="mcards">' + (mem.map(function (m) { return memberCard(m, tm.as_of_day); }).join("") || '<div class="empty">' + tr("无成员") + '</div>') + '</div>'
      : '<div class="tbl-wrap"><table class="tbl-m"><thead><tr>' +
        '<th class="l">' + tr("成员") + '</th><th class="l">' + tr("状态") + '</th><th>KPI' + tr("（月）") + '</th><th>KPI (MTD)</th>' +
        (VJ ? "" : '<th>' + tr("底薪") + '</th><th>' + tr("底薪（") + 'MTD）</th>') + '<th title="' + tr("已录入天数 / 应录天数") + '">' + tr("数据") + '</th><th>' + tr("休息") + '</th><th>' + tr("出勤") + '</th>' +
        '<th class="l">' + tr("合同") + '</th><th class="l">' + tr("入职") + '</th></tr></thead><tbody>' +
        (mem.map(function (m) { return memberRow(m, tm.as_of_day); }).join("") || '<tr><td colspan="10" class="empty">' + tr("无成员") + '</td></tr>') +
        '</tbody></table></div>') + '</div>';
}

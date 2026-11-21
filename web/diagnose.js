/* 诊断页 v2 */
"use strict";

function _card(t, h, b) { return '<div class="card"><h2>' + t + (h ? ' <span class="hint">' + h + '</span>' : "") + '</h2>' + b + '</div>'; }
function _empty(m) { return '<div class="empty">' + m + '</div>'; }

function _advice(g) {
  var kpi = g.kpi_sum || 0;
  if (g.kind === "no_goal") {
    return tr("未设置目标 → 建议 GOAL %s 钻（= 在职 %s 人 KPI 合计）")
      .replace("%s", n(g.suggest)).replace("%s", g.active);
  }
  if (g.kind === "gap") {
    return tr("目标为成员 KPI 合计的 %s 倍，全员需平均达成 %s%。建议：KPI 平均上调 %s%，或下调目标至 %s，或增编 %s 人")
      .replace("%s", g.need_mult)
      .replace("%s", Math.round(g.need_mult * 100))
      .replace("%s", Math.round((g.need_mult - 1) * 100))
      .replace("%s", n(Math.round(kpi * 1.15, -4)))
      .replace("%s", g.need_head || 0);
  }
  if (g.kind === "loose") {
    return tr("KPI 合计已超目标 %s%，目标偏松，可上调").replace("%s", pct((1 - g.need_mult) * 100, 0));
  }
  return tr("目标与编制匹配（覆盖率 %s）").replace("%s", pct(g.coverage, 0));
}

function renderDiagnose() {
  var d = S.data, g = d.diag || {}, C = g.counts || {};
  var goals = g.goals || [], salary = g.salary || [], missing = g.missing || [], off = g.unmatched_off || [];

  var strip = '<div class="kpis" style="margin-top:16px;grid-template-columns:repeat(5,1fr)">' +
    [["目标缺口", C.gap, "w"], ["未设目标", C.no_goal, "w"], ["钻石空白日", C.blank_days, "b"],
     ["底薪异常", C.salary, "b"], ["缺数据", C.missing, "w"]].map(function (x) {
      return '<div class="kpi ' + x[2] + '"><div class="lbl">' + tr(x[0]) + '</div><div class="val">' + x[1] + '</div></div>';
    }).join("") + '</div>';

  var goalRows = goals.map(function (x) {
    var badge = x.kind === "no_goal" ? '<span class="chip w">' + tr("未设目标") + '</span>'
      : x.kind === "gap" ? '<span class="chip b">' + tr("目标过高") + '</span>'
      : x.kind === "loose" ? '<span class="chip w">' + tr("目标偏松") + '</span>'
      : '<span class="chip g">' + tr("匹配") + '</span>';
    return '<tr data-team="' + x.team + '"><td class="l"><b>' + esc(x.team_name) + '</b></td>' +
      '<td class="num">' + (x.goal ? n(x.goal) : "—") + '</td><td class="num">' + n(x.kpi_sum) + '</td>' +
      '<td class="num">' + (x.coverage == null ? "—" : pct(x.coverage, 0)) + '</td>' +
      '<td class="num">' + (x.need_mult == null ? "—" : x.need_mult + "x") + '</td>' +
      '<td class="c">' + badge + '</td><td class="l sub" style="white-space:normal;max-width:480px">' + _advice(x) + '</td></tr>';
  }).join("");

  var missRows = missing.map(function (x) {
    var k = x.kind === "ops_sheet" ? tr("运营成本表") : x.kind === "metrics" ? tr("记分表列") : x.kind === "blank" ? tr("钻石空白") : tr("数据日期");
    return '<tr data-team="' + x.team + '"><td class="l"><span class="chip n">' + esc(x.team_name) + '</span></td>' +
      '<td class="l">' + k + '</td><td class="l sub" style="white-space:normal">' + esc(x.detail) + '</td></tr>';
  }).join("");

  var salRows = salary.map(function (x) {
    return '<tr><td class="l"><span class="chip n">' + esc(x.team_name) + '</span></td><td class="l"><b>' + esc(x.name) + '</b></td>' +
      '<td class="num">' + n(x.salary) + '</td><td class="num">' + n(x.kpi) + '</td>' +
      '<td class="l mono" style="font-size:11px">' + esc(x.file) + ' → ' + esc(x.cell) + '</td></tr>';
  }).join("");

  var offRows = off.map(function (x) {
    return '<tr data-team="' + x.team + '"><td class="l"><span class="chip n">' + esc(x.team_name) + '</span></td>' +
      '<td class="l"><b class="mono">' + esc(x.name) + '</b></td><td class="num">' + x.count + '</td>' +
      '<td class="l sub">' + tr("Day off 里出现，但花名册找不到对应成员") + '</td></tr>';
  }).join("");

  return '<div class="between" style="margin:6px 0 2px"><div><h1>' + tr("数据诊断") + '</h1>' +
    '<div class="sub">' + tr("口径：11 张记分表 + 花名册；运营 gsheet 已移出") + '</div></div>' +
    '<a class="btn" href="#/reconcile">' + tr("口径说明") + ' →</a></div>' + strip +

    _card(tr("目标与 KPI 建议"), tr("覆盖率 = 在职 KPI 合计 ÷ 团队目标"), '<div class="tbl-wrap"><table><thead><tr>' +
      '<th class="l">' + tr("团队") + '</th><th>' + tr("目标") + '</th><th>' + tr("在职 KPI 合计") + '</th><th>' + tr("覆盖率") + '</th>' +
      '<th>' + tr("全员需达成") + '</th><th class="c">' + tr("判定") + '</th><th class="l">' + tr("建议") + '</th></tr></thead><tbody>' + goalRows + '</tbody></table></div>') +

    '<div class="split mt14">' +
    (function () {
      var all = d.members || [];
      var withData = all.filter(function (m) { return m.data_ratio != null; });
      var rows = all.filter(function (m) { return m.active; }).map(function (m) {
        return { m: m, r: m.data_ratio };
      }).sort(function (a, b) { return (a.r == null ? 999 : a.r) - (b.r == null ? 999 : b.r); });
      var head = tr("成员数据") + ' ' + withData.length + " / " + all.length + " " + tr("人");
      var body;
      if (!withData.length) {
        body = '<div class="note">' + tr("本月还没有任何成员的逐日流水。到「录入」页粘贴日报（Group / Total / 每人一行），成员个人数据才会开始累积。") + '</div>';
      } else {
        body = '<div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("团队") + '</th><th class="l">' + tr("成员") + '</th><th>' + tr("数据") + '</th><th class="l">' + tr("说明") + '</th></tr></thead><tbody>' +
          rows.slice(0, 40).map(function (x) {
            var m = x.m;
            return '<tr data-team="' + m.team + '"><td class="l"><span class="chip n">' + esc(m.team_name) + '</span></td>' +
              '<td class="l"><b>' + esc(m.en || m.nick) + '</b></td>' +
              '<td class="num">' + (m.data_ratio == null ? '<span class="sub">' + tr("未录入") + '</span>' : (m.entry_days || 0) + '/' + (m.need_days || 0)) + '</td>' +
              '<td class="l sub">' + (m.data_ratio == null ? tr("没有任何逐日数据") : (m.data_ratio < 100 ? tr("缺少") + " " + Math.max(0, (m.need_days || 0) - (m.entry_days || 0)) + " " + tr("天") : tr("完整"))) + '</td></tr>';
          }).join("") + '</tbody></table></div>';
      }
      return _card(tr("成员数据覆盖"), head, body);
    })() +

    _card(tr("数据覆盖"), tr("各队已积累天数 / 有数据天数"), '<div class="tbl-wrap"><table><thead><tr>' +
      '<th class="l">' + tr("团队") + '</th><th>' + tr("截止日") + '</th><th>' + tr("有数据") + '</th><th>' + tr("空白") + '</th><th>' + tr("覆盖率") + '</th></tr></thead><tbody>' +
      d.teams.map(function (t) {
        var c = t.score.coverage_ratio || 0;
        return '<tr data-team="' + t.code + '"><td class="l"><b>' + esc(t.name) + '</b></td>' +
          '<td class="num">' + t.as_of_day + '</td><td class="num">' + (t.score.data_days || 0) + '</td>' +
          '<td class="num" style="color:' + ((t.score.blank_days || 0) ? "#ff3b30" : "#86868b") + '">' + (t.score.blank_days || 0) + '</td>' +
          '<td class="num" style="font-weight:600;color:' + (c >= 95 ? "#34c759" : c >= 80 ? "#ff9500" : "#ff3b30") + '">' + pct(c, 0) + '</td></tr>';
      }).join("") + '</tbody></table></div>' +
      '<div class="note" style="margin-top:8px">' + tr("覆盖率 = 有数据天数 ÷ 截止日。数据是逐日积累的，越靠月末越接近真实 MTD。") + '</div>') +

    _card(tr("数据缺失"), C.missing + " " + tr("项"), missing.length
      ? '<div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("团队") + '</th><th class="l">' + tr("缺失项") + '</th><th class="l">' + tr("说明") + '</th></tr></thead><tbody>' + missRows + '</tbody></table></div>'
      : _empty(tr("无"))) +
    _card(tr("Day off 未匹配"), C.unmatched_off + " " + tr("项"), off.length
      ? '<div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("团队") + '</th><th class="l">' + tr("名字") + '</th><th>' + tr("次数") + '</th><th class="l">' + tr("说明") + '</th></tr></thead><tbody>' + offRows + '</tbody></table></div>'
      : _empty(tr("全部匹配"))) + '</div>' +

    (function () {
      var rows = [];
      (d.teams || []).forEach(function (t) {
        (t.score.entry_gap || []).forEach(function (g) { rows.push({ t: t, g: g }); });
      });
      if (!rows.length) return "";
      return _card(tr("录入差额来源"), rows.length + " " + tr("天"), '<div class="tbl-wrap"><table><thead><tr>' +
        '<th class="l">' + tr("团队") + '</th><th class="l">' + tr("日期") + '</th><th>' + tr("团队总额") + '</th><th>' + tr("成员合计") + '</th><th>' + tr("差额") + '</th><th class="l">' + tr("未列出的在职成员") + '</th></tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr data-team="' + x.t.code + '"><td class="l"><span class="chip n">' + esc(x.t.name) + '</span></td>' +
            '<td class="l">11-' + String(x.g.d).padStart(2, "0") + '</td>' +
            '<td class="num">' + n(x.g.team_dia) + '</td><td class="num">' + n(x.g.member_sum) + '</td>' +
            '<td class="num" style="font-weight:600;color:' + (x.g.gap > 0 ? "#ff9500" : "#ff3b30") + '">' + (x.g.gap > 0 ? "+" : "") + n(x.g.gap) + '</td>' +
            '<td class="l sub" style="white-space:normal">' + esc((x.g.missing || []).slice(0, 6).join("、") || "—") + '</td></tr>';
        }).join("") + '</tbody></table></div>');
    })() +

    (d.entries && d.entries.days && d.entries.days.length ? _card(tr("手工录入"), d.entries.days.length + " " + tr("天"), '<div class="note">' + tr("已录入日期：") + d.entries.days.map(function (x) { return x; }).join("、") + '<br>' + tr("团队/成员流水以录入为准，删除录入即恢复 Excel 原值。") + '</div>') : "") +
    _card(tr("底薪异常"), C.salary + " " + tr("项"), salary.length
      ? '<div class="tbl-wrap"><table><thead><tr><th class="l">' + tr("团队") + '</th><th class="l">' + tr("成员") + '</th><th>' + tr("底薪") + '</th><th>KPI</th><th class="l">' + tr("出处") + '</th></tr></thead><tbody>' + salRows + '</tbody></table></div>' +
        '<div class="note" style="margin-top:8px">' + tr("直接改上面这个单元格，改完点右上角「重建数据」。") + '</div>'
      : _empty(tr("无")));
}

/* 每日成绩录入 */
"use strict";

var ENT = null;            // {teams, entries}
var EDATE = null;          // 当前录入日期
var ETEAM = null;          // 当前团队

function _today() {
  var d = new Date();
  var p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}


function _curEntry() {
  if (!ENT || !EDATE || !ETEAM) return null;
  var byDate = (ENT.entries || {})[EDATE] || {};
  return byDate[ETEAM] || null;
}

function renderEntry() {
  if (!EDATE) EDATE = _today();
  if (!ETEAM) ETEAM = (S.data.teams[0] || {}).code;
  var tm = S.data.teams.find(function (x) { return x.code === ETEAM; }) || S.data.teams[0];
  var e = _curEntry() || {};
  var mem = (e.members || {});
  var memSum = Object.keys(mem).reduce(function (a, k) { return a + (mem[k] || 0); }, 0);

  var dateOpts = "";
  for (var i = 0; i < 30; i++) {
    var d = new Date(); d.setDate(d.getDate() - i);
    var v = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    dateOpts += '<option value="' + v + '"' + (v === EDATE ? " selected" : "") + ">" + v + "</option>";
  }
  var teamOpts = S.data.teams.map(function (t) {
    return '<option value="' + t.code + '"' + (t.code === ETEAM ? " selected" : "") + ">" + esc(t.name) + "</option>";
  }).join("");

  var memberRows = (tm.members || []).map(function (m) {
    var v = mem[m.nick];
    return '<tr><td class="l"><b>' + esc(m.en || m.nick) + '</b>' +
      (m.active ? "" : ' <span class="chip b">' + tr("离职") + '</span>') +
      '<div class="sub">' + (m.en ? esc(m.nick) + " · " : "") + "KPI " + (m.kpi ? n(m.kpi) : "—") + '</div></td>' +
      '<td style="width:150px"><input class="ent-in" type="number" min="0" step="1" data-nick="' + esc(m.nick) +
      '" value="' + (v == null ? "" : v) + '" placeholder="0"></td></tr>';
  }).join("");

  return     '<div class="between" style="margin:6px 0 2px"><div><h1>' + tr("每日成绩录入") + '</h1>' +
    '<div class="sub">' + tr("运营填写后自动汇总进看板；团队合计会覆盖记分表当天数据") + '</div></div>' +
    '<a class="btn" href="#/">' + tr("返回看板") + ' →</a></div>' +

    '<div class="card mt14"><h2>' + tr("录入") + ' <span class="hint">' + tr("团队 + 个人") + '</span></h2>' +
    '<div class="flex" style="gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
    '<label class="sub">' + tr("日期") + '<br><select class="ent-sel" id="entDate">' + dateOpts + '</select></label>' +
    '<label class="sub">' + tr("团队") + '<br><select class="ent-sel" id="entTeam">' + teamOpts + '</select></label>' +
    '<div style="margin-left:auto;align-self:flex-end" class="sub">' + tr("当月已录入") + " " + (S.data.entries.days || []).length + " " + tr("天") + '</div></div>' +

    '<div class="mini" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
    '<div><div class="l">' + tr("团队钻石") + '</div><input class="ent-in" id="entDia" type="number" min="0" value="' + (e.dia == null ? "" : e.dia) + '" placeholder="' + tr("必填") + '"></div>' +
    '<div><div class="l">' + tr("观看") + '</div><input class="ent-in" id="entView" type="number" min="0" value="' + (e.view == null ? "" : e.view) + '"></div>' +
    '<div><div class="l">PCU</div><input class="ent-in" id="entPcu" type="number" min="0" value="' + (e.pcu == null ? "" : e.pcu) + '"></div>' +
    '<div><div class="l">ACU</div><input class="ent-in" id="entAcu" type="number" min="0" value="' + (e.acu == null ? "" : e.acu) + '"></div>' +
    '<div><div class="l">' + tr("涨粉") + '</div><input class="ent-in" id="entFans" type="number" min="0" value="' + (e.fans == null ? "" : e.fans) + '"></div>' +
    '<div><div class="l">' + tr("礼物人数") + '</div><input class="ent-in" id="entGift" type="number" min="0" value="' + (e.gifters == null ? "" : e.gifters) + '"></div>' +
    '<div><div class="l">' + tr("日") + 'KPI</div><select class="ent-sel" id="entKpi">' +
    '<option value=""' + (e.kpi == null ? " selected" : "") + '>—</option>' +
    '<option value="1"' + (e.kpi === true ? " selected" : "") + '>' + tr("达标") + '</option>' +
    '<option value="0"' + (e.kpi === false ? " selected" : "") + '>' + tr("未达标") + '</option></select></div>' +
    '<div><div class="l">' + tr("休息") + '</div><label class="flex" style="gap:6px;align-items:center;height:34px"><input type="checkbox" id="entOff"' + (e.off ? " checked" : "") + '> DAY OFF</label></div></div>' +

    '<div class="flex" style="gap:10px;margin:10px 0 14px"><input class="ent-in" id="entNote" style="flex:1" placeholder="' + tr("备注（PK / 停播 / 活动…）") + '" value="' + esc(e.note || "") + '"></div>' +

    '<h3 style="font-size:14px;margin:6px 0 8px">' + tr("成员个人钻石") + ' <span class="sub" style="font-weight:400">' +
    tr("合计") + ' <b id="entMemSum">' + n(memSum) + '</b></span></h3>' +
    '<div class="tbl-wrap" style="max-height:420px"><table><tbody>' + memberRows + '</tbody></table></div>' +
    '<div id="entWarn" class="note" style="margin-top:8px;display:none;color:#ff9500"></div>' +

    '<div class="flex" style="gap:10px;margin-top:16px">' +
    '<button class="btn pri" id="entSave">' + tr("保存并更新看板") + '</button>' +
    '<button class="btn" id="entClear">' + tr("清空本日") + '</button>' +
    '<span id="entMsg" class="sub"></span></div></div>' +

    '<div class="card mt14"><h2>' + tr("批量导入") + ' <span class="hint">' + tr("CSV / 粘贴") + '</span></h2>' +
    '<div class="note">' + tr("① 直接粘贴日报（推荐）：Group + 日期 + Total + 每人一行") + '<br>' +
    '② 或 CSV：<code>团队,日期,成员,钻石</code> / <code>团队,日期,钻石,观看,PCU,ACU,涨粉,礼物人数</code></div>' +
    '<textarea id="entCsv" class="ent-ta" placeholder="Group T01 20/11/26&#10;Total : 102,704&#10;Member A : 5,636&#10;Member B : 81,819&#10;Member C : 3,995"></textarea>' +
    '<div class="flex" style="gap:10px;margin-top:10px"><input type="file" id="entFile" accept=".csv,.txt" class="sub">' +
    '<button class="btn" id="entCsvGo">' + tr("导入并更新") + '</button><span id="entCsvMsg" class="sub"></span></div></div>' +

    '<div class="card mt14"><h2>' + tr("已录入") + ' <span class="hint" id="entListHint">' + tr("加载中…") + '</span></h2>' +
    '<div class="tbl-wrap" style="max-height:360px"><table id="entList"><tbody><tr><td class="empty">' + tr("加载中…") + '</td></tr></tbody></table></div></div>' +

    '<div class="card mt14"><h2>' + tr("录入日志") + ' <span class="hint" id="entLogHint">' + tr("加载中…") + '</span></h2>' +
    '<div class="tbl-wrap" style="max-height:420px"><table id="entLog"><tbody><tr><td class="empty">' + tr("加载中…") + '</td></tr></tbody></table></div></div>';
}

function _entNums() {
  var g = function (id) { var el = $("#" + id); return el && el.value !== "" ? Number(el.value) : null; };
  var members = {};
  document.querySelectorAll(".ent-in[data-nick]").forEach(function (el) {
    if (el.value !== "" && Number(el.value) > 0) members[el.dataset.nick] = Number(el.value);
  });
  return {
    date: EDATE, team: ETEAM,
    dia: g("entDia"), view: g("entView"), pcu: g("entPcu"), acu: g("entAcu"),
    fans: g("entFans"), gifters: g("entGift"),
    kpi: ($("#entKpi") && $("#entKpi").value !== "") ? $("#entKpi").value === "1" : null,
    off: !!($("#entOff") && $("#entOff").checked),
    note: ($("#entNote") || {}).value || "",
    members: members
  };
}

function _refreshSum() {
  var sum = 0;
  document.querySelectorAll(".ent-in[data-nick]").forEach(function (el) { sum += Number(el.value) || 0; });
  var s = $("#entMemSum"); if (s) s.textContent = n(sum);
  var diaEl = $("#entDia"), warn = $("#entWarn");
  if (!warn) return;
  var dia = diaEl && diaEl.value !== "" ? Number(diaEl.value) : null;
  if (dia != null && sum && dia !== sum) {
    warn.style.display = "block";
    warn.textContent = tr("成员合计") + " " + n(sum) + " ≠ " + tr("团队钻石") + " " + n(dia) + "（差 " + (sum - dia > 0 ? "+" : "") + n(sum - dia) + "）";
  } else { warn.style.display = "none"; }
}

function entryMount() {
  document.querySelectorAll("#entDate,#entTeam").forEach(function (el) {
    el.addEventListener("change", function () {
      if (el.id === "entDate") EDATE = el.value; else ETEAM = el.value;
      $("#app").innerHTML = renderEntry(); entryMount();
    });
  });
  document.querySelectorAll(".ent-in").forEach(function (el) {
    el.addEventListener("input", _refreshSum);
  });
  var save = $("#entSave");
  if (save) save.addEventListener("click", async function () {
    var p = _entNums();
    if (p.dia == null && !Object.keys(p.members).length) { toast(tr("请至少填写团队钻石或成员钻石")); return; }
    save.disabled = true; $("#entMsg").textContent = tr("保存中…");
    try {
      var r = await fetch("api/entry", { method: "POST", headers: { "Content-Type": "application/json", "X-Edit-Key": S.key || "" }, body: JSON.stringify(p) });
      var j = await r.json();
      if (!j.ok) throw new Error(j.error || "fail");
      toast(tr("已保存，看板已更新"));
      await load(); loadEntries(); loadLog();
    } catch (err) { toast(tr("保存失败：") + err.message, 4000); $("#entMsg").textContent = ""; }
    save.disabled = false;
  });
  var clr = $("#entClear");
  if (clr) clr.addEventListener("click", async function () {
    if (!confirm(tr("确认删除这一天的录入？"))) return;
    await fetch("api/entry/delete", { method: "POST", headers: { "Content-Type": "application/json", "X-Edit-Key": S.key || "" }, body: JSON.stringify({ date: EDATE, team: ETEAM }) });
    toast(tr("已删除")); await load(); loadEntries(); loadLog();
  });
  var go = $("#entCsvGo");
  if (go) go.addEventListener("click", async function () {
    var text = ($("#entCsv") || {}).value || "";
    if (!text.trim()) { toast(tr("请粘贴或选择文件")); return; }
    this.disabled = true;
    try {
      var r = await fetch("api/entry/csv", { method: "POST", headers: { "Content-Type": "application/json", "X-Edit-Key": S.key || "" }, body: JSON.stringify({ text: text }) });
      var j = await r.json();
      if (!j.saved) {
        toast(tr("导入失败：未识别到数据 · ") + ((j.errors && j.errors[0]) || tr("请检查格式")), 6000);
      } else {
        var msg = tr("导入") + " " + j.saved + " " + tr("条");
        if (j.unmatched && j.unmatched.length) msg += " · " + tr("未匹配") + " " + j.unmatched.join(", ");
        else if (j.errors && j.errors.length) msg += " · " + j.errors[0];
        toast(msg, j.unmatched && j.unmatched.length ? 7000 : 4500);
      }
      $("#entCsv").value = "";
      await load(); loadEntries(); loadLog();
    } catch (e) { toast(tr("导入失败"), 4000); }
    this.disabled = false;
  });
  var f = $("#entFile");
  if (f) f.addEventListener("change", function () {
    var file = f.files && f.files[0]; if (!file) return;
    var fr = new FileReader();
    fr.onload = function () { $("#entCsv").value = fr.result; };
    fr.readAsText(file);
  });
  loadEntries();
  loadLog();
}

async function loadLog() {
  var tb = document.querySelector("#entLog tbody");
  var hint = $("#entLogHint");
  if (!tb) return;
  var items = [];
  try {
    var r = await fetch("api/entry/log?limit=100", { cache: "no-store" });
    var j = await r.json();
    items = j.items || [];
  } catch (e) { items = []; }
  if (!items.length) {
    tb.innerHTML = '<tr><td class="empty">' + tr("暂无日志") + '</td></tr>';
    if (hint) hint.textContent = "";
    return;
  }
  var ACT = { save: tr("保存"), delete: tr("删除"), import: tr("导入") };
  var CLS = { save: "g", delete: "b", import: "w" };
  tb.innerHTML = items.map(function (x) {
    return '<tr style="cursor:default"><td class="l mono" style="font-size:11px;white-space:nowrap">' + esc(x.ts) + '</td>' +
      '<td class="c"><span class="chip ' + (CLS[x.action] || "n") + '">' + esc(ACT[x.action] || x.action) + '</span></td>' +
      '<td class="l">' + esc(x.date || "—") + '</td>' +
      '<td class="l"><b>' + esc(x.team || "—") + '</b></td>' +
      '<td class="num">' + (x.dia == null ? "—" : n(x.dia)) + '</td>' +
      '<td class="num sub">' + (x.members == null ? "—" : x.members + " " + tr("人")) + '</td>' +
      '<td class="l sub" style="white-space:normal">' + esc(x.detail || x.note || "") + (x.ip ? ' <span class="mono" style="opacity:.6">· ' + esc(x.ip) + '</span>' : '') + '</td></tr>';
  }).join("");
  if (hint) hint.textContent = items.length + " " + tr("条");
}

async function loadEntries() {
  try {
    var r = await fetch("api/entries", { cache: "no-store" });
    ENT = await r.json();
  } catch (e) { ENT = null; }
  var tb = document.querySelector("#entList tbody");
  var hint = $("#entListHint");
  if (!tb) return;
  if (!ENT || !ENT.entries) { tb.innerHTML = '<tr><td class="empty">' + tr("暂无录入") + '</td></tr>'; return; }
  var rows = [];
  Object.keys(ENT.entries).sort().reverse().forEach(function (date) {
    Object.keys(ENT.entries[date]).forEach(function (team) {
      var e = ENT.entries[date][team];
      var ms = Object.keys(e.members || {}).length;
      rows.push('<tr style="cursor:default"><td class="l">' + date + '</td><td class="l"><b>' + esc(team) + '</b></td>' +
        '<td class="num">' + (e.dia == null ? "—" : n(e.dia)) + '</td>' +
        '<td class="num sub">' + ms + " " + tr("人") + '</td>' +
        '<td class="l sub">' + (e.off ? "DAY OFF" : "") + (e.note ? " " + esc(e.note) : "") + '</td>' +
        '<td class="c"><button class="btn" data-del="' + date + "|" + team + '">' + tr("删除") + '</button></td></tr>');
    });
  });
  tb.innerHTML = rows.join("") || '<tr><td class="empty">' + tr("暂无录入") + '</td></tr>';
  if (hint) hint.textContent = (ENT.updated_at || "") + " · " + rows.length + " " + tr("条");
  tb.querySelectorAll("[data-del]").forEach(function (b) {
    b.addEventListener("click", async function (ev) {
      ev.stopPropagation();
      var p = b.dataset.del.split("|");
      if (!confirm(tr("删除") + " " + p[0] + " " + p[1] + " ?")) return;
      await fetch("api/entry/delete", { method: "POST", headers: { "Content-Type": "application/json", "X-Edit-Key": S.key || "" }, body: JSON.stringify({ date: p[0], team: p[1] }) });
      toast(tr("已删除")); await load(); loadEntries(); loadLog();
    });
  });
}

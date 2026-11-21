/* 直播团队看板 · front-end (no deps) */
"use strict";
var VJ = false;   // VJ 视图（无财务数据）

const S = { data: null, view: "overview", team: null, mSort: null, onlyActive: true, memberView: "table" };
try { var _mv = localStorage.getItem("board.memberView"); if (_mv === "card" || _mv === "table") S.memberView = _mv; } catch (e) {}
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- format ---------------- */
const nf = (x, d = 0) => (x == null || isNaN(x)) ? "—" : Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const n = (x) => nf(x, 0);
function short(x) {
  if (x == null || isNaN(x)) return "—";
  const a = Math.abs(x);
  if (a >= 1e9) return (x / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (x / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (x / 1e3).toFixed(0) + "K";
  return n(x);
}
const pct = (x, d = 1) => (x == null || isNaN(x)) ? "—" : Number(x).toFixed(d) + "%";
const thb = (x) => x == null ? "—" : "THB " + n(x);

/* ---------------- svg helpers ---------------- */

function ring(p, label, big) {
  const v = Math.max(0, Math.min(p == null ? 0 : p, 200));
  return '<div class="ring" style="--p:' + (v / 2).toFixed(1) + '"><div><b>' + (big == null ? "—" : big) + '</b><span>' + esc(label) + '</span></div></div>';
}
function pbarWide(p, cls) {
  const v = p == null ? 0 : Math.max(0, Math.min(p, 100));
  const c = cls || (p == null ? "" : p >= 100 ? "ok" : p >= 60 ? "" : p >= 30 ? "warn" : "bad");
  return '<div class="pbar ' + c + '" style="height:7px"><i style="width:' + v + '%"></i></div>';
}
function pbar(p, cls) {
  const v = p == null ? 0 : Math.max(0, Math.min(p, 100));
  const c = cls || (p == null ? "" : p >= 100 ? "ok" : p >= 60 ? "" : p >= 30 ? "warn" : "bad");
  return '<div class="pbar-h"><div class="pbar ' + c + '"><i style="width:' + v + '%"></i></div><span class="pv">' +
    (p == null ? "—" : (p >= 100 ? '<span class="ok-mark">✓</span>' : "") + pct(p, 0)) + '</span></div>';
}

/* ---------------- charts ---------------- */
function dailyChart(t) {
  const W = 980, H = 250, P = { l: 54, r: 14, t: 16, b: 26 };
  const daily = t.score.daily || [];
  const maxD = Math.max.apply(null, daily.map((d) => d.dia || 0).concat([1]));
  const target = t.score.goal_derived ? 0 : (t.score.goal || 0) / 30;
  const maxY = Math.max(maxD, target) * 1.12;
  const N = Math.max(2, Math.min(31, t.as_of_day || 30));
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const x = (i) => P.l + (i / N) * iw, bw = iw / N * .66;
  const y = (v) => P.t + ih - (v / maxY) * ih;
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = maxY * i / 4, yy = y(v);
    g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e5e5ea" stroke-width="1"/>' +
      '<text x="' + (P.l - 8) + '" y="' + (yy + 3.5) + '" fill="#86868b" font-size="10" text-anchor="end">' + short(v) + '</text>';
  }
  const bars = daily.map((d) => {
    const day = d.d || 0;
    if (!day) return "";
    const bx = x(day - 1);
    if (d.off) return '<rect x="' + (bx + bw * .17).toFixed(1) + '" y="' + P.t + '" width="' + bw.toFixed(1) + '" height="' + ih + '" fill="#e5e5ea" opacity=".45" rx="2"/>' +
      '<text x="' + (bx + bw * .5).toFixed(1) + '" y="' + (P.t + ih - 6) + '" fill="#c7c7cc" font-size="9" text-anchor="middle" transform="rotate(-90 ' + (bx + bw * .5).toFixed(1) + ' ' + (P.t + ih - 6) + ')">OFF</text>';
    const h = Math.max(1, (d.dia / maxY) * ih);
    const hit = d.kpi === true;
    return '<rect x="' + (bx + bw * .17).toFixed(1) + '" y="' + y(d.dia).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2.5" fill="url(#' + (hit ? "gHit" : "gMiss") + ')" opacity=".95">' +
      '<title>' + day + tr("日") + " " + "·" + " " + n(d.dia) + " " + tr("钻") + " " + "·" + " " + tr("日") + "KPI " + (d.kpi === true ? tr("达标") : d.kpi === false ? tr("未达标") : tr("未标注")) +
      " " + "·" + " " + tr("观看") + " " + n(d.view) + " " + "·" + " PCU " + n(d.pcu) + " " + "·" + " ACU " + n(d.acu) + " " + "·" + " " + tr("涨粉") + " " + n(d.fans) + " " + "·" + " " + tr("礼物人数") + " " + n(d.gifters) + '</title></rect>';
  }).join("");
  const _vals = daily.filter(function (d) { return (d.dia || 0) > 0; }).map(function (d) { return d.dia; });
  const _mean = _vals.length ? _vals.reduce(function (a, b) { return a + b; }, 0) / _vals.length : 0;
  const mline = _mean > 0 ? '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(_mean).toFixed(1) + '" y2="' + y(_mean).toFixed(1) + '" stroke="#8e8e93" stroke-width="1" stroke-dasharray="2 4" opacity=".75"/>' : "";
  const tline = target > 0 ? '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(target).toFixed(1) + '" y2="' + y(target).toFixed(1) + '" stroke="#f5b642" stroke-width="1.4" stroke-dasharray="5 4"/>' +
    '<text x="' + (W - P.r - 2) + '" y="' + (y(target) - 5).toFixed(1) + "\" fill=\"#f5b642\" font-size=\"10\" text-anchor=\"end\">" + tr("日目标") + " " + short(target) + '</text>' : "";
  const labels = [1, 5, 10, 15, 20, 25, 30].filter((d) => d <= N).map((d) =>
    '<text x="' + (x(d - 1) + bw * .5).toFixed(1) + '" y="' + (H - 8) + '" fill="#86868b" font-size="10" text-anchor="middle">' + d + '</text>').join("");
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
    '<defs><linearGradient id="gHit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34c759"/><stop offset="1" stop-color="#248a3d"/></linearGradient>' +
    '<linearGradient id="gMiss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0071e3"/><stop offset="1" stop-color="#0051a8"/></linearGradient></defs>' +
    g + bars + mline + tline + labels + '</svg>' +
    "<div class=\"legend\"><span><i style=\"background:linear-gradient(180deg,#34c759,#248a3d)\"></i>" + tr("达标日") + "</span>" +
    "<span><i style=\"background:linear-gradient(180deg,#0071e3,#0051a8)\"></i>" + tr("未达标日") + "</span>" +
    "<span><i style=\"background:#e5e5ea\"></i>" + tr("休息") + "/" + tr("停播") + "</span>" +
    (target > 0 ? "<span><i style=\"background:#ff9500\"></i>" + tr("日目标（月度目标") + "÷30" + "）" + "</span>" : "<span>" + tr("未设月度目标，故无目标线") + "</span>") + '</div>';
}

function rankBars(teams) {
  const W = 980, rowH = 30, H = teams.length * rowH + 22, P = { l: 118, r: 92 };
  const mx = Math.max.apply(null, teams.map((t) => t.score.mtd_dia).concat([1]));
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<defs><linearGradient id="gBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0071e3"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>' +
    teams.map((t, i) => {
      const w = (t.score.mtd_dia / mx) * (W - P.l - P.r);
      const yy = 8 + i * rowH;
      const g = (t.score.goal && !t.score.goal_derived) ? Math.min(1, t.score.mtd_dia / t.score.goal) : null;
      return '<text x="' + (P.l - 10) + '" y="' + (yy + 16) + '" fill="#6e6e73" font-size="11.5" text-anchor="end" font-weight="600">' + esc(t.name) + '</text>' +
        '<rect x="' + P.l + '" y="' + (yy + 4) + '" width="' + (W - P.l - P.r) + '" height="16" rx="4" fill="#f0f0f3"/>' +
        '<rect x="' + P.l + '" y="' + (yy + 4) + '" width="' + w.toFixed(1) + '" height="16" rx="4" fill="url(#gBar)"/>' +
        (g != null ? '<rect x="' + P.l + '" y="' + (yy + 4) + '" width="' + (g * (W - P.l - P.r)).toFixed(1) + '" height="16" rx="4" fill="none" stroke="#f5b642" stroke-width="1.2" stroke-dasharray="4 3" opacity=".9"/>' : "") +
        '<text x="' + (W - P.r + 8) + '" y="' + (yy + 16) + '" fill="#1d1d1f" font-size="11.5" font-weight="700">' + short(t.score.mtd_dia) + '</text>';
    }).join("") + '</svg>';
}



/* ---------------- views ---------------- */


function teamCard(t, rank) {
  const f = t.finance || {}, sc = t.score;
  const derived = !!sc.goal_derived;
  const prog = sc.goal ? sc.mtd_dia / sc.goal * 100 : null;
  const hitRate = sc.kpi_marked ? sc.kpi_hit / sc.kpi_marked * 100 : null;
  return '<div class="tcard" data-team="' + t.code + '">' +
    '<div class="rk">#' + rank + '</div>' +
    '<div class="nm">' + esc(t.name) + '</div>' +
    '<div class="mc">MC ' + esc(t.mc) + " " + "·" + " " + t.members.filter((m) => m.active).length + " " + tr("名在职") + "</div>" +
    '<div class="big">' + short(sc.mtd_dia) + "<small>" + tr("钻") + "</small></div>" +
    '<div style="margin-top:14px">' + pbarWide(prog) + '</div>' +
    '<div class="row"><span>' + tr("目标") + '</span><b>' + (sc.goal ? n(sc.goal) : '<span class="chip w">' + tr("未设目标") + '</span>') + '</b></div>' +
    "<div class=\"row\"><span>" + tr("日") + "KPI" + tr("达标") + "</span><b>" + (hitRate == null ? "—" : pct(hitRate, 0)) + '</b></div>' +
    "<div class=\"row\"><span>" + tr("观看转化率") + "</span><b>" + (sc.rate_gift == null ? "—" : sc.rate_gift + "% <small class=\"sub\">· " + sc.view_conv + " " + tr("钻/人") + "</small>") + '</b></div>' +
    (VJ ? "" : "<div class=\"row\"><span>" + tr("净利") + "</span><b style=\"color:" + (f.profit >= 0 ? "#34c759" : "#ff3b30") + '">' + (f.profit < 0 ? "−" : "") + thb(Math.abs(f.profit)) + '</b></div>') +
    (VJ ? '<div class="foot">' : '<div class="foot"><span class="chip ' + (f.margin >= 25 ? "g" : f.margin >= 0 ? "n" : "b") + "\">" + tr("边际") + " " + pct(f.margin, 0) + '</span>') +
    (t.own_last_day && t.own_last_day < t.as_of_day ? '<span class="chip w">' + tr("本队记分表只到") + " " + t.own_last_day + " " + tr("日") + '</span>' : '') +
    (sc.metrics_missing ? "<span class=\"chip w\">" + tr("无互动数据") + "</span>" : '<span class="chip n">' + short(sc.view) + " " + tr("观看") + "</span><span class=\"chip n\">PCU " + n(sc.pcu_avg) + '</span>') + '</div></div>';
}



const STATUS_I18N = {
  "เข้าทีมแล้ว (Active)": ["在职", "อยู่ในทีม"],
  "อยู่ระหว่างเทรนนิ่ง (In Training)": ["培训中", "อยู่ระหว่างฝึกอบรม"],
  "รอเริ่มงาน": ["待上岗", "รอเริ่มงาน"],
  "ออกแล้ว": ["已离职", "ออกแล้ว"],
  "ลาออกโดยสมัครใจ (Resigned)": ["主动离职", "ลาออกเอง"],
  "ไม่ผ่านการเทรนนิ่ง (Eliminated)": ["培训未通过", "ไม่ผ่านการฝึกอบรม"],
  "Active": ["在职", "อยู่ในทีม"]
};
function statusLabel(s) {
  if (!s) return "—";
  var exact = STATUS_I18N[s];
  if (exact) return exact[MLANG === "th" ? 1 : 0];
  var k = Object.keys(STATUS_I18N).find(function (x) { return s.indexOf(x) === 0; });
  return k ? STATUS_I18N[k][MLANG === "th" ? 1 : 0] : s;
}






function n2(v) { return v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }); }











/* ---------------- member drawer ---------------- */

function closeDrawer() { $("#drawer").classList.remove("on"); $("#mask").classList.remove("on"); }
window.closeDrawer = closeDrawer;

/* ---------------- router ---------------- */
function route() {
  const h = location.hash.replace(/^#/, "") || "/";
  const parts = h.split("/").filter(Boolean);
  S.view = parts[0] || "overview";
  if (VJ && ["entry", "diagnose", "reconcile"].indexOf(S.view) >= 0) { location.hash = "#/"; return; }
  S.team = parts[1] || null;
  S.member = parts[2] ? decodeURIComponent(parts[2]) : null;
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on",
    (a.dataset.v === "overview" && ["members", "reconcile", "diagnose"].indexOf(S.view) < 0) || a.dataset.v === S.view));
  const app = $("#app");
  if (!S.data) return;
  if (S.view === "team" && S.team) app.innerHTML = renderTeam(S.team);
  else if (S.view === "members") app.innerHTML = renderMembers();
  else if (S.view === "reconcile") app.innerHTML = renderReconcile();
  else if (S.view === "diagnose" && typeof renderDiagnose === "function") app.innerHTML = renderDiagnose();
  else if (S.view === "entry" && typeof renderEntry === "function") app.innerHTML = renderEntry();
  else app.innerHTML = renderOverview();
  if (S.member && S.team) openMember(S.team, S.member); else closeDrawer();
  if (S.view === "entry" && typeof entryMount === "function") entryMount();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

/* ---------------- events ---------------- */
document.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-s]");
  if (th) {
    const key = th.dataset.s;
    const cur = S.mSort;
    const dir = cur && cur.key === key ? -cur.dir : (["nick", "status", "team_name"].indexOf(key) >= 0 ? 1 : -1);
    S.mSort = { key: key, dir: dir, team: S.team };
    route();
    return;
  }
  const tog = e.target.closest("[data-toggle]");
  if (tog) { S.onlyActive = !S.onlyActive; route(); return; }
  const vw = e.target.closest("[data-view]");
  if (vw) { S.memberView = vw.dataset.view; try { localStorage.setItem("board.memberView", S.memberView); } catch (err) {} route(); return; }
  if (e.target.closest("[data-png]")) { if (S.curTeam && S.curMember) exportMemberPNG(S.curTeam, S.curMember); return; }
  if (e.target.closest("[data-pngall]")) { exportMembersPNG(); return; }
  const row = e.target.closest("tr[data-mem], .mcard");
  if (row) { openMember(row.dataset.team || S.team, row.dataset.mem); return; }
  const card = e.target.closest("[data-team]");
  if (card && !e.target.closest("a")) { location.hash = "#/team/" + card.dataset.team; return; }
  if (e.target.id === "mask" || e.target.classList.contains("x")) closeDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
  if (e.key === "/" && document.activeElement.id !== "memSearch") {
    const s = $("#memSearch"); if (s) { e.preventDefault(); s.focus(); }
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "memSearch") return;
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll("table tbody tr[data-mem]").forEach((tr) => {
    tr.style.display = !q || tr.textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none";
  });
});

/* ---------------- downloads ---------------- */


/* ---------------- i18n chrome ---------------- */
function periodLabel() {
  if (!S.data) return "";
  var p = S.data.period;
  if (MLANG !== "th") return p.label;
  var d = new Date(p.start + "T00:00:00");
  var mn = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][d.getMonth()];
  return mn + " " + d.getFullYear();
}
function applyChrome() {
  document.documentElement.lang = (MLANG === "th") ? "th" : "zh-CN";
  document.title = tr("直播团队看板") + " · " + periodLabel();
  var bn = $("#brandName"); if (bn) bn.textContent = tr("直播团队看板");
  var bt = $("#btnRebuildTx"); if (bt) bt.textContent = tr("重建数据");
  var rb = $("#btnRebuild"); if (rb) rb.style.display = VJ ? "none" : "";
  var ga = $("#genAt"); if (ga && S.data) ga.textContent = tr("构建于") + " " + S.data.generated_at;
  var bs = $("#brandSub"); if (bs) bs.textContent = S.data ? (S.data.period.label_en || "").toUpperCase() : "";
  document.querySelectorAll("#nav a").forEach(function (a) {
    a.textContent = tr(a.dataset.k);
    var hide = VJ && ["录入", "诊断", "口径对账"].indexOf(a.dataset.k) >= 0;
    a.style.display = hide ? "none" : "";
  });
  document.querySelectorAll("#lang button").forEach(function (b) { b.classList.toggle("on", b.dataset.lang === MLANG); });
}
document.querySelectorAll("#lang button").forEach(function (b) {
  b.addEventListener("click", function () { setLang(b.dataset.lang); applyChrome(); route(); });
});
(function () {
  var mh = /[?&]lang=(zh|th)/.exec(location.search);
  if (mh) setLang(mh[1]);
  var vw = /[?&]view=(card|table)/.exec(location.search);
  if (vw) S.memberView = vw[1];
  var th = /[?&]theme=(light|dark)/.exec(location.search);
  if (th) applyTheme(th[1]);
})();

/* ---------------- theme ---------------- */
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
  try { localStorage.setItem("board.theme", t); } catch (e) {}
  var b = $("#btnTheme"); if (b) b.textContent = t === "dark" ? "☀" : "☾";
}
(function () {
  var saved = null;
  try { saved = localStorage.getItem("board.theme"); } catch (e) {}
  if (!saved) saved = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  applyTheme(saved);
  var b = $("#btnTheme");
  if (b) b.addEventListener("click", function () {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
})();

function skeletonHTML() {
  return '<div class="kpis"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div>' +
    '<div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div>' +
    '<div class="skel skel-block"></div><div class="skel skel-block"></div>';
}

/* ---------------- boot ---------------- */
function toast(msg, ms) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), ms || 2400);
}
async function load() {
  try {
    if (!$("#app").innerHTML || $("#app").innerHTML.indexOf("skel") < 0) $("#app").innerHTML = skeletonHTML();
    const r = await fetch("api/data", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    S.data = await r.json();
    VJ = !!S.data.vj;
    (function () {
      var mk = /[?&]k=([^&]+)/.exec(location.search);
      if (mk) { try { localStorage.setItem("board.key", decodeURIComponent(mk[1])); } catch (e) {} }
      try { S.key = localStorage.getItem("board.key") || ""; } catch (e) { S.key = ""; }
    })();
    if (VJ) {
      (S.data.teams || []).forEach(function (t) { if (!t.finance) t.finance = {}; });
      S.data.totals = S.data.totals || {};
      ["net_thb", "salary", "ops", "profit", "margin", "roi", "total_cost"].forEach(function (k) {
        if (S.data.totals[k] === undefined) S.data.totals[k] = null;
      });
    }
    applyChrome();
    route();
  } catch (err) {
    $("#app").innerHTML = '<div class="empty">' + tr("数据加载失败：") + esc(err.message) + '<br><br>' +
      tr("请先运行") + ' <code>python dashboard/build_dashboard.py</code> ' + tr("生成") + ' data/dashboard.json。</div>';
  }
}
$("#btnRebuild").addEventListener("click", async () => {
  const b = $("#btnRebuild"); b.disabled = true;
  const bt = $("#btnRebuildTx"); if (bt) bt.textContent = tr("构建中…");
  try {
    const r = await fetch("api/rebuild", { method: "POST" });
    const j = await r.json();
    if (!j.ok) throw new Error((j.error || "").slice(-300));
    toast(tr("已重建") + " · " + j.teams + " " + tr("队") + " / " + j.members + " " + tr("人") + " · " + j.seconds + "s");
    await load();
  } catch (e) { toast(tr("重建失败：") + " " + e.message, 4200); }
  b.disabled = false; if (bt) bt.textContent = tr("重建数据");
});
$("#mask").addEventListener("click", closeDrawer);
load();

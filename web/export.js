/* PNG 导出 v2 */
"use strict";

function _fmt(v) { return v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function _thb(v) { return v == null ? "—" : "THB " + _fmt(v); }

function _canvas(w, h) {
  var dpr = 2, c = document.createElement("canvas");
  c.width = w * dpr; c.height = h * dpr;
  var x = c.getContext("2d"); x.scale(dpr, dpr);
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, w, h);
  return { c: c, x: x, w: w, h: h };
}
function _pill(x, text, px, py, bg, fg) {
  x.font = "600 12px -apple-system,Segoe UI,Roboto,sans-serif";
  var w = x.measureText(text).width + 20;
  x.fillStyle = bg; x.beginPath();
  x.roundRect ? x.roundRect(px, py, w, 24, 12) : x.rect(px, py, w, 24);
  x.fill();
  x.fillStyle = fg; x.fillText(text, px + 10, py + 16);
  return w;
}
function _row(x, y, label, value, color) {
  x.fillStyle = "#6e6e73"; x.font = "500 13px -apple-system,Segoe UI,Roboto,sans-serif";
  x.fillText(label, 48, y);
  x.fillStyle = color || "#1d1d1f"; x.font = "700 15px -apple-system,Segoe UI,Roboto,sans-serif";
  var t = String(value); x.fillText(t, 430 - x.measureText(t).width, y);
}
function _footer(x, w, h, tm) {
  x.fillStyle = "#f5f5f7"; x.fillRect(0, h - 44, w, 44);
  x.fillStyle = "#86868b"; x.font = "500 11px -apple-system,Segoe UI,Roboto,sans-serif";
  x.fillText("Live Team Dashboard · " + (tm ? tm.name : "") + " · " + new Date().toLocaleString("en-GB"), 48, h - 18);
  x.textAlign = "right"; x.fillText("board", w - 48, h - 18); x.textAlign = "left";
}

function buildMemberPNG(m, tm) {
  var w = 900, h = 700, o = _canvas(w, h), x = o.x;
  x.fillStyle = "#f5f5f7"; x.fillRect(0, 0, w, 140);
  x.fillStyle = "#1d1d1f"; x.font = "700 30px -apple-system,Segoe UI,Roboto,sans-serif";
  x.fillText(m.nick || "—", 48, 74);
  x.font = "500 14px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillStyle = "#6e6e73";
  x.fillText((m.thai || "") + "  ·  " + tm.name + "  ·  MC " + tm.mc, 48, 100);
  var px = 48;
  px += _pill(x, statusLabel(m.status), px, 160, "#e8f8ec", "#1d8f3a") + 8;
  if (m.contract) px += _pill(x, m.contract, px, 160, "#f0f0f3", "#48484a") + 8;
  if (m.kpi) px += _pill(x, "KPI " + _fmt(m.kpi), px, 160, "#e8f0fe", "#0b63d6") + 8;
  if (m.salary && !VJ) _pill(x, _thb(m.salary), px, 160, "#fff4e5", "#b26a00");

  var y = 236;
  x.strokeStyle = "#e5e5ea"; x.beginPath(); x.moveTo(48, y - 24); x.lineTo(w - 48, y - 24); x.stroke();
  _row(x, y, "KPI (month)", _fmt(m.kpi)); y += 34;
  _row(x, y, "KPI (MTD " + tm.as_of_day + "d)", _fmt(m.kpi_mtd)); y += 34;
  if (!VJ) {
    _row(x, y, "Base salary (month)", _thb(m.salary)); y += 34;
    _row(x, y, "Base salary (MTD)", _thb(m.salary_mtd)); y += 34;
  }
  _row(x, y, "Days present", String(m.present_days || 0)); y += 34;
  _row(x, y, "Days off", String(m.off_count || 0), m.off_count ? "#ff9500" : null); y += 34;
  _row(x, y, "Contract", m.contract || "—"); y += 34;
  _row(x, y, "Start date", (m.start || "—").slice(0, 10)); y += 34;
  _row(x, y, "TikTok", m.tiktok ? "@" + m.tiktok : "—"); y += 40;

  if (m.off_days && m.off_days.length) {
    x.fillStyle = "#6e6e73"; x.font = "500 13px -apple-system,Segoe UI,Roboto,sans-serif";
    x.fillText("Days off", 48, y);
    var cx = 48, cy = y + 16;
    x.font = "600 12px -apple-system,Segoe UI,Roboto,sans-serif";
    m.off_days.forEach(function (dd) {
      var t = "11-" + String(dd).padStart(2, "0"), tw = x.measureText(t).width + 18;
      if (cx + tw > w - 48) { cx = 48; cy += 28; }
      x.fillStyle = "#fff4e5"; x.beginPath();
      x.roundRect ? x.roundRect(cx, cy, tw, 22, 11) : x.rect(cx, cy, tw, 22); x.fill();
      x.fillStyle = "#b26a00"; x.fillText(t, cx + 9, cy + 15);
      cx += tw + 6;
    });
  }
  _footer(x, w, h, tm);
  return o.c;
}

function buildMembersPNG(list) {
  var w = 900, rowH = 30, h = 150 + list.length * rowH + 60, o = _canvas(w, h), x = o.x;
  x.fillStyle = "#1d1d1f"; x.font = "700 26px -apple-system,Segoe UI,Roboto,sans-serif";
  x.fillText("Member roster", 48, 66);
  x.font = "500 13px -apple-system,Segoe UI,Roboto,sans-serif"; x.fillStyle = "#6e6e73";
  x.fillText(list.length + " members · KPI & salary · " + new Date().toLocaleDateString("en-GB"), 48, 90);

  var cols = VJ ? [48, 340, 560, 700] : [48, 300, 470, 620, 760];
  var head = VJ ? ["Member", "Team", "KPI", "Off days"] : ["Member", "Team", "KPI", "Salary", "Off days"];
  x.fillStyle = "#86868b"; x.font = "600 11px -apple-system,Segoe UI,Roboto,sans-serif";
  head.forEach(function (t, i) { x.fillText(t, cols[i], 130); });
  x.strokeStyle = "#e5e5ea"; x.beginPath(); x.moveTo(48, 142); x.lineTo(w - 48, 142); x.stroke();

  list.forEach(function (m, i) {
    var y = 166 + i * rowH;
    if (i % 2) { x.fillStyle = "#fafafa"; x.fillRect(48, y - 18, w - 96, rowH); }
    x.fillStyle = "#1d1d1f"; x.font = "600 12.5px -apple-system,Segoe UI,Roboto,sans-serif";
    x.fillText(String(m.nick || "").slice(0, 18), cols[0], y);
    x.fillStyle = "#6e6e73"; x.font = "500 12px -apple-system,Segoe UI,Roboto,sans-serif";
    x.fillText(String(m.team_name || "").slice(0, 16), cols[1], y);
    x.fillStyle = "#1d1d1f"; x.font = "600 12.5px -apple-system,Segoe UI,Roboto,sans-serif";
    x.fillText(_fmt(m.kpi), cols[2], y);
    if (VJ) {
      x.fillStyle = m.off_count ? "#ff9500" : "#86868b";
      x.fillText(String(m.off_count || 0), cols[3], y);
    } else {
      x.fillText(_fmt(m.salary), cols[3], y);
      x.fillStyle = m.off_count ? "#ff9500" : "#86868b";
      x.fillText(String(m.off_count || 0), cols[4], y);
    }
  });
  _footer(x, w, h, null);
  return o.c;
}

function _download(canvas, filename) {
  canvas.toBlob(function (blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }, "image/png");
}

function exportMemberPNG(tm, m) {
  _download(buildMemberPNG(m, tm), "board_" + (m.nick || "member") + "_" + (tm.code || "") + "_2026-11.png");
  toast(tr("成绩单已导出") + " PNG");
}
function exportMembersPNG() {
  var list = S.data.members.filter(function (m) { return S.onlyActive ? m.active : true; })
    .sort(function (a, b) { return (b.kpi || 0) - (a.kpi || 0); });
  _download(buildMembersPNG(list), "board_members_2026-11.png");
  toast(tr("全员名单已导出") + " PNG");
}

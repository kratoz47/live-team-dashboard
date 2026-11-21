
const fs = require("fs"), path = require("path");
const root = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "dashboard.json"), "utf8"));
class El {
  constructor(id){ this.id=id; this.innerHTML=""; this.textContent=""; this.style={}; this.dataset={}; this.disabled=false;
    this.classList={add(){},remove(){},toggle(){},contains(){return false}}; }
  addEventListener(){} querySelectorAll(){return []} closest(){return null}
}
const mk = (id)=>new El(id);
const map = {"#app":mk("app"),"#drawer":mk("drawer"),"#mask":mk("mask"),"#toast":mk("toast"),
  "#genAt":mk("genAt"),"#brandSub":mk("brandSub"),"#btnRebuild":mk("btnRebuild")};
global.document = { querySelector:(s)=>map[s]||mk(s), querySelectorAll:()=>[], addEventListener(){}, activeElement:{id:""},
  documentElement:{ _t:"light", setAttribute(k,v){ this[k]=v }, getAttribute(){ return this._t||"light" } } };
global.localStorage = { _d:{}, getItem(k){ return this._d[k]||null }, setItem(k,v){ this._d[k]=v } };
global.matchMedia = () => ({ matches:false });
global.window = { addEventListener(){}, scrollTo(){} };
global.location = { hash:"#/" };
global.fetch = async()=>({ ok:true, json:async()=>data });
let src = ["i18n.js","app.js","views2.js","views3.js","diagnose.js"].map(f=>fs.readFileSync(path.join(root,"web",f),"utf8")).join("\n");
src += "\nglobal.__T = {route:route, openMember:openMember, S:S};\n";
try { eval(src); } catch(e){ console.log("EVAL FAIL:", e.stack.split("\n").slice(0,4).join(" | ")); process.exit(1); }
setTimeout(()=>{
  const T = global.__T;
  const errs = [];
  function check(label, fn){
    try { const h = fn(); if(!h || h.length < 400) errs.push(label+": too short "+ (h||"").length);
      else console.log("OK  "+label+"  len="+h.length);
    } catch(e){ errs.push(label+": "+e.message+" @ "+ (e.stack||"").split("\n")[1]); }
  }
  const ov = document.querySelector("#app").innerHTML;
  console.log("overview auto-render len=", ov.length);
  T.S.data = data;
  for (const h of ["#/", "#/members", "#/reconcile"]) {
    global.location.hash = h; T.route();
    console.log("route "+h+" -> len "+document.querySelector("#app").innerHTML.length);
  }
  for (const t of data.teams) {
    global.location.hash = "#/team/"+t.code; T.route();
    const html = document.querySelector("#app").innerHTML;
    if (html.length < 3000) errs.push("team "+t.code+" short "+html.length);
  }
  console.log("all team pages rendered");
  // drawer for every member
  let n=0;
  for (const t of data.teams) for (const m of t.members) {
    try { T.openMember(t.code, m.gsheet_name || m.nick); n++; }
    catch(e){ errs.push("drawer "+t.code+"/"+m.nick+": "+e.message); }
  }
  console.log("drawers opened:", n);
  if (errs.length) { console.log("ERRORS:"); errs.slice(0,20).forEach(e=>console.log("  -",e)); process.exit(2); }
  console.log("ALL RENDER CHECKS PASSED");
}, 60);
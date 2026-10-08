(function(){
"use strict";
var KEY="bp_fasttrack_v1", VERSION=1;
var LANGS=["de","en","it","hr","pl","tr"];
var L=I18N.de;

/* ---------- State ---------- */
function blank(lang){
  return {v:VERSION,lang:lang||detectLang(),pid:uid(),consent:false,updatedAt:0,name:"",leader:"",startedAt:0,view:"start",done:{},
    diag:{},pitch:{reps:0,best:0,leaderOk:false},quiz:{},list:[],net:{},sent:{},
    talks:[],sprint:{},kpi:{},dup:{},cert:{},multi:{size:100,rate:10,levels:6}};
}
function detectLang(){
  var n=((navigator.language||"de")+"").slice(0,2).toLowerCase();
  return LANGS.indexOf(n)>=0?n:"de";
}
var S=blank();
var STATUS_DE={"NEU":"NEU","TERMIN":"TERMIN","FOLLOW-UP":"FU","ENTSCHEIDUNG":"ENT","GESTARTET":"GO","KEIN INTERESSE":"NO"};
function migrate(d){
  (d.list||[]).forEach(function(c){
    if(typeof c.cat==="string"){ var i=I18N.de.cats.indexOf(c.cat); c.cat= i>=0?i:(c.cat===""?"":0); }
    if(c.status && STATUS_DE[c.status]) c.status=STATUS_DE[c.status];
  });
  if(!d.lang) d.lang="de";
  return d;
}
function load(){
  try{ var raw=localStorage.getItem(KEY); if(raw){ var d=JSON.parse(raw); if(d && d.v===VERSION){ S=merge(blank(),migrate(d)); } } }catch(e){}
}
function merge(a,b){ for(var k in b){ if(Object.prototype.hasOwnProperty.call(b,k)) a[k]=b[k]; } return a; }
var saveT=null;
function save(){
  S.updatedAt=Date.now();
  clearTimeout(saveT); saveT=setTimeout(function(){ try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){} },150);
  scheduleSync();
}

/* ---------- Controlling-Sync (Google Sheet) ---------- */
var CFG=window.FT_CONFIG||{};
var SYNC=String(CFG.syncUrl||"").trim();
var syncT=null, lastSync=0, lastSent=0, syncState="";
function scheduleSync(){ if(!SYNC) return; clearTimeout(syncT); syncT=setTimeout(function(){ sync(false); },8000); }
function stCount(code){ return S.list.filter(function(c){return c.status===code;}).length; }
function payload(){
  var done=ORDER.filter(function(id){return S.done[id];});
  var dupDone=0; for(var i=0;i<5;i++){ if(S.dup["d"+i]) dupDone++; }
  var diag=[]; for(var j=0;j<6;j++) diag.push(S.diag["q"+j]||"");
  var kpi=[]; for(var k=0;k<6;k++) kpi.push(S.kpi["t"+k]||"");
  var t=I18N.de.types[S.diag.type];
  return {token:String(CFG.token||""),pid:S.pid,name:S.name,leader:S.leader,lang:S.lang,startedAt:S.startedAt,updatedAt:S.updatedAt,
    view:I18N.de.mods[S.view]?I18N.de.mods[S.view][0]:S.view,doneModules:done.map(function(id){return I18N.de.mods[id][0];}),doneCount:done.length,total:ORDER.length,
    pct:Math.round(done.length/ORDER.length*100),certLevel:certLevel(),diagDone:autoDone("diag"),pitchReps:S.pitch.reps,pitchBest:S.pitch.best,leaderOk:!!S.pitch.leaderOk,quizOk:quizOk(),
    list:S.list.length,top:tops().length,contacted:contacted().length,replies:S.list.filter(function(c){return c.reply;}).length,
    st:{NEU:stCount("NEU"),TERMIN:stCount("TERMIN"),FU:stCount("FU"),ENT:stCount("ENT"),GO:stCount("GO"),NO:stCount("NO")},
    talks:S.talks.length,nextSteps:nextSteps(),net:netFilled(),warm:sentTotal("warm"),cold:sentTotal("cold"),
    type:t?t[0]:"",diag:diag,kpi:kpi,dupPartner:S.dup.partner||"",dupDone:dupDone};
}
function sync(beacon){
  if(!SYNC || !S.consent || !S.startedAt) return;
  if(S.updatedAt && S.updatedAt<=lastSent) return;
  var body=JSON.stringify(payload()); lastSent=S.updatedAt||Date.now();
  try{
    if(beacon && navigator.sendBeacon){ navigator.sendBeacon(SYNC,new Blob([body],{type:"text/plain;charset=utf-8"})); return; }
    syncState="wait"; updSync();
    fetch(SYNC,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:body})
      .then(function(){ lastSync=Date.now(); syncState="ok"; updSync(); },function(){ syncState="err"; lastSent=0; updSync(); });
  }catch(e){ syncState="err"; lastSent=0; updSync(); }
}
function syncText(){
  if(!SYNC || !S.consent) return "";
  if(syncState==="err") return "⚠ "+L.ui.syncErr;
  if(syncState==="wait") return "☁ "+L.ui.syncWait;
  if(lastSync) return "☁ "+F(L.ui.syncOk,{t:fdate(lastSync,{hour:"2-digit",minute:"2-digit"})});
  return "";
}
function updSync(){ var el=document.getElementById("syncinfo"); if(el) el.textContent=syncText(); }
document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="hidden") sync(true); });
window.addEventListener("online",function(){ sync(false); });
function setLang(l){
  if(LANGS.indexOf(l)<0) l="de";
  S.lang=l; L=I18N[l]; document.documentElement.lang=l;
}

function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function F(str,o){ return String(str).replace(/\{(\w+)\}/g,function(m,k){ return o && o[k]!=null?o[k]:m; }); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function setPath(p,val){ var parts=p.split("."), o=S; for(var i=0;i<parts.length-1;i++){ if(o[parts[i]]==null||typeof o[parts[i]]!=="object") o[parts[i]]={}; o=o[parts[i]]; } o[parts[parts.length-1]]=val; }
function toast(msg){ var t=document.getElementById("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(function(){t.hidden=true;},1800); }
function copyText(txt){
  function fallback(){ var ta=document.createElement("textarea"); ta.value=txt; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,99999); var ok=false; try{ ok=document.execCommand("copy"); }catch(e){} document.body.removeChild(ta); toast(ok?L.ui.copied:L.ui.copyManual); }
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast(L.ui.copied);},fallback); } else fallback();
}
function fmt(n){ return Number(n).toLocaleString(L.locale); }
function fdate(ts,opt){ try{ return new Date(ts).toLocaleString(L.locale,opt); }catch(e){ return new Date(ts).toLocaleString(); } }

/* ---------- Structure ---------- */
var PHASES=[["start","diag","system","check"],["list","top","multi","net"],["warm","cold","pipe","talk"],["sprint","week","dup","cert"]];
var ORDER=[]; PHASES.forEach(function(p){ ORDER=ORDER.concat(p); });
function MT(id){ return L.mods[id][0]; }
var QUIZ_C=[1,0,0,0];
var STATUSES=["","NEU","TERMIN","FU","ENT","GO","NO"];
var SC_IDS={warm:["w1","w2","w3","w4"],cold:["c1","c2","c3","c4"],fu:["f1","f2","f3"]};
function scripts(g){ return L.scripts[g].map(function(s,i){ return {id:SC_IDS[g][i],t:s[0],x:s[1]}; }); }

/* ---------- Derived ---------- */
function tops(){ return S.list.filter(function(c){return c.top;}); }
function contacted(){ return S.list.filter(function(c){return !!c.status;}); }
function scoreOf(c){ return (c.t||0)+(c.p||0)+(c.s||0); }
function netFilled(){ var n=0; for(var i=0;i<5;i++){ if((S.net[i]||"").trim()) n++; } return n; }
function sentTotal(g){ var n=0; SC_IDS[g].forEach(function(id){ n+=S.sent[id]||0; }); return n; }
function quizOk(){ return QUIZ_C.every(function(c,i){ return S.quiz[i]===c; }); }
function nextSteps(){ return S.list.filter(function(c){return c.next && c.date;}).length; }
function dupAll(){ for(var i=0;i<5;i++){ if(!S.dup["d"+i]) return false; } return true; }
function autoDone(id){
  switch(id){
   case "start": return !!S.startedAt;
   case "diag": for(var i=0;i<6;i++){ if(!(S.diag["q"+i]||"").trim()) return false; } return S.diag.type!=null && S.diag.type!=="";
   case "system": return S.pitch.reps>=3;
   case "check": return quizOk() && S.pitch.leaderOk;
   case "list": return S.list.length>=100;
   case "top": return tops().length>=10;
   case "multi": return !!S.multi.seen;
   case "net": return netFilled()>=3;
   case "warm": return sentTotal("warm")>=3;
   case "cold": return sentTotal("cold")>=4;
   case "pipe": return contacted().length>=5;
   case "talk": return S.talks.length>=1;
   case "sprint": var n=0; for(var k in S.sprint) if(S.sprint[k]) n++; return n>=12;
   case "week": for(var j=0;j<6;j++){ if(S.kpi["t"+j]) return true; } return false;
   case "dup": return dupAll();
   case "cert": return certLevel()>=2;
  }
  return false;
}
function doneCount(){ var n=0; ORDER.forEach(function(id){ if(S.done[id]) n++; }); return n; }
function certLevel(){
  var certified=quizOk() && S.pitch.leaderOk;
  var active=certified && S.list.length>=100 && tops().length>=10 && contacted().length>=5 && S.talks.length>=1;
  var proven=active && dupAll();
  return proven?3:active?2:certified?1:0;
}

/* ---------- Shell ---------- */
var root=document.getElementById("root");
function langButtons(){
  return '<div class="langs" role="group" aria-label="'+esc(L.ui.language)+'">'+LANGS.map(function(l){ return '<button data-act="lang" data-v="'+l+'" class="'+(S.lang===l?"on":"")+'" title="'+esc(I18N[l].label)+'">'+l.toUpperCase()+'</button>'; }).join("")+'</div>';
}
function brand(){ return '<div class="brand">Best<span class="p">Prime</span><span class="sep">|</span>ePOINT<span class="sep">|</span>ePAY</div>'; }
function render(){
  if(!S.startedAt){ root.innerHTML=renderWelcome(); return; }
  var pct=Math.round(doneCount()/ORDER.length*100), C=2*Math.PI*24;
  var side='<aside class="side" id="side">'+brand()+
   '<div class="me"><svg class="ring" viewBox="0 0 60 60"><circle class="bgc" cx="30" cy="30" r="24"/><circle class="fgc" cx="30" cy="30" r="24" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+(C*(1-pct/100)).toFixed(1)+'" transform="rotate(-90 30 30)"/><text x="30" y="34" text-anchor="middle">'+pct+'%</text></svg>'+
   '<div style="min-width:0"><div style="font-weight:600">'+esc(S.name)+'</div><div class="small muted">'+F(L.ui.modulesOf,{a:doneCount(),b:ORDER.length})+' · '+sprintLabel()+'</div></div></div>'+langButtons();
  PHASES.forEach(function(mods,pi){
    var d=mods.filter(function(m){return S.done[m];}).length;
    side+='<div class="phase"><div class="phase-h"><span>0'+(pi+1)+' · '+L.phases[pi]+'</span><span class="tab">'+d+'/'+mods.length+'</span></div>';
    mods.forEach(function(m){
      var cls=S.done[m]?"done":(autoDone(m)?"auto":"");
      side+='<button class="nav'+(S.view===m?" on":"")+'" data-go="'+m+'"><span class="dot '+cls+'">'+(S.done[m]?"✓":(ORDER.indexOf(m)+1))+'</span><span>'+MT(m)+'</span></button>';
    });
    side+='</div>';
  });
  side+='<div class="side-foot"><div class="small muted" id="syncinfo">'+esc(syncText())+'</div><button class="btn sm ghost" data-act="backup">'+L.ui.backup+'</button></div></aside>';
  var i=ORDER.indexOf(S.view);
  root.innerHTML='<div class="app">'+side+'<div class="overlay" id="ov" data-act="closeside"></div><main class="main">'+
   '<div class="topbar"><button class="btn sm" data-act="openside">☰ '+L.ui.menu+'</button><span class="small muted tab">'+(i+1)+' / '+ORDER.length+' · '+pct+'%</span>'+
   '<select class="langsel" data-act="langsel" aria-label="'+esc(L.ui.language)+'">'+LANGS.map(function(l){ return '<option value="'+l+'"'+(S.lang===l?" selected":"")+'>'+l.toUpperCase()+'</option>'; }).join("")+'</select></div>'+
   '<div class="wrap">'+consentBanner()+(R[S.view]?R[S.view]():"")+renderFoot(S.view)+'</div></main>'+
   '<nav class="mobnav"><button class="btn" data-go="'+(ORDER[i-1]||"")+'" '+(i===0?"disabled":"")+'>'+L.ui.back+'</button><button class="btn pri" data-go="'+(ORDER[i+1]||"")+'" '+(i===ORDER.length-1?"disabled":"")+'>'+L.ui.next+'</button></nav></div>';
}
function sprintLabel(){ var h=(Date.now()-S.startedAt)/3600000; return h<72?F(L.ui.sprintLeft,{h:Math.ceil(72-h)}):L.ui.sprintOver; }
function phaseOf(id){ for(var i=0;i<PHASES.length;i++){ if(PHASES[i].indexOf(id)>=0) return i; } return 0; }
function head(id,lead){
  var p=phaseOf(id);
  return '<header class="stack"><div class="eyebrow">'+L.ui.phase+' '+(p+1)+' · '+L.phases[p]+' · '+L.mods[id][1]+'</div><h1>'+MT(id)+'</h1>'+(lead?'<p class="lead">'+lead+'</p>':'')+'</header>';
}
function task(label,txt){ return '<div class="task"><b>'+label+'</b>'+txt+'</div>'; }
function quote(q,style){ return '<div class="card"><div class="quote"'+(style?' style="'+style+'"':'')+'>'+q[0]+(q[1]?'<small>'+q[1]+'</small>':'')+'</div></div>'; }
function ul(items){ return '<ul class="clean small muted" style="margin-top:8px">'+items.map(function(x){return '<li>'+x+'</li>';}).join("")+'</ul>'; }
function renderFoot(id){
  var i=ORDER.indexOf(id), a=autoDone(id), d=!!S.done[id];
  return '<div class="modfoot noprint"><div class="row">'+
   (a?'<span class="badge b-ok">'+L.ui.critOk+'</span>':'<span class="badge b-warn">'+L.ui.critOpen+'</span>')+
   '<button class="btn '+(d?"":"gold")+'" data-act="toggleDone" data-id="'+id+'">'+(d?L.ui.doneReset:L.ui.markDone)+'</button></div>'+
   '<div class="row">'+(i>0?'<button class="btn" data-go="'+ORDER[i-1]+'">← '+MT(ORDER[i-1])+'</button>':'')+
   (i<ORDER.length-1?'<button class="btn pri" data-go="'+ORDER[i+1]+'">'+MT(ORDER[i+1])+' →</button>':'')+'</div></div>';
}

/* ---------- Welcome ---------- */
function renderWelcome(){
  var u=L.ui;
  return '<div class="welcome"><div class="row" style="justify-content:space-between">'+brand()+langButtons()+'</div>'+
   '<div class="stack"><div class="eyebrow">'+u.kicker+'</div><h1 style="font-size:clamp(40px,8vw,68px)">'+u.hero+'</h1><p class="lead">'+u.heroLead+'</p></div>'+
   '<div class="steps4">'+u.steps.map(function(s){ return '<div><b>'+s[0]+'</b><span>'+s[1]+'</span></div>'; }).join("")+'</div>'+
   '<div class="grid3">'+u.metrics.map(function(s){ return '<div class="kpi"><b>'+s[0]+'</b><span>'+s[1]+'</span></div>'; }).join("")+'</div>'+
   '<form class="card hi stack" id="startform"><h2>'+u.startTitle+'</h2>'+
   '<div class="grid2"><label class="field"><span>'+u.yourName+'</span><input type="text" id="w_name" autocomplete="name" placeholder="'+esc(u.namePh)+'" value="'+esc(draftName)+'"></label>'+
   '<label class="field"><span>'+u.leader+'</span><input type="text" id="w_leader" placeholder="'+esc(u.leaderPh)+'" value="'+esc(draftLeader)+'"></label></div>'+
   '<p class="small muted">'+u.localNote+'</p>'+
   (SYNC?'<label class="opt" style="align-items:flex-start"><input type="checkbox" id="w_consent" style="margin-top:4px"'+(draftConsent?" checked":"")+'> <span class="small">'+u.consent+'</span></label>':'')+
   '<div class="row"><button class="btn gold" type="submit">'+u.startBtn+'</button><button class="btn ghost" type="button" data-act="backup">'+u.loadBackup+'</button></div></form>'+
   '<div id="backupbox"></div></div>';
}
var draftName="", draftLeader="", draftConsent=false;
function consentBanner(){
  if(!SYNC || S.consent) return "";
  return '<div class="card hi stack noprint"><h3>'+L.ui.consentTitle+'</h3><p class="small muted">'+L.ui.consent+'</p><div><button class="btn gold sm" data-act="consent">'+L.ui.consentBtn+'</button></div></div>';
}

/* ---------- Modules ---------- */
var R={};
R.start=function(){
  var m=L.m.start, h=(Date.now()-S.startedAt)/3600000, left=Math.max(0,72-h);
  var out=head("start",m.lead)+'<div class="grid2">';
  m.cards.forEach(function(t,i){ out+='<div class="card'+(i===0?" hi":"")+'"><span class="label">'+L.ui.phase+' '+(i+1)+'</span><h3>'+L.phases[i]+'</h3><p class="muted">'+t+'</p></div>'; });
  out+='</div><div class="card"><div class="row" style="justify-content:space-between"><div><span class="label">'+m.sprint+'</span><div class="kpi"><b class="tab">'+(left>0?Math.floor(left)+" h "+Math.round((left%1)*60)+" min":m.expired)+'</b><span>'+F(m.started,{d:fdate(S.startedAt,{dateStyle:"medium",timeStyle:"short"})})+'</span></div></div>'+
   '<div style="flex:1;min-width:200px"><div class="bar"><i style="width:'+Math.min(100,h/72*100).toFixed(1)+'%"></i></div><div class="row small muted" style="justify-content:space-between;margin-top:6px">'+m.tl.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div></div></div></div>'+
   quote(m.quote)+
   '<div class="grid2"><label class="field"><span>'+L.ui.yourName+'</span><input type="text" id="s_name" data-bind="name" value="'+esc(S.name)+'"></label><label class="field"><span>'+L.ui.leader+'</span><input type="text" id="s_leader" data-bind="leader" value="'+esc(S.leader)+'"></label></div>'+
   task(L.ui.lbl.first,m.task);
  return out;
};

R.diag=function(){
  var m=L.m.diag, h=head("diag",m.lead)+'<div class="grid3">';
  m.cols.forEach(function(c){ h+='<div class="card"><span class="label">'+c[0]+'</span><h3>'+c[1]+'</h3>'+ul(c[2])+'</div>'; });
  h+='</div><div class="card stack"><h2>'+m.form+'</h2>';
  L.diagQ.forEach(function(q,i){ h+='<label class="field"><span>'+(i+1)+'. '+q+'</span><textarea id="dq'+i+'" data-bind="diag.q'+i+'" rows="2">'+esc(S.diag["q"+i])+'</textarea></label>'; });
  h+='</div><div class="stack"><h2>'+m.type+'</h2><div class="grid4">';
  L.types.forEach(function(t,i){ var on=String(S.diag.type)===String(i); h+='<button class="card" style="text-align:left;cursor:pointer;'+(on?"border-color:var(--gold);":"")+'" data-act="setType" data-v="'+i+'"><h3 style="'+(on?"color:var(--gold)":"")+'">'+(on?"✓ ":"")+t[0]+'</h3><p class="small muted">'+t[1]+'</p></button>'; });
  h+='</div></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.system=function(){
  var m=L.m.system, h=head("system",m.lead)+'<div class="grid3">';
  m.sys.forEach(function(s,i){ h+='<div class="card'+(i===0?" hi":"")+'"><span class="label">'+s[0]+'</span><h3>'+s[1]+'</h3><p class="small muted" style="margin-top:6px">'+s[2]+'</p></div>'; });
  h+='</div><div class="flow">'+m.flow.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div><div class="grid3">';
  m.ben.forEach(function(b){ h+='<div class="card"><h3>'+b[0]+'</h3>'+ul(b[1])+'</div>'; });
  h+='</div><div class="card stack"><span class="label">'+m.coreL+'</span><p style="font-size:16px">'+m.core+'</p></div>';
  h+='<div class="card hi stack"><h2>'+m.tr+'</h2><p class="muted small">'+m.trHint+'</p>'+
   '<div class="row" style="justify-content:space-between"><div class="timer tab" id="timer">60</div>'+
   '<div class="row"><button class="btn pri" data-act="pitchStart" id="pitchBtn">'+m.start+'</button><button class="btn" data-act="pitchReset">'+m.reset+'</button></div></div>'+
   '<div class="grid3"><div class="kpi"><b class="tab">'+S.pitch.reps+'</b><span>'+m.reps+'</span></div><div class="kpi"><b class="tab">'+(S.pitch.best?S.pitch.best+" s":"–")+'</b><span>'+m.best+'</span></div><div class="kpi"><b>'+(S.pitch.reps>=3?"✓":"–")+'</b><span>'+m.ready+'</span></div></div></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.check=function(){
  var m=L.m.check, h=head("check",m.lead)+'<div class="stack">';
  L.quiz.forEach(function(q,i){
    var ans=S.quiz[i], c=QUIZ_C[i], self=i===3;
    h+='<div class="card stack"><h3>'+(i+1)+'. '+q.q+'</h3><div class="grid2">';
    q.a.forEach(function(a,j){
      var cls="opt"; if(ans===j) cls+=(c===j?" right":" wrong");
      h+='<button class="'+cls+'" data-act="quiz" data-q="'+i+'" data-a="'+j+'"><span class="dot'+(ans===j?" done":"")+'">'+(ans===j?"✓":"")+'</span>'+a+'</button>';
    });
    h+='</div>';
    if(ans!=null) h+= ans===c?'<p class="small" style="color:var(--ok)">'+(self?m.selfRight:m.right)+'</p>':'<p class="small" style="color:var(--bad)">'+(self?m.selfWrong:m.wrong)+'</p>';
    h+='</div>';
  });
  h+='</div><div class="card" style="background:var(--panel2)"><span class="muted">'+m.qrule+'</span></div>'+
  '<div class="card hi stack"><h2>'+m.unlock+'</h2><p class="muted small">'+m.unlockHint+'</p>'+
  '<label class="opt'+(S.pitch.leaderOk?" sel":"")+'"><input type="checkbox" id="leaderok" data-bind="pitch.leaderOk" '+(S.pitch.leaderOk?"checked":"")+'> '+F(m.leaderOk,{l:S.leader?" ("+esc(S.leader)+")":""})+'</label>'+
  '<p class="small">'+(quizOk()&&S.pitch.leaderOk?'<span class="badge b-ok">'+m.unlocked+'</span>':'<span class="badge b-warn">'+m.locked+'</span>')+'</p></div>';
  return h;
};

var addCat=0, listFilter="";
function catName(c){ return (c===""||c==null)?"":(L.cats[c]||""); }
R.list=function(){
  var m=L.m.list, n=S.list.length;
  var h=head("list",m.lead);
  h+='<div class="card stack"><div class="row" style="justify-content:space-between"><div class="kpi"><b class="tab">'+n+' / 100</b><span>'+m.count+'</span></div><span class="badge '+(n>=100?"b-ok":n>=30?"b-warn":"b-mut")+'">'+(n>=100?m.goal:n>=30?m.go100:m.min30)+'</span></div>'+
   '<div class="bar"><i style="width:'+Math.min(100,n)+'%"></i></div><p class="small muted">'+m.rules+'</p></div>';
  h+='<form class="card stack" id="addform"><h3>'+m.add+'</h3><div class="grid2"><label class="field"><span>'+m.name+'</span><input type="text" id="add_name" placeholder="'+esc(m.namePh)+'" autocomplete="off"></label><label class="field"><span>'+m.ctx+'</span><input type="text" id="add_ctx" placeholder="'+esc(m.ctxPh)+'"></label></div>'+
   '<div class="row" id="catpills">'+L.cats.map(function(c,i){ return '<button type="button" class="pill'+(addCat===i?" on":"")+'" data-act="addCat" data-v="'+i+'">'+c+'</button>'; }).join("")+'</div>'+
   '<div class="row"><button class="btn pri" type="submit">'+m.addBtn+'</button><span class="small muted">'+m.tip+'</span></div>'+
   '<details><summary class="small" style="cursor:pointer;color:var(--teal)">'+m.bulk+'</summary><div class="stack" style="margin-top:8px"><textarea id="bulk" placeholder="'+esc(m.bulkPh)+'"></textarea><button type="button" class="btn sm" data-act="bulkAdd">'+m.bulkBtn+'</button></div></details></form>';
  h+='<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h3>'+m.yours+'</h3>'+(n?'<input type="text" id="lfilter" placeholder="'+esc(m.search)+'" style="max-width:220px" value="'+esc(listFilter)+'">':'')+'</div>';
  if(!n) h+='<p class="muted small">'+m.empty+'</p>';
  var f=listFilter.toLowerCase();
  S.list.forEach(function(c,i){
    if(f && (c.name+" "+(c.ctx||"")+" "+catName(c.cat)).toLowerCase().indexOf(f)<0) return;
    h+='<div class="listrow"><span class="n tab">'+(i+1)+'</span><input type="text" value="'+esc(c.name)+'" data-cbind="'+c.id+'.name" aria-label="'+esc(m.name)+'"><input class="ctx" type="text" value="'+esc(c.ctx||"")+'" placeholder="'+esc(m.ctxCol)+'" data-cbind="'+c.id+'.ctx" aria-label="'+esc(m.ctxCol)+'">'+
     '<select class="cat" data-cbind="'+c.id+'.cat" aria-label="'+esc(m.cat)+'"><option value="">'+m.cat+'</option>'+L.cats.map(function(k,ki){return '<option value="'+ki+'"'+(String(c.cat)===String(ki)?" selected":"")+'>'+k+'</option>';}).join("")+'</select>'+
     '<button class="iconbtn" data-act="delC" data-id="'+c.id+'" title="'+esc(m.remove)+'" aria-label="'+esc(m.remove)+'">×</button></div>';
  });
  h+='</div>';
  return h+task(L.ui.lbl.today,m.task);
};

function stars(c,k){ var v=c[k]||0, s='<td><div class="stars">'; for(var i=1;i<=5;i++) s+='<button class="'+(i<=v?"on":"")+'" data-act="rate" data-id="'+c.id+'" data-k="'+k+'" data-v="'+i+'" aria-label="'+i+'">'+i+'</button>'; return s+'</div></td>'; }
R.top=function(){
  var m=L.m.top, h=head("top",m.lead)+'<div class="grid4">';
  m.crit.forEach(function(c){ h+='<div class="card"><h3>'+c[0]+'</h3><p class="small muted">'+c[1]+'</p></div>'; });
  h+='</div>';
  if(!S.list.length) return h+'<div class="card"><p class="muted">'+m.empty+'</p><div style="margin-top:10px"><button class="btn pri" data-go="list">'+m.toList+'</button></div></div>';
  var sorted=S.list.slice().sort(function(a,b){ return (b.top?1:0)-(a.top?1:0) || scoreOf(b)-scoreOf(a); });
  var tc=tops().length;
  h+='<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3>'+m.rate+'</h3><span class="badge '+(tc>=10?"b-ok":"b-warn")+' tab">'+F(m.of,{n:tc})+'</span></div><p class="small muted" style="margin-bottom:8px">'+m.hint+'</p><div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>';
  sorted.forEach(function(c){
    h+='<tr><td><input type="checkbox" data-act="topToggle" data-id="'+c.id+'" '+(c.top?"checked":"")+' '+(!c.top&&tc>=10?"disabled":"")+' aria-label="TOP"></td><td style="min-width:140px"><b>'+esc(c.name)+'</b>'+(catName(c.cat)?'<div class="small muted">'+catName(c.cat)+'</div>':'')+'</td>'+
      stars(c,"t")+stars(c,"p")+stars(c,"s")+'<td class="tab"><b>'+scoreOf(c)+'</b></td><td>'+(c.top?'<input type="checkbox" data-act="first5" data-id="'+c.id+'" '+(c.first5?"checked":"")+' aria-label="'+esc(m.cols[6])+'">':'')+'</td></tr>';
  });
  h+='</tbody></table></div></div>'+quote(m.quote);
  return h+task(L.ui.lbl.task,m.task);
};

function multiRows(){
  var m=S.multi, size=Math.max(1,+m.size||100), r=Math.max(0,+m.rate||0)/100, Lv=Math.min(8,Math.max(1,+m.levels||6)), act=1, out="";
  for(var i=1;i<=Lv;i++){ var lst=act*size, nw=Math.round(lst*r); out+='<tr><td><b>'+L.m.multi.lv+i+'</b></td><td class="tab">'+fmt(act)+'</td><td class="tab">'+fmt(lst)+'</td><td class="tab" style="color:var(--teal)"><b>'+fmt(nw)+'</b></td></tr>'; act=nw; if(!act) break; }
  return out;
}
R.multi=function(){
  if(!S.multi.seen){ S.multi.seen=true; save(); }
  var m=L.m.multi, mm=S.multi;
  return head("multi",m.lead)+
   '<div class="card stack"><p class="muted">'+m.idea+'</p>'+
   '<div class="grid3"><label class="field"><span>'+m.size+'</span><input type="number" id="m_size" min="10" max="500" step="10" data-mbind="size" value="'+mm.size+'"></label><label class="field"><span>'+m.rate+'</span><input type="number" id="m_rate" min="1" max="50" step="1" data-mbind="rate" value="'+mm.rate+'"></label><label class="field"><span>'+m.levels+'</span><input type="number" id="m_lv" min="1" max="8" step="1" data-mbind="levels" value="'+mm.levels+'"></label></div>'+
   '<div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody id="multibody">'+multiRows()+'</tbody></table></div></div>'+
   '<div class="grid2"><div class="card"><h3>'+m.learnT+'</h3><p class="muted small" style="margin-top:6px">'+m.learn+'</p></div>'+
   '<div class="card" style="border-color:var(--warn)"><h3>'+m.notT+'</h3><p class="muted small" style="margin-top:6px">'+m.not+'</p></div></div>'+
   task(L.ui.lbl.mantra,m.task);
};

R.net=function(){
  var m=L.m.net, h=head("net",m.lead)+'<div class="grid3">';
  m.cols.forEach(function(c){ h+='<div class="card"><span class="label">'+c[0]+'</span><h3>'+c[1]+'</h3><p class="small muted" style="margin-top:6px">'+c[2]+'</p></div>'; });
  h+='</div><div class="card stack"><div class="row" style="justify-content:space-between"><h2>'+m.title+'</h2><span class="badge '+(netFilled()>=3?"b-ok":"b-warn")+'">'+F(m.answered,{n:netFilled()})+'</span></div>';
  L.netQ.forEach(function(q,i){ h+='<label class="field"><span>'+q+m.suffix+'</span><input type="text" id="nq'+i+'" data-bind="net.'+i+'" value="'+esc(S.net[i]||"")+'"></label>'; });
  h+='</div>'+quote(m.quote);
  return h+task(L.ui.lbl.task,m.task);
};

var pick={warm:"",cold:"",fu:""};
function findC(id){ return S.list.filter(function(c){return c.id===id;})[0]; }
function fill(x,who){ return who? x.split(L.ph).join(who.name.split(" ")[0]) : x; }
function hl(s){ return s.replace(/\[[^\]]+\]/g,function(mm){return "<mark>"+mm+"</mark>";}); }
function scriptBlock(g,title){
  var sc=L.m.sc;
  var opts='<option value="">'+esc(F(sc.manual,{ph:L.ph}))+'</option>'+S.list.slice().sort(function(a,b){return (b.top?1:0)-(a.top?1:0);}).map(function(c){ return '<option value="'+c.id+'"'+(pick[g]===c.id?" selected":"")+'>'+(c.top?"★ ":"")+esc(c.name)+'</option>'; }).join("");
  var who=findC(pick[g]);
  var h='<div class="card stack"><div class="row" style="justify-content:space-between"><h2>'+title+'</h2><label class="field" style="min-width:220px;flex:0 1 280px"><span>'+sc.forWho+'</span><select id="pick_'+g+'" data-act="pick" data-g="'+g+'">'+opts+'</select></label></div><div class="grid2">';
  scripts(g).forEach(function(s){
    var txt=fill(s.x,who);
    h+='<div class="script"><div class="t">'+s.t+'</div><p>'+hl(esc(txt))+'</p><div class="row"><button class="btn sm pri" data-act="copyScript" data-id="'+s.id+'" data-g="'+g+'">'+sc.copy+'</button>'+
     '<a class="btn sm" href="https://wa.me/?text='+encodeURIComponent(txt)+'" target="_blank" rel="noopener" data-act="waScript" data-id="'+s.id+'" data-g="'+g+'">WhatsApp</a>'+
     '<span class="small muted tab">'+(S.sent[s.id]?F(sc.used,{n:S.sent[s.id]}):"")+'</span></div></div>';
  });
  return h+'</div></div>';
}

R.warm=function(){
  var m=L.m.warm;
  return head("warm",m.lead)+scriptBlock("warm",L.m.sc.templates)+'<p class="small muted">'+m.note+'</p>'+
   '<div class="grid2"><div class="card"><h3 style="color:var(--ok)">'+m.doT+'</h3>'+ul(m.do)+'</div><div class="card"><h3 style="color:var(--bad)">'+m.dontT+'</h3>'+ul(m.dont)+'</div></div>'+
   task(L.ui.lbl.task,m.task+' ('+sentTotal("warm")+' / 3)');
};
R.cold=function(){
  var m=L.m.cold;
  return head("cold",m.lead)+scriptBlock("cold",L.m.sc.templates)+
   '<div class="card stack"><h2>'+m.f4T+'</h2><div class="flow">'+m.f4.map(function(x,i){ return '<span>'+(i+1)+'. '+x[0]+'<br><small class="muted">'+x[1]+'</small></span>'; }).join("")+'</div>'+
   '<div class="grid2">'+m.f4.map(function(x,i){ return '<label class="field"><span>'+(i+1)+'. '+x[0]+'</span><textarea id="f4'+i+'" data-bind="sent.f4_'+i+'" rows="2">'+esc(S.sent["f4_"+i]||"")+'</textarea></label>'; }).join("")+'</div>'+
   '<div class="row"><button class="btn pri" data-act="copy4">'+m.copy4+'</button></div></div>'+
   task(L.ui.lbl.task,m.task+' ('+sentTotal("cold")+' / 4)');
};

R.pipe=function(){
  var m=L.m.pipe, st=L.status, h=head("pipe",m.lead)+'<div class="grid4">';
  m.steps.forEach(function(s){ h+='<div class="card"><span class="label">'+s[0]+'</span><p class="small muted">'+s[1]+'</p></div>'; });
  h+='</div>';
  var counts={}; S.list.forEach(function(c){ if(c.status) counts[c.status]=(counts[c.status]||0)+1; });
  h+='<div class="card stack"><div class="row">'+STATUSES.slice(1).map(function(s){ return '<span class="badge b-mut">'+st[s]+' <b class="tab" style="color:var(--fg)">'+(counts[s]||0)+'</b></span>'; }).join("")+'</div>';
  var rows=S.list.filter(function(c){ return c.top || c.status; });
  if(!rows.length) h+='<p class="muted small">'+m.empty+'</p>';
  else{
    var today=new Date().toISOString().slice(0,10);
    h+='<div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>';
    rows.sort(function(a,b){ return (a.date||"9999").localeCompare(b.date||"9999"); }).forEach(function(c){
      var overdue=c.date && c.date<today && c.status!=="GO" && c.status!=="NO";
      h+='<tr><td style="min-width:130px"><b>'+esc(c.name)+'</b>'+(c.top?' <span class="small" style="color:var(--gold)">★</span>':'')+'</td>'+
       '<td><select data-cbind="'+c.id+'.status" data-rr="1" style="min-width:150px" aria-label="Status">'+STATUSES.map(function(s){return '<option value="'+s+'"'+((c.status||"")===s?" selected":"")+'>'+(s?st[s]:st.open)+'</option>';}).join("")+'</select></td>'+
       '<td><input type="text" style="min-width:170px" value="'+esc(c.next||"")+'" placeholder="'+esc(m.nextPh)+'" data-cbind="'+c.id+'.next"></td>'+
       '<td><input type="date" value="'+esc(c.date||"")+'" data-cbind="'+c.id+'.date" style="'+(overdue?"border-color:var(--bad)":"")+'"></td>'+
       '<td><input type="checkbox" data-cbind="'+c.id+'.reply" '+(c.reply?"checked":"")+' aria-label="'+esc(m.cols[4])+'"></td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div>'+scriptBlock("fu",L.m.sc.fu);
  return h+task(L.ui.lbl.task,m.task);
};

R.talk=function(){
  var m=L.m.talk;
  var h=head("talk",m.lead)+'<div class="grid2"><div class="card"><span class="label">'+m.pL+'</span><h3>'+m.qT+'</h3><ol class="small" style="margin-top:8px">'+m.pq.map(function(q){return '<li>'+q+'</li>';}).join("")+'</ol></div>'+
   '<div class="card"><span class="label">'+m.mL+'</span><h3>'+m.qT+'</h3><ol class="small" style="margin-top:8px">'+m.mq.map(function(q){return '<li>'+q+'</li>';}).join("")+'</ol></div></div>'+
   '<div class="flow">'+m.flow.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div>'+quote(m.quote);
  var ids=["t_who","t_lever","t_q","t_next"];
  h+='<form class="card stack" id="talkform"><h2>'+m.prot+'</h2><div class="grid2">'+m.f.map(function(l,i){ return '<label class="field"><span>'+l+'</span><input type="text" id="'+ids[i]+'"'+(i===0?' list="contacts" required':'')+'></label>'; }).join("")+'</div>'+
   '<datalist id="contacts">'+S.list.map(function(c){return '<option value="'+esc(c.name)+'">';}).join("")+'</datalist><div><button class="btn pri" type="submit">'+m.save+'</button></div></form>';
  if(S.talks.length){
    h+='<div class="card"><div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'<th></th></tr></thead><tbody>';
    S.talks.forEach(function(t,i){ h+='<tr><td class="tab small">'+fdate(t.at,{dateStyle:"short"})+'</td><td><b>'+esc(t.who)+'</b></td><td>'+esc(t.lever)+'</td><td>'+esc(t.q)+'</td><td>'+esc(t.next)+'</td><td><button class="iconbtn" data-act="delTalk" data-i="'+i+'" aria-label="'+esc(m.del)+'">×</button></td></tr>'; });
    h+='</tbody></table></div></div>';
  }
  return h+task(L.ui.lbl.task,m.task);
};

R.sprint=function(){
  var m=L.m.sprint, h=head("sprint",m.lead)+'<div class="grid3">';
  L.sprint.forEach(function(b,bi){
    h+='<div class="card stack" style="border-top:3px solid var(--teal)"><div><h2>'+b[0]+'</h2><p class="small muted">'+b[1]+'</p></div>';
    b[2].forEach(function(t,ti){ var k="s"+bi+"_"+ti; h+='<label class="row small" style="cursor:pointer;flex-wrap:nowrap"><input type="checkbox" id="sp'+k+'" data-bind="sprint.'+k+'" '+(S.sprint[k]?"checked":"")+'> <span>'+t+'</span></label>'; });
    h+='</div>';
  });
  h+='</div>';
  var vals=[S.list.length,tops().length,contacted().length,S.list.filter(function(c){return c.reply;}).length,S.talks.length,nextSteps()];
  h+='<div class="card hi stack"><h2>'+m.sc+'</h2><p class="small muted">'+m.scHint+'</p><div class="grid3">'+vals.map(function(v,i){ return '<div class="kpi"><b class="tab">'+v+'</b><span>'+m.k[i]+'</span></div>'; }).join("")+'</div></div>'+quote(m.quote);
  return h+task(L.ui.lbl.rule,m.task);
};

R.week=function(){
  var m=L.m.week, h=head("week",m.lead)+'<div class="grid3">';
  m.days.forEach(function(d,i){ h+='<div class="card'+(i===0?" hi":"")+'"><span class="label">'+d[0]+'</span><h3>'+d[1]+'</h3><p class="small muted">'+d[2]+'</p></div>'; });
  h+='</div><div class="card"><h2 style="margin-bottom:8px">'+m.title+'</h2><div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>';
  L.kpis.forEach(function(k,i){ h+='<tr><td>'+k+'</td><td><input type="number" min="0" id="kt'+i+'" data-bind="kpi.t'+i+'" value="'+esc(S.kpi["t"+i]||"")+'" style="max-width:110px"></td><td><input type="number" min="0" id="kn'+i+'" data-bind="kpi.n'+i+'" value="'+esc(S.kpi["n"+i]||"")+'" style="max-width:110px"></td></tr>'; });
  h+='</tbody></table></div><div class="row" style="margin-top:12px"><button class="btn sm" data-act="weekNext">'+m.close+'</button></div></div>'+
   '<div class="card" style="background:var(--panel2)"><span class="muted">'+m.imp+'</span></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.dup=function(){
  var m=L.m.dup;
  var h=head("dup",m.lead)+'<div class="flow">'+m.flow.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div>'+
   '<div class="grid2"><div class="card"><h3>'+m.notT+'</h3>'+ul(m.not)+'</div><div class="card hi"><h3>'+m.insT+'</h3>'+ul(m.ins)+'</div></div>'+
   '<div class="card stack"><h2>'+m.title+'</h2><label class="field"><span>'+m.partner+'</span><input type="text" id="dupname" data-bind="dup.partner" value="'+esc(S.dup.partner||"")+'"></label><div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>';
  L.dupSteps.forEach(function(s,i){ h+='<tr><td>'+s+'</td><td><input type="date" id="dt'+i+'" data-bind="dup.t'+i+'" value="'+esc(S.dup["t"+i]||"")+'"></td><td><input type="checkbox" id="dd'+i+'" data-bind="dup.d'+i+'" '+(S.dup["d"+i]?"checked":"")+' aria-label="'+esc(m.cols[2])+'"></td></tr>'; });
  h+='</tbody></table></div><div class="row"><button class="btn sm" data-act="copyLink">'+m.link+'</button><span class="small muted">'+m.linkHint+'</span></div></div>'+quote(m.quote);
  return h+task(L.ui.lbl.task,m.task);
};

R.cert=function(){
  var m=L.m.cert, lv=certLevel();
  var auto=[S.pitch.leaderOk&&quizOk(), S.list.length>=100, tops().length>=10, netFilled()>=3, contacted().length>=5, S.talks.length>=1, S.list.some(function(c){return c.next&&c.date;})];
  var h=head("cert",m.lead)+'<div class="grid3">';
  m.lv.forEach(function(x,i){ h+='<div class="card'+(lv>i?" hi":"")+'"><span class="label">'+x[0]+'</span><h3>'+x[1]+'</h3><p class="small muted">'+x[2]+'</p></div>'; });
  h+='</div><div class="card"><h2 style="margin-bottom:8px">'+m.check+'</h2><div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>';
  L.certQ.forEach(function(q,i){ h+='<tr><td>'+q+'</td><td>'+(auto[i]?'<span class="badge b-ok">'+m.met+'</span>':'<span class="badge b-mut">'+m.open+'</span>')+'</td><td><input type="checkbox" id="cl'+i+'" data-bind="cert.l'+i+'" '+(S.cert["l"+i]?"checked":"")+' aria-label="'+esc(m.cols[2])+'"></td></tr>'; });
  h+='</tbody></table></div><div class="grid2" style="margin-top:12px"><label class="field"><span>'+m.leader+'</span><input type="text" id="c_leader" data-bind="leader" value="'+esc(S.leader)+'"></label><label class="field"><span>'+m.date+'</span><input type="date" id="c_date" data-bind="cert.date" value="'+esc(S.cert.date||"")+'"></label></div></div>';
  var names=[m.none,m.lv[0][0],m.lv[1][0],m.lv[2][0]];
  h+='<div class="cert">'+brand()+'<div class="eyebrow" style="color:var(--gold)">Global Sales Academy · FastTrack</div>'+
   '<h1>'+esc(S.name||m.yourName)+'</h1><p class="muted">'+m.did+'</p>'+
   '<div class="lv">'+m.lv.map(function(x,i){ return '<span class="'+(lv>i?"on":"")+'">'+(lv>i?"✓ ":"")+x[0]+'</span>'; }).join("")+'</div>'+
   '<p class="small muted">'+m.status+': <b style="color:var(--gold)">'+names[lv]+'</b>'+(S.leader?' · Leader: '+esc(S.leader):'')+(S.cert.date?' · '+fdate(S.cert.date+"T12:00:00",{dateStyle:"medium"}):'')+'</p>'+
   (inFrame?'':'<button class="btn sm noprint" data-act="print">'+m.print+'</button>')+'</div>';
  h+='<div class="grid2"><div class="card"><h3>'+m.salesT+'</h3>'+ul(m.sales)+'</div><div class="card hi"><h3>'+m.scaleT+'</h3>'+ul(m.scale)+'</div></div>'+quote([m.chain],"text-align:center");
  return h+task(L.ui.lbl.next,m.task);
};

/* ---------- Backup ---------- */
var inFrame=(function(){ try{ return window.self!==window.top; }catch(e){ return true; } })();
function backupHTML(){
  var b=L.m.bk;
  return '<div class="card stack" id="backupcard"><div class="row" style="justify-content:space-between"><h2>'+b.title+'</h2><button class="btn sm ghost" data-act="closeBackup">'+b.close+'</button></div>'+
   '<p class="small muted">'+b.hint+'</p>'+
   '<div class="row"><button class="btn pri" data-act="exportFile">'+b.file+'</button><button class="btn" data-act="exportCopy">'+b.copy+'</button></div>'+
   '<label class="field"><span>'+b.loadL+'</span><input type="file" id="impfile" accept=".json,application/json"></label>'+
   '<textarea id="impcode" placeholder="'+esc(b.codePh)+'"></textarea><div class="row"><button class="btn gold" data-act="importCode">'+b.load+'</button></div>'+
   '<details><summary class="small" style="cursor:pointer;color:var(--bad)">'+b.resetSum+'</summary><div class="row" style="margin-top:8px"><button class="btn sm" style="border-color:var(--bad);color:var(--bad)" data-act="resetAll">'+b.resetBtn+'</button></div></details></div>';
}
function showBackup(){
  var box=document.getElementById("backupbox");
  if(box){ box.innerHTML=backupHTML(); box.scrollIntoView({behavior:"smooth"}); return; }
  var w=document.querySelector(".wrap"), d=document.createElement("div"); d.id="backupbox"; d.innerHTML=backupHTML(); w.insertBefore(d,w.firstChild); closeSide(); window.scrollTo(0,0);
}
function importData(txt){
  try{ var d=JSON.parse(txt); if(!d || d.v!==VERSION || !Array.isArray(d.list)) throw 0; S=merge(blank(),migrate(d)); setLang(S.lang); save(); render(); toast(L.m.bk.loaded); }
  catch(e){ toast(L.m.bk.invalid); }
}
function exportFile(){
  var name="fasttrack-"+(S.name||"partner").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+new Date().toISOString().slice(0,10)+".json";
  var data=JSON.stringify(S,null,1);
  if(window.claude && typeof window.claude.use==="function"){
    window.claude.use("downloads").then(function(dl){
      if(!dl){ copyText(data); return; }
      dl.save({filename:name,data:new Blob([data],{type:"application/json"})}).then(function(){toast(L.m.bk.saved);},function(){ toast(L.m.bk.canceled); });
    },function(){ copyText(data); });
    return;
  }
  var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:"application/json"})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); },500);
}

/* ---------- Events ---------- */
function go(id){ if(!id||!L.mods[id]) return; S.view=id; save(); render(); window.scrollTo(0,0); try{ history.replaceState(null,"","#"+id); }catch(e){} }
function closeSide(){ var s=document.getElementById("side"), o=document.getElementById("ov"); if(s) s.classList.remove("open"); if(o) o.classList.remove("open"); }
function markContacted(g){ var c=findC(pick[g]); if(c && !c.status) c.status="NEU"; }
function switchLang(l){
  var n=document.getElementById("w_name"), ld=document.getElementById("w_leader");
  var cs=document.getElementById("w_consent");
  if(n) draftName=n.value; if(ld) draftLeader=ld.value; if(cs) draftConsent=cs.checked;
  setLang(l); save(); render();
}

document.addEventListener("click",function(e){
  var g=e.target.closest("[data-go]"); if(g && !g.disabled){ go(g.getAttribute("data-go")); return; }
  var el=e.target.closest("[data-act]"); if(!el) return;
  var a=el.getAttribute("data-act"), id=el.getAttribute("data-id");
  switch(a){
   case "lang": switchLang(el.getAttribute("data-v")); break;
   case "consent": S.consent=true; save(); render(); sync(false); break;
   case "openside": document.getElementById("side").classList.add("open"); document.getElementById("ov").classList.add("open"); break;
   case "closeside": closeSide(); break;
   case "toggleDone": S.done[id]=!S.done[id]; save(); render(); if(S.done[id]) toast(L.ui.toastDone); break;
   case "setType": S.diag.type=+el.getAttribute("data-v"); save(); render(); break;
   case "quiz": S.quiz[+el.getAttribute("data-q")]=+el.getAttribute("data-a"); save(); render(); break;
   case "pitchStart": pitchToggle(); break;
   case "pitchReset": pitchStop(false); S.pitch={reps:0,best:0,leaderOk:S.pitch.leaderOk}; save(); render(); break;
   case "addCat": addCat=+el.getAttribute("data-v"); [].forEach.call(document.querySelectorAll("#catpills .pill"),function(p){p.classList.toggle("on",p===el);}); break;
   case "bulkAdd": var lines=document.getElementById("bulk").value.split(/\n+/).map(function(s){return s.trim();}).filter(Boolean); lines.forEach(function(n){ S.list.push({id:uid(),name:n,ctx:"",cat:addCat}); }); save(); render(); toast(F(L.m.list.bulkToast,{n:lines.length})); break;
   case "delC": S.list=S.list.filter(function(c){return c.id!==id;}); save(); render(); break;
   case "rate": var c=findC(id); c[el.getAttribute("data-k")]=+el.getAttribute("data-v"); save(); render(); break;
   case "copyScript": var grp=el.getAttribute("data-g"), sc=scripts(grp).filter(function(s){return s.id===id;})[0]; copyText(fill(sc.x,findC(pick[grp]))); S.sent[id]=(S.sent[id]||0)+1; markContacted(grp); save(); setTimeout(render,50); break;
   case "waScript": S.sent[id]=(S.sent[id]||0)+1; markContacted(el.getAttribute("data-g")); save(); setTimeout(render,300); break;
   case "copy4": var t=[0,1,2,3].map(function(i){return (S.sent["f4_"+i]||"").trim();}).filter(Boolean).join(" "); if(t) copyText(t); else toast(L.m.cold.fill4); break;
   case "delTalk": S.talks.splice(+el.getAttribute("data-i"),1); save(); render(); break;
   case "weekNext": for(var i=0;i<6;i++) S.kpi["t"+i]=""; save(); render(); toast(L.m.week.closed); break;
   case "copyLink": copyText(location.href.split("#")[0]+"#"+S.lang); break;
   case "print": window.print(); break;
   case "backup": showBackup(); break;
   case "closeBackup": var b=document.getElementById("backupbox"); if(b){ if(S.startedAt) b.parentNode.removeChild(b); else b.innerHTML=""; } break;
   case "exportFile": exportFile(); break;
   case "exportCopy": copyText(JSON.stringify(S)); break;
   case "importCode": var v=document.getElementById("impcode").value.trim(); if(v) importData(v); else toast(L.m.bk.need); break;
   case "resetAll": try{ localStorage.removeItem(KEY); }catch(err){} S=blank(S.lang); lastSent=0; lastSync=0; render(); toast(L.m.bk.reset); break;
  }
});
document.addEventListener("change",function(e){
  var el=e.target, act=el.getAttribute("data-act");
  if(el.id==="impfile" && el.files && el.files[0]){ var r=new FileReader(); r.onload=function(){ importData(String(r.result)); }; r.readAsText(el.files[0]); return; }
  if(act==="langsel"){ switchLang(el.value); return; }
  if(act==="topToggle"){ var c=findC(el.getAttribute("data-id")); c.top=el.checked; if(!c.top) c.first5=false; save(); render(); return; }
  if(act==="first5"){ var c2=findC(el.getAttribute("data-id")), n5=S.list.filter(function(x){return x.first5;}).length; if(el.checked && n5>=5){ el.checked=false; toast(L.m.top.max5); return; } c2.first5=el.checked; save(); return; }
  if(act==="pick"){ pick[el.getAttribute("data-g")]=el.value; render(); return; }
  if(el.hasAttribute("data-cbind") && (el.tagName==="SELECT"||el.type==="checkbox"||el.type==="date")){ cbind(el); if(el.hasAttribute("data-rr")) render(); return; }
  if(el.hasAttribute("data-bind") && el.type==="checkbox"){ setPath(el.getAttribute("data-bind"),el.checked); save(); render(); return; }
});
document.addEventListener("input",function(e){
  var el=e.target;
  if(el.hasAttribute("data-bind") && el.type!=="checkbox"){ setPath(el.getAttribute("data-bind"),el.value); save(); return; }
  if(el.hasAttribute("data-cbind") && el.type==="text"){ cbind(el); return; }
  if(el.hasAttribute("data-mbind")){ S.multi[el.getAttribute("data-mbind")]=el.value; save(); document.getElementById("multibody").innerHTML=multiRows(); return; }
  if(el.id==="lfilter"){ listFilter=el.value; var pos=el.selectionStart; render(); var f=document.getElementById("lfilter"); if(f){ f.focus(); try{f.setSelectionRange(pos,pos);}catch(x){} } }
});
function cbind(el){
  var p=el.getAttribute("data-cbind").split("."), c=findC(p[0]); if(!c) return;
  var v= el.type==="checkbox"?el.checked:el.value;
  if(p[1]==="cat" && v!=="") v=+v;
  c[p[1]]=v; save();
}
document.addEventListener("submit",function(e){
  e.preventDefault();
  var f=e.target;
  if(f.id==="startform"){
    var n=document.getElementById("w_name").value.trim(); if(!n){ toast(L.ui.needName); return; }
    var cb=document.getElementById("w_consent"); if(SYNC && cb && !cb.checked){ toast(L.ui.consentNeed); return; }
    S.name=n; S.leader=document.getElementById("w_leader").value.trim(); S.consent=!!(cb&&cb.checked); S.startedAt=Date.now(); S.view="start"; save(); render(); sync(false); return; }
  if(f.id==="addform"){ var inp=document.getElementById("add_name"), nm=inp.value.trim(); if(!nm){ inp.focus(); return; } S.list.push({id:uid(),name:nm,ctx:document.getElementById("add_ctx").value.trim(),cat:addCat}); save(); render(); var ni=document.getElementById("add_name"); if(ni) ni.focus(); if(S.list.length===30) toast(L.m.list.t30); if(S.list.length===100) toast(L.m.list.t100); return; }
  if(f.id==="talkform"){ var w=document.getElementById("t_who").value.trim(); if(!w) return; S.talks.unshift({at:Date.now(),who:w,lever:document.getElementById("t_lever").value,q:document.getElementById("t_q").value,next:document.getElementById("t_next").value}); var c=S.list.filter(function(x){return x.name===w;})[0]; if(c && (!c.status||c.status==="NEU")) c.status="TERMIN"; save(); render(); toast(L.m.talk.saved); return; }
});

/* ---------- Pitch timer ---------- */
var pT=null, pStart=0;
function pitchToggle(){ if(pT){ pitchStop(true); } else { pStart=Date.now(); document.getElementById("pitchBtn").textContent=L.m.system.stop; pT=setInterval(tick,200); tick(); } }
function tick(){ var el=document.getElementById("timer"); if(!el){ clearInterval(pT); pT=null; return; } var s=(Date.now()-pStart)/1000, left=Math.ceil(60-s); el.textContent=left>0?left:"+"+Math.floor(s-60); el.className="timer tab "+(left>0?"run":"over"); }
function pitchStop(count){
  if(!pT) return; clearInterval(pT); pT=null;
  var s=Math.round((Date.now()-pStart)/1000), m=L.m.system;
  if(count){
    if(s<15) toast(m.short);
    else if(s<=60){ S.pitch.reps++; if(!S.pitch.best||s<S.pitch.best) S.pitch.best=s; save(); toast(F(m.valid,{s:s})); }
    else toast(F(m.long,{s:s}));
  }
  render();
}

/* ---------- Boot ---------- */
var hadSaved=false;
try{ hadSaved=!!localStorage.getItem(KEY); }catch(e){}
load();
var hash=(location.hash||"").replace("#","").toLowerCase();
if(LANGS.indexOf(hash)>=0 && (!hadSaved || !S.startedAt)) S.lang=hash;
setLang(S.lang);
if(hash && L.mods[hash] && S.startedAt) S.view=hash;
try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){}
render();
if(S.startedAt) setTimeout(function(){ if(!S.updatedAt) S.updatedAt=Date.now(); sync(false); },1500);
})();

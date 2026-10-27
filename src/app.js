(function(){
"use strict";
var KEY="bp_fasttrack_v1", VERSION=1;
var LANGS=["de","en","it","hr","pl","tr"];
var L=I18N.de;

/* ---------- State ---------- */
function blank(lang){
  return {v:VERSION,lang:lang||detectLang(),pid:uid(),consent:false,updatedAt:0,name:"",leader:"",startedAt:0,view:"start",done:{},
    diag:{},pitch:{reps:0,best:0,leaderOk:false},quiz:{},list:[],net:{},sent:{},
    talks:[],sprint:{},kpi:{},dup:{},cert:{},multi:{size:100,rate:10,levels:6},
    app:{},kc:{},seen:{},calc:{rank:"TB",premium:1,voucher:0,customers:10,cp:0.1},story:{},mine:{},
    kings:[],kcheck:{},kedit:"",kpick:""};
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
  if(!Array.isArray(d.kings)) d.kings=[];
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
/* Felder und Bedeutung unverändert zu gas/Code.gs (HEAD/toRow_). Königs-Dossiers und Kontaktnamen werden nie übertragen. */
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

/* Sprachen: fehlende Texte fallen auf Deutsch zurück (de.js ist die Referenz). */
function isObj(o){ return !!o && typeof o==="object" && !Array.isArray(o); }
function withDe(o,base){
  if(!isObj(base)) return o!==undefined?o:base;
  var r={}, k;
  for(k in base){ if(Object.prototype.hasOwnProperty.call(base,k)) r[k]=(isObj(o)&&Object.prototype.hasOwnProperty.call(o,k))?(isObj(base[k])?withDe(o[k],base[k]):o[k]):base[k]; }
  if(isObj(o)) for(k in o){ if(Object.prototype.hasOwnProperty.call(o,k) && !(k in r)) r[k]=o[k]; }
  return r;
}
function setLang(l){
  if(LANGS.indexOf(l)<0) l="de";
  S.lang=l; L= l==="de"?I18N.de:withDe(I18N[l],I18N.de); document.documentElement.lang=l;
}

function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function F(str,o){ return String(str).replace(/\{(\w+)\}/g,function(m,k){ return o && o[k]!=null?o[k]:m; }); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function setPath(p,val){ var parts=p.split("."), o=S; for(var i=0;i<parts.length-1;i++){ if(o[parts[i]]==null||typeof o[parts[i]]!=="object") o[parts[i]]={}; o=o[parts[i]]; } o[parts[parts.length-1]]=val; }
function getPath(p){ return p.split(".").reduce(function(o,k){ return o==null?undefined:o[k]; },S); }
function toast(msg){ var t=document.getElementById("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(function(){t.hidden=true;},1800); }
function copyText(txt){
  function fallback(){ var ta=document.createElement("textarea"); ta.value=txt; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,99999); var ok=false; try{ ok=document.execCommand("copy"); }catch(e){} document.body.removeChild(ta); toast(ok?L.ui.copied:L.ui.copyManual); }
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){toast(L.ui.copied);},fallback); } else fallback();
}
function fmt(n){ return Number(n).toLocaleString(L.locale); }
function eur(n){ try{ return Number(n).toLocaleString(L.locale,{style:"currency",currency:"EUR",maximumFractionDigits:n%1?2:0}); }catch(e){ return n+" €"; } }
function fdate(ts,opt){ try{ return new Date(ts).toLocaleString(L.locale,opt); }catch(e){ return new Date(ts).toLocaleString(); } }
function num(v){ var n=Number(v); return isFinite(n)&&n>=0?n:0; }

/* ---------- Structure ---------- */
var PHASES=[["start","diag","system","check","geld","haltung"],["list","top","multi","net"],["warm","cold","pipe","talk","einw"],["sprint","week","dup","cert"]];
var KING=["kgesetze","kreife","ktypen","ksequenz","knachr","kgespr","keinw","kabschl","kkodex"];
var ORDER=[]; PHASES.forEach(function(p){ ORDER=ORDER.concat(p); });
var NAV=ORDER.concat(KING), ALLPH=PHASES.concat([KING]);
function MT(id){ return L.mods[id][0]; }
function PHN(i){ return (L.phases&&L.phases[i])||I18N.de.phases[i]; }
var QUIZ_C=[1,0,0,0];
var STATUSES=["","NEU","TERMIN","FU","ENT","GO","NO"];
var SC_IDS={warm:["w1","w2","w3","w4","w5","w6","w7","w8"],cold:["c1","c2","c3","c4","c5","c6","c7"],fu:["f1","f2","f3","f4","f5","f6"]};
function scripts(g){ return L.scripts[g].map(function(s,i){ return {id:SC_IDS[g][i],t:s[0],x:s[1],w:s[2]||""}; }); }
var RATES={P:[5,2],CB:[10,5],TB:[40,20],AM:[42,25],RD:[44,30],SD:[46,35],CM:[48,40],IBM:[50,40]};

/* ---------- Derived ---------- */
function tops(){ return S.list.filter(function(c){return c.top;}); }
function contacted(){ return S.list.filter(function(c){return !!c.status;}); }
function scoreOf(c){ return (c.t||0)+(c.p||0)+(c.s||0); }
function netFilled(){ var n=0; for(var i=0;i<5;i++){ if((S.net[i]||"").trim()) n++; } return n; }
function sentTotal(g){ var n=0; SC_IDS[g].forEach(function(id){ n+=S.sent[id]||0; }); return n; }
function quizOk(){ return QUIZ_C.every(function(c,i){ return S.quiz[i]===c; }); }
function nextSteps(){ return S.list.filter(function(c){return c.next && c.date;}).length; }
function dupAll(){ for(var i=0;i<5;i++){ if(!S.dup["d"+i]) return false; } return true; }
function mineDone(){ var n=0; for(var i=0;i<3;i++){ if((S.mine["e"+i]||"").trim() && (S.mine["a"+i]||"").trim()) n++; } return n; }
/* K/P/M wird als Code gespeichert; angezeigt wird der Buchstabe der jeweiligen Sprache. */
function kpmL(code){ var o=(L.m.list.kpmOpts||[]).filter(function(k){return k[0]===code;})[0]; return o?String(o[1]).split(" ")[0]:code; }
function kScore(k){ var s=0, sc=k.sc||{}; for(var i=0;i<5;i++) s+=Number(sc[i]||0); return s; }
function kBand(s){ return s>=8?0:s>=5?1:2; }
function autoDone(id){
  switch(id){
   case "start": return !!S.startedAt;
   case "diag": for(var i=0;i<6;i++){ if(!(S.diag["q"+i]||"").trim()) return false; } return S.diag.type!=null && S.diag.type!=="";
   case "system": return S.pitch.reps>=3 && !!S.app[0];
   case "check": return quizOk() && S.pitch.leaderOk;
   case "geld": return !!S.seen.geld;
   case "haltung": return !!S.seen.haltung;
   case "list": return S.list.length>=100;
   case "top": return tops().length>=10;
   case "multi": return !!S.multi.seen;
   case "net": return netFilled()>=3;
   case "warm": return sentTotal("warm")>=3;
   case "cold": return sentTotal("cold")>=4;
   case "pipe": return contacted().length>=5;
   case "talk": return S.talks.length>=1;
   case "einw": return mineDone()>=3;
   case "sprint": var n=0; for(var k in S.sprint) if(S.sprint[k]) n++; return n>=12;
   case "week": for(var j=0;j<6;j++){ if(S.kpi["t"+j]) return true; } return false;
   case "dup": return dupAll();
   case "cert": return certLevel()>=2;
   case "kreife": return S.kings.some(function(k){ return kScore(k)>=8; });
   case "ksequenz": return S.kings.length>0 && S.kings.every(function(k){ return k.next && k.date; });
  }
  if(KING.indexOf(id)>=0) return !!S.seen[id];
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
  ALLPH.forEach(function(mods,pi){
    var d=mods.filter(function(m){return S.done[m];}).length, king=pi===4;
    side+='<div class="phase'+(king?" kingph":"")+'"><div class="phase-h"><span>0'+(pi+1)+' · '+PHN(pi)+(king?' <span class="opttag">'+esc(L.ui.optional)+'</span>':'')+'</span><span class="tab">'+d+'/'+mods.length+'</span></div>';
    mods.forEach(function(m){
      var cls=S.done[m]?"done":(autoDone(m)?"auto":"");
      side+='<button class="nav'+(S.view===m?" on":"")+'" data-go="'+m+'"><span class="dot '+cls+'">'+(S.done[m]?"✓":(king?"♛":(NAV.indexOf(m)+1)))+'</span><span>'+MT(m)+'</span></button>';
    });
    side+='</div>';
  });
  side+='<div class="side-foot"><div class="small muted" id="syncinfo">'+esc(syncText())+'</div><button class="btn sm ghost" data-act="backup">'+L.ui.backup+'</button></div></aside>';
  var i=NAV.indexOf(S.view);
  root.innerHTML='<div class="app">'+side+'<div class="overlay" id="ov" data-act="closeside"></div><main class="main">'+
   '<div class="topbar"><button class="btn sm" data-act="openside">☰ '+L.ui.menu+'</button><span class="small muted tab">'+(i+1)+' / '+NAV.length+' · '+pct+'%</span>'+
   '<select class="langsel" data-act="langsel" aria-label="'+esc(L.ui.language)+'">'+LANGS.map(function(l){ return '<option value="'+l+'"'+(S.lang===l?" selected":"")+'>'+l.toUpperCase()+'</option>'; }).join("")+'</select></div>'+
   '<div class="wrap">'+consentBanner()+(R[S.view]?R[S.view]():"")+renderFoot(S.view)+'</div></main>'+
   '<nav class="mobnav"><button class="btn" data-go="'+(NAV[i-1]||"")+'" '+(i===0?"disabled":"")+'>'+L.ui.back+'</button><button class="btn pri" data-go="'+(NAV[i+1]||"")+'" '+(i===NAV.length-1?"disabled":"")+'>'+L.ui.next+'</button></nav></div>';
  liveUpd();
}
function sprintLabel(){ var h=(Date.now()-S.startedAt)/3600000; return h<72?F(L.ui.sprintLeft,{h:Math.ceil(72-h)}):L.ui.sprintOver; }
function phaseOf(id){ for(var i=0;i<ALLPH.length;i++){ if(ALLPH[i].indexOf(id)>=0) return i; } return 0; }
function head(id,lead){
  var p=phaseOf(id);
  return '<header class="stack"><div class="eyebrow">'+L.ui.phase+' '+(p+1)+' · '+PHN(p)+' · '+L.mods[id][1]+'</div><h1>'+MT(id)+'</h1>'+(lead?'<p class="lead">'+lead+'</p>':'')+(p===4?'<p class="small" style="color:var(--gold)">♛ '+esc(L.ui.kingNote)+'</p>':'')+'</header>';
}
function task(label,txt){ return '<div class="task"><b>'+label+'</b>'+txt+'</div>'; }
function quote(q,style){ return '<div class="card"><div class="quote"'+(style?' style="'+style+'"':'')+'>'+q[0]+(q[1]?'<small>'+q[1]+'</small>':'')+'</div></div>'; }
function ul(items){ return '<ul class="clean small muted" style="margin-top:8px">'+items.map(function(x){return '<li>'+x+'</li>';}).join("")+'</ul>'; }
function table(cols,rows,cls){ return '<div class="tablewrap"><table'+(cls?' class="'+cls+'"':'')+'><thead><tr>'+cols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>'+rows.map(function(r){ return '<tr>'+r.map(function(c){return '<td>'+c+'</td>';}).join("")+'</tr>'; }).join("")+'</tbody></table></div>'; }
function hl(s){ return s.replace(/\[[^\]]+\]/g,function(mm){return "<mark>"+mm+"</mark>";}); }
function txt(s){ return hl(esc(s)).replace(/\n/g,"<br>"); }
function cond(c){ return c?'<span class="cond">'+esc(L.ui.cond)+'</span> <span class="small">'+esc(c)+'</span>':''; }
function seen(id){ if(!S.seen[id]){ S.seen[id]=true; save(); } }
function renderFoot(id){
  var i=NAV.indexOf(id), a=autoDone(id), d=!!S.done[id];
  return '<div class="modfoot noprint"><div class="row">'+
   (a?'<span class="badge b-ok">'+L.ui.critOk+'</span>':'<span class="badge b-warn">'+L.ui.critOpen+'</span>')+
   '<button class="btn '+(d?"":"gold")+'" data-act="toggleDone" data-id="'+id+'">'+(d?L.ui.doneReset:L.ui.markDone)+'</button></div>'+
   '<div class="row">'+(i>0?'<button class="btn" data-go="'+NAV[i-1]+'">← '+MT(NAV[i-1])+'</button>':'')+
   (i<NAV.length-1?'<button class="btn pri" data-go="'+NAV[i+1]+'">'+MT(NAV[i+1])+' →</button>':'')+'</div></div>';
}

/* Live-Ausgaben (aktualisieren ohne Neuaufbau, damit der Cursor im Feld bleibt) */
var LIVE={
  f4:function(){ var t=[0,1,2,3].map(function(i){return (S.sent["f4_"+i]||"").trim();}).filter(Boolean).join(" "); return t?esc(t):'<span class="muted">'+esc(L.m.warm.fill4)+'</span>'; },
  story:function(){ var t=[0,1,2,3].map(function(i){return (S.story[i]||"").trim();}).filter(Boolean).join(" "); return t?esc(t):'<span class="muted">'+esc(L.m.talk.storyEmpty)+'</span>'; },
  closure:function(){ var g=L.m.geld, r=RATES[S.calc.rank]||RATES.TB, cp=num(S.calc.premium)*3+num(S.calc.voucher); return '<span class="small muted">'+esc(g.closure)+'</span><b class="big tab">'+eur(cp*r[0])+'</b><span class="small tab">'+fmt(cp)+' CP × '+r[0]+' '+esc(g.perCp)+'</span>'; },
  air:function(){ var g=L.m.geld, r=RATES[S.calc.rank]||RATES.TB, cp=num(S.calc.customers)*num(S.calc.cp); return '<span class="small muted">'+esc(g.air)+'</span><b class="big tab">'+eur(Math.round(cp*r[1]*100)/100)+'</b><span class="small tab">'+fmt(num(S.calc.customers))+' '+esc(g.cust2)+' × '+fmt(num(S.calc.cp))+' CP × '+r[1]+' '+esc(g.perCp)+'</span>'; }
};
function liveUpd(){ [].forEach.call(document.querySelectorAll("[data-live]"),function(el){ var f=LIVE[el.getAttribute("data-live")]; if(f) el.innerHTML=f(); }); }

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
  m.cards.forEach(function(t,i){ out+='<button class="card'+(i===0?" hi":"")+(i===4?" kingcard":"")+'" style="text-align:left;cursor:pointer" data-go="'+ALLPH[i][0]+'"><span class="label">'+(i===4?"♛ ":"")+L.ui.phase+' '+(i+1)+'</span><h3>'+PHN(i)+'</h3><p class="muted">'+t+'</p></button>'; });
  out+='</div><div class="card"><div class="row" style="justify-content:space-between"><div><span class="label">'+m.sprint+'</span><div class="kpi"><b class="tab">'+(left>0?Math.floor(left)+" h "+Math.round((left%1)*60)+" min":m.expired)+'</b><span>'+F(m.started,{d:fdate(S.startedAt,{dateStyle:"medium",timeStyle:"short"})})+'</span></div></div>'+
   '<div style="flex:1;min-width:200px"><div class="bar"><i style="width:'+Math.min(100,h/72*100).toFixed(1)+'%"></i></div><div class="row small muted" style="justify-content:space-between;margin-top:6px">'+m.tl.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div></div></div></div>'+
   '<div class="stack"><h2>'+m.rulesT+'</h2><div class="grid3">'+m.rules.map(function(r){ return '<div class="card"><h3>'+r[0]+'</h3><p class="small muted" style="margin-top:6px">'+r[1]+'</p></div>'; }).join("")+'</div></div>'+
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
  L.types.forEach(function(t,i){ var on=String(S.diag.type)===String(i), best=t[2]||I18N.de.types[i][2]; h+='<button class="card" style="text-align:left;cursor:pointer;'+(on?"border-color:var(--gold);":"")+'" data-act="setType" data-v="'+i+'"><h3 style="'+(on?"color:var(--gold)":"")+'">'+(on?"✓ ":"")+t[0]+'</h3><p class="small muted">'+t[1]+'</p>'+(on?'<p class="small" style="margin-top:8px"><b>'+(m.best||I18N.de.m.diag.best)+'</b> '+best+'</p>':'')+'</button>'; });
  h+='</div></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.system=function(){
  var m=L.m.system, h=head("system",m.lead)+'<div class="grid3">';
  m.sys.forEach(function(s,i){ h+='<div class="card'+(i===0?" hi":"")+'"><span class="label">'+s[0]+'</span><h3>'+s[1]+'</h3><p class="small muted" style="margin-top:6px">'+s[2]+'</p></div>'; });
  h+='</div><div class="card hi stack"><span class="label">'+m.coreL+'</span><p style="font-size:16px">'+m.core+'</p><p class="small muted">'+m.coreWhy+'</p><div><button class="btn sm" data-act="copyTxt" data-t="'+esc(m.core.replace(/^„|“$/g,""))+'">'+L.ui.copy+'</button></div></div>';
  h+='<div class="card stack"><h2>'+m.appT+'</h2><p class="small muted">'+m.appLead+'</p>'+m.app.map(function(a,i){ return '<label class="opt'+(S.app[i]?" sel":"")+'"><input type="checkbox" id="app'+i+'" data-bind="app.'+i+'"'+(S.app[i]?" checked":"")+'> '+a+'</label>'; }).join("")+'</div>';
  h+='<div class="flow">'+m.flow.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div><div class="grid3">';
  m.ben.forEach(function(b){ h+='<div class="card"><h3>'+b[0]+'</h3>'+ul(b[1])+'</div>'; });
  h+='</div><div class="card hi stack"><h2>'+m.tr+'</h2><p class="muted small">'+m.trHint+'</p>'+
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
  h+='</div><div class="card stack"><h2>'+m.kcT+'</h2><p class="small muted">'+m.kcHint+'</p>'+m.kc.map(function(q,i){
    return '<details class="acc"><summary><span class="num">'+(i+1)+'</span><span>'+q[0]+'</span><span class="pl" aria-hidden="true">+</span></summary><div class="accb"><p class="small"><b>'+m.kcShow+':</b> '+q[1]+'</p><label class="opt'+(S.kc[i]?" sel":"")+'"><input type="checkbox" id="kc'+i+'" data-bind="kc.'+i+'"'+(S.kc[i]?" checked":"")+'> '+m.kcCan+'</label></div></details>'; }).join("")+'</div>';
  h+='<div class="card" style="background:var(--panel2)"><span class="muted">'+m.qrule+'</span></div>'+
  '<div class="card hi stack"><h2>'+m.unlock+'</h2><p class="muted small">'+m.unlockHint+'</p>'+
  '<label class="opt'+(S.pitch.leaderOk?" sel":"")+'"><input type="checkbox" id="leaderok" data-bind="pitch.leaderOk" '+(S.pitch.leaderOk?"checked":"")+'> '+F(m.leaderOk,{l:S.leader?" ("+esc(S.leader)+")":""})+'</label>'+
  '<p class="small">'+(quizOk()&&S.pitch.leaderOk?'<span class="badge b-ok">'+m.unlocked+'</span>':'<span class="badge b-warn">'+m.locked+'</span>')+'</p></div>';
  return h;
};

R.geld=function(){
  seen("geld");
  var m=L.m.geld, h=head("geld",m.lead)+'<div class="grid4">';
  m.blocks.forEach(function(b){ h+='<div class="card"><span class="label">'+b[1]+'</span><h3>'+b[0]+'</h3><p class="small muted" style="margin-top:6px">'+b[2]+'</p></div>'; });
  h+='</div><div class="card stack"><h2>'+m.calcT+'</h2><p class="small muted">'+m.calcHint+'</p>'+
   '<label class="field" style="max-width:360px"><span>'+m.rank+'</span><select id="c_rank" data-bind="calc.rank" data-rr="1">'+m.ranks.map(function(r){ return '<option value="'+r[0]+'"'+(S.calc.rank===r[0]?" selected":"")+'>'+r[0]+' · '+r[1]+'</option>'; }).join("")+'</select></label>'+
   '<div class="grid2"><div class="stack"><div class="grid2"><label class="field"><span>'+m.prem+'</span><input type="number" min="0" step="1" inputmode="numeric" id="c_prem" data-bind="calc.premium" value="'+esc(S.calc.premium)+'"></label><label class="field"><span>'+m.vou+'</span><input type="number" min="0" step="1" inputmode="numeric" id="c_vou" data-bind="calc.voucher" value="'+esc(S.calc.voucher)+'"></label></div><div class="result" data-live="closure"></div></div>'+
   '<div class="stack"><div class="grid2"><label class="field"><span>'+m.cust+'</span><input type="number" min="0" step="1" inputmode="numeric" id="c_cust" data-bind="calc.customers" value="'+esc(S.calc.customers)+'"></label><label class="field"><span>'+m.cp+'</span><input type="number" min="0" step="0.01" inputmode="decimal" id="c_cp" data-bind="calc.cp" value="'+esc(S.calc.cp)+'"></label></div><div class="result" data-live="air"></div></div></div>'+
   '<p class="small muted">'+m.calcNote+'</p></div>';
  h+='<div class="card stack"><h2>'+m.tableT+'</h2><div class="tablewrap"><table><thead><tr>'+m.cols.map(function(c,i){return '<th'+(i>1?' class="num"':'')+'>'+c+'</th>';}).join("")+'</tr></thead><tbody>'+
   m.ranks.map(function(r){ var x=RATES[r[0]]; return '<tr'+(S.calc.rank===r[0]?' class="sel"':'')+'><td><b>'+r[0]+'</b> · '+r[1]+'</td><td>'+r[2]+'</td><td class="num tab">'+x[0]+'</td><td class="num tab">'+x[1]+'</td></tr>'; }).join("")+'</tbody></table></div><p class="small muted">'+m.tableNote+'</p></div>';
  var msg=F(m.openMsg,{l:S.leader?" "+S.leader:""});
  h+='<div class="grid2"><div class="card stack"><h3>'+m.talkT+'</h3><p class="quote" style="font-size:18px">'+m.talkQ+'</p>'+ul(m.talk)+'</div>'+
   '<div class="card stack"><h3>'+m.openT+'</h3>'+ul(m.open)+'<div><button class="btn sm" data-act="copyTxt" data-t="'+esc(msg)+'">'+m.openBtn+'</button></div></div></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.haltung=function(){
  seen("haltung");
  var m=L.m.haltung, h=head("haltung",m.lead);
  h+='<div class="card hi stack"><span class="label">'+m.coreL+'</span><div class="quote">'+m.core+'</div></div>';
  h+='<div class="stack"><h2>'+m.pT+'</h2>'+m.p.map(function(p,i){
    return '<details class="acc"'+(i===0?' open':'')+'><summary><span class="num">'+(i+1)+'</span><span>'+p[0]+'</span><span class="pl" aria-hidden="true">+</span></summary><div class="accb"><div class="grid2"><div><span class="label">'+m.whyL+'</span><p class="small">'+p[1]+'</p></div><div><span class="label">'+m.howL+'</span><p class="small">'+p[2]+'</p></div></div>'+(p[3]?'<p class="small"><span class="badge b-bad">'+m.lineL+'</span> '+p[3]+'</p>':'')+'</div></details>'; }).join("")+'</div>';
  h+='<div class="card stack"><h2>'+m.fearT+'</h2><p class="muted">'+m.fear+'</p><div class="grid3">'+m.fearL.map(function(f){ return '<div><h3>'+f[0]+'</h3><p class="small muted" style="margin-top:4px">'+f[1]+'</p></div>'; }).join("")+'</div></div>';
  h+='<div class="card stack"><h2>'+m.wordsT+'</h2>'+table(L.m.kkodex.swapCols,m.words.map(function(w){ return ['<s class="muted">'+w[0]+'</s>','<span style="color:var(--gold)">'+w[1]+'</span>']; }))+'<div><button class="btn sm ghost" data-go="kkodex">♛ '+MT("kkodex")+' →</button></div></div>';
  return h+task(L.ui.lbl.task,m.task);
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
   '<details><summary class="small" style="cursor:pointer;color:var(--teal)">'+m.bulk+'</summary><div class="stack" style="margin-top:8px"><textarea id="bulk" placeholder="'+esc(m.bulkPh)+'"></textarea><button type="button" class="btn sm" data-act="bulkAdd">'+m.bulkBtn+'</button></div></details>'+
   '<details><summary class="small" style="cursor:pointer;color:var(--teal)">'+m.helpT+'</summary><div class="tablewrap" style="margin-top:8px"><table><tbody>'+m.help.map(function(x){ return '<tr><td><b>'+x[0]+'</b></td><td class="muted">'+x[1]+'</td></tr>'; }).join("")+'</tbody></table></div></details></form>';
  h+='<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h3>'+m.yours+'</h3>'+(n?'<input type="text" id="lfilter" placeholder="'+esc(m.search)+'" style="max-width:220px" value="'+esc(listFilter)+'">':'')+'</div>';
  if(!n) h+='<p class="muted small">'+m.empty+'</p>';
  var f=listFilter.toLowerCase();
  S.list.forEach(function(c,i){
    if(f && (c.name+" "+(c.ctx||"")+" "+catName(c.cat)).toLowerCase().indexOf(f)<0) return;
    h+='<div class="listrow"><span class="n tab">'+(i+1)+'</span><input type="text" value="'+esc(c.name)+'" data-cbind="'+c.id+'.name" aria-label="'+esc(m.name)+'"><input class="ctx" type="text" value="'+esc(c.ctx||"")+'" placeholder="'+esc(m.ctxCol)+'" data-cbind="'+c.id+'.ctx" aria-label="'+esc(m.ctxCol)+'">'+
     '<select class="cat" data-cbind="'+c.id+'.cat" aria-label="'+esc(m.cat)+'"><option value="">'+m.cat+'</option>'+L.cats.map(function(k,ki){return '<option value="'+ki+'"'+(String(c.cat)===String(ki)?" selected":"")+'>'+k+'</option>';}).join("")+'</select>'+
     '<select class="kpm" data-cbind="'+c.id+'.kpm" aria-label="'+esc(m.kpm)+'"><option value="">'+m.kpm+'</option>'+m.kpmOpts.map(function(k){return '<option value="'+k[0]+'"'+(c.kpm===k[0]?" selected":"")+'>'+k[1]+'</option>';}).join("")+'</select>'+
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
    h+='<tr><td><input type="checkbox" data-act="topToggle" data-id="'+c.id+'" '+(c.top?"checked":"")+' '+(!c.top&&tc>=10?"disabled":"")+' aria-label="TOP"></td><td style="min-width:140px"><b>'+esc(c.name)+'</b>'+(c.kpm?' <span class="kpmtag">'+kpmL(c.kpm)+'</span>':'')+(catName(c.cat)?'<div class="small muted">'+catName(c.cat)+'</div>':'')+'</td>'+
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
function fill(x,who){ if(!who) return x; var n=who.name.split(" ")[0]; return x.split(L.ph).join(n).split("[Name]").join(n); }
function scriptBlock(g,title){
  var sc=L.m.sc;
  var opts='<option value="">'+esc(F(sc.manual,{ph:L.ph}))+'</option>'+S.list.slice().sort(function(a,b){return (b.top?1:0)-(a.top?1:0);}).map(function(c){ return '<option value="'+c.id+'"'+(pick[g]===c.id?" selected":"")+'>'+(c.top?"★ ":"")+esc(c.name)+(c.kpm?" · "+kpmL(c.kpm):"")+'</option>'; }).join("");
  var who=findC(pick[g]);
  var h='<div class="card stack"><div class="row" style="justify-content:space-between"><h2>'+title+'</h2><label class="field" style="min-width:220px;flex:0 1 280px"><span>'+sc.forWho+'</span><select id="pick_'+g+'" data-act="pick" data-g="'+g+'">'+opts+'</select></label></div><p class="small muted">'+(sc.hint||I18N.de.m.sc.hint)+'</p><div class="grid2">';
  scripts(g).forEach(function(s){
    var t=fill(s.x,who);
    h+='<div class="script"><div class="t">'+s.t+'</div><p>'+hl(esc(t))+'</p>'+(s.w?'<p class="small muted"><b style="color:var(--teal)">'+(sc.why||I18N.de.m.sc.why)+'</b> '+s.w+'</p>':'')+'<div class="row"><button class="btn sm pri" data-act="copyScript" data-id="'+s.id+'" data-g="'+g+'">'+sc.copy+'</button>'+
     '<a class="btn sm" href="https://wa.me/?text='+encodeURIComponent(t)+'" target="_blank" rel="noopener" data-act="waScript" data-id="'+s.id+'" data-g="'+g+'">WhatsApp</a>'+
     '<span class="small muted tab">'+(S.sent[s.id]?F(sc.used,{n:S.sent[s.id]}):"")+'</span></div></div>';
  });
  return h+'</div></div>';
}

R.warm=function(){
  var m=L.m.warm;
  return head("warm",m.lead)+
   '<div class="card stack"><h2>'+m.f4T+'</h2><div class="flow">'+m.f4.map(function(x,i){ return '<span>'+(i+1)+'. '+x[0]+'<br><small class="muted">'+x[1]+'</small></span>'; }).join("")+'</div>'+
   '<div class="grid2">'+m.f4.map(function(x,i){ return '<label class="field"><span>'+(i+1)+'. '+x[0]+'</span><textarea id="f4'+i+'" data-bind="sent.f4_'+i+'" rows="2">'+esc(S.sent["f4_"+i]||"")+'</textarea></label>'; }).join("")+'</div>'+
   '<div class="fillbox" data-live="f4"></div><p class="small muted">'+m.f4Hint+'</p><div class="row"><button class="btn pri" data-act="copy4">'+m.copy4+'</button></div></div>'+
   '<div class="grid3">'+m.chan.map(function(c){ return '<div class="card"><h3>'+c[0]+'</h3><p class="small muted" style="margin-top:4px">'+c[1]+'</p></div>'; }).join("")+'</div>'+
   scriptBlock("warm",L.m.sc.templates)+'<p class="small muted">'+m.note+'</p>'+
   '<div class="card stack"><h2>'+m.ansT+'</h2>'+table(["",""],m.ans.map(function(a){ return ['<b>'+a[0]+'</b>',a[1]]; }),"nohead")+'</div>'+
   '<div class="grid2"><div class="card"><h3 style="color:var(--ok)">'+m.doT+'</h3>'+ul(m.do)+'</div><div class="card"><h3 style="color:var(--bad)">'+m.dontT+'</h3>'+ul(m.dont)+'</div></div>'+
   task(L.ui.lbl.task,m.task+' ('+sentTotal("warm")+' / 3)');
};
R.cold=function(){
  var m=L.m.cold;
  return head("cold",m.lead)+
   '<div class="card stack"><h2>'+m.rulesT+'</h2>'+ul(m.rules)+'</div>'+
   scriptBlock("cold",L.m.sc.templates)+
   '<div class="card hi kingcard stack"><h2>♛ '+m.kingT+'</h2><p class="muted">'+m.king+'</p><div><button class="btn gold" data-go="kgesetze">'+m.kingBtn+' →</button></div></div>'+
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
      h+='<tr><td style="min-width:130px"><b>'+esc(c.name)+'</b>'+(c.top?' <span class="small" style="color:var(--gold)">★</span>':'')+(c.kpm?' <span class="kpmtag">'+kpmL(c.kpm)+'</span>':'')+'</td>'+
       '<td><select data-cbind="'+c.id+'.status" data-rr="1" style="min-width:150px" aria-label="Status">'+STATUSES.map(function(s){return '<option value="'+s+'"'+((c.status||"")===s?" selected":"")+'>'+(s?st[s]:st.open)+'</option>';}).join("")+'</select></td>'+
       '<td><input type="text" style="min-width:170px" value="'+esc(c.next||"")+'" placeholder="'+esc(m.nextPh)+'" data-cbind="'+c.id+'.next"></td>'+
       '<td><input type="date" value="'+esc(c.date||"")+'" data-cbind="'+c.id+'.date" style="'+(overdue?"border-color:var(--bad)":"")+'"></td>'+
       '<td><input type="checkbox" data-cbind="'+c.id+'.reply" '+(c.reply?"checked":"")+' aria-label="'+esc(m.cols[4])+'"></td></tr>';
    });
    h+='</tbody></table></div>';
  }
  h+='</div><div class="card"><h3>'+m.rhythmT+'</h3>'+ul(m.rhythm)+'</div>'+scriptBlock("fu",L.m.sc.fu);
  return h+task(L.ui.lbl.task,m.task);
};

R.talk=function(){
  var m=L.m.talk;
  var h=head("talk",m.lead)+'<div class="stack"><h2>'+m.phT+'</h2>'+m.ph.map(function(p,i){ return '<div class="card phase-row"><span class="num">'+(i+1)+'</span><div class="stack" style="gap:4px;min-width:0"><div class="row"><h3>'+p[0]+'</h3><span class="badge b-mut">'+p[1]+'</span></div><p class="small">'+p[2]+'</p></div></div>'; }).join("")+'<p class="small muted">'+m.phNote+'</p></div>'+
   '<div class="grid2"><div class="card"><span class="label">'+m.pL+'</span><h3>'+m.qT+'</h3><ol class="small" style="margin-top:8px">'+m.pq.map(function(q){return '<li>'+q+'</li>';}).join("")+'</ol></div>'+
   '<div class="card"><span class="label">'+m.mL+'</span><h3>'+m.qT+'</h3><ol class="small" style="margin-top:8px">'+m.mq.map(function(q){return '<li>'+q+'</li>';}).join("")+'</ol></div></div>'+
   '<div class="flow">'+m.flow.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div>'+quote(m.quote);
  h+='<div class="card stack"><h2>'+m.storyT+'</h2><p class="small muted">'+m.storyHint+'</p><div class="grid2">'+m.story.map(function(s,i){ return '<label class="field"><span>'+s+'</span><textarea id="st'+i+'" data-bind="story.'+i+'" rows="2">'+esc(S.story[i]||"")+'</textarea></label>'; }).join("")+'</div><div class="fillbox" data-live="story"></div><div class="row"><button class="btn sm" data-act="copyStory">'+m.storyCopy+'</button></div></div>';
  h+='<div class="card stack"><h2>'+m.closeT+'</h2>'+table(["",""],m.close.map(function(c){ return ['<b>'+c[0]+'</b>',c[1]]; }),"nohead")+'</div>';
  h+='<div class="card hi stack"><h2>'+m.trioT+'</h2><p class="muted small">'+m.trio+'</p><p class="quote" style="font-size:18px;text-transform:none">'+hl(esc(F(m.edif,{s:S.leader||"[Sponsor]"})))+'</p><p class="small muted">'+m.trioRole+'</p></div>';
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

R.einw=function(){
  var m=L.m.einw, h=head("einw",m.lead)+'<div class="grid4">'+m.method.map(function(x,i){ return '<div class="card"><span class="label">'+(i+1)+'</span><h3>'+x[0]+'</h3><p class="small muted" style="margin-top:4px">'+x[1]+'</p></div>'; }).join("")+'</div>';
  h+='<div class="stack"><h2>'+m.listT+'</h2><input type="text" id="einwq" placeholder="'+esc(m.search)+'" autocomplete="off" style="max-width:420px"><div class="stack" id="einwlist">'+m.items.map(function(o,i){
    return '<details class="acc" data-s="'+esc((o[0]+" "+o[1]+" "+o[2]).toLowerCase())+'"><summary><span>'+o[0]+'</span><span class="pl" aria-hidden="true">+</span></summary><div class="accb"><p class="small muted">'+m.behind+' '+o[1]+'</p><p>'+hl(esc(o[2]))+'</p><div><button class="btn sm" data-act="copyTxt" data-t="'+esc(o[2])+'">'+m.copyA+'</button></div></div></details>'; }).join("")+
   '</div><p class="small muted" id="einwnone" hidden>'+m.none+'</p></div>';
  h+='<div class="card stack"><h2>'+m.mineT+'</h2>'+[0,1,2].map(function(i){ return '<div class="grid2"><label class="field"><span>'+m.mineE+' '+(i+1)+'</span><input type="text" id="me'+i+'" data-bind="mine.e'+i+'" value="'+esc(S.mine["e"+i]||"")+'"></label><label class="field"><span>'+m.mineA+'</span><textarea id="ma'+i+'" data-bind="mine.a'+i+'" rows="2">'+esc(S.mine["a"+i]||"")+'</textarea></label></div>'; }).join("")+'</div>';
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
  var h=head("dup",m.lead)+'<div class="card stack"><h2>'+m.callT+'</h2>'+table(m.callCols,m.call.map(function(r){ return ['<b class="tab">'+r[0]+'</b>',r[1],'<span class="muted">'+r[2]+'</span>']; }))+'</div>'+
   '<div class="grid2"><div class="card"><h3>'+m.weekT+'</h3>'+ul(m.week)+'</div><div class="card"><div class="flow" style="flex-direction:column">'+m.flow.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div></div></div>'+
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
  if(m.say) h+='<div class="card stack"><h2>'+m.sayT+'</h2>'+table(m.sayCols,m.say.map(function(x){ return [x[0],'<span style="color:var(--bad)">'+x[1]+'</span>']; }))+'</div>';
  h+='<div class="grid2"><div class="card"><h3>'+m.salesT+'</h3>'+ul(m.sales)+'</div><div class="card hi"><h3>'+m.scaleT+'</h3>'+ul(m.scale)+'</div></div>'+quote([m.chain],"text-align:center");
  return h+task(L.ui.lbl.next,m.task);
};

/* ---------- Königsklasse ---------- */
function kingCopyBtn(mod,field,i){ return '<button class="btn sm pri" data-act="kcopy" data-k="'+mod+'" data-f="'+field+'" data-i="'+i+'">'+L.ui.copy+'</button>'; }
function kingTpl(mod,field,t,i,whyLabel){
  return '<div class="script kingtpl"><div class="row" style="justify-content:space-between"><div class="t">'+t[0]+' · '+t[1]+'</div>'+(t[2]?'<span class="badge b-mut">'+t[2]+'</span>':'')+'</div><p>'+txt(fillKing(t[3]))+'</p>'+(t[4]?'<p class="small muted"><b style="color:var(--teal)">'+(whyLabel||L.ui.why)+':</b> '+t[4]+'</p>':'')+'<div class="row">'+kingCopyBtn(mod,field,i)+'</div></div>';
}
function findK(id){ return S.kings.filter(function(k){return k.id===id;})[0]; }
function fillKing(x){ var k=findK(S.kpick); return k&&k.name? x.split("[Name]").join(k.name.split(" ")[0]).split("[Name König]").join(k.name) : x; }
function bandBadge(s){ var b=kBand(s), lab=L.m.kreife.bands[b]; return '<span class="badge '+(b===0?"b-ok":b===1?"b-warn":"b-bad")+'">'+s+' / 10 · '+lab[1]+'</span>'; }

R.kgesetze=function(){
  seen("kgesetze");
  var m=L.m.kgesetze, h=head("kgesetze",m.lead);
  h+='<div class="card hi kingcard"><div class="quote">'+m.motto+'<br><span style="color:var(--gold)">'+m.motto2+'</span></div></div>';
  h+='<div class="grid3">'+m.pillars.map(function(p,i){ return '<div class="card"><span class="label">0'+(i+1)+'</span><h3>'+p[0]+'</h3><p class="small muted" style="margin-top:4px">'+p[1]+'</p></div>'; }).join("")+'</div>';
  h+='<div class="stack"><h2>'+m.lawsT+'</h2><div class="grid2">'+m.laws.map(function(l,i){ return '<div class="card law"><span class="lawn">'+(i<9?"0":"")+(i+1)+'</span><h3>'+l[0]+'</h3><p class="small muted" style="margin-top:4px">'+l[1]+'</p></div>'; }).join("")+'</div></div>';
  h+='<div class="card stack"><h2>'+m.useT+'</h2><ol class="small">'+m.use.map(function(u){return '<li>'+hl(esc(u))+'</li>';}).join("")+'</ol></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.kreife=function(){
  var m=L.m.kreife, h=head("kreife",m.lead);
  h+='<div class="card stack"><h2>'+m.checkT+'</h2>'+m.check.map(function(c,i){ return '<label class="opt'+(S.kcheck[i]?" sel":"")+'" style="align-items:flex-start"><input type="checkbox" id="kch'+i+'" data-bind="kcheck.'+i+'"'+(S.kcheck[i]?" checked":"")+' style="margin-top:4px"> <span><b>'+c[0]+'</b><br><span class="small muted">'+c[1]+'</span></span></label>'; }).join("")+'</div>';
  h+='<div class="card stack"><div class="row" style="justify-content:space-between"><h2>'+m.dossT+'</h2><span class="badge b-mut">'+S.kings.length+'</span></div><p class="small muted">🔒 '+m.dossHint+'</p>'+
   '<form class="row" id="kingform"><input type="text" id="k_name" placeholder="'+esc(m.addPh)+'" autocomplete="off" style="flex:1 1 220px"><button class="btn gold" type="submit">'+m.add+'</button></form>';
  if(!S.kings.length) h+='<p class="muted small">'+m.empty+'</p>';
  else h+='<div class="stack">'+S.kings.map(function(k){
    var s=kScore(k), tp=k.type!==""&&k.type!=null?L.m.ktypen.types[k.type]:null;
    return '<div class="kingrow'+(S.kedit===k.id?" on":"")+'"><div style="min-width:0"><b>♛ '+esc(k.name)+'</b><div class="small muted">'+(tp?tp[0]+' · '+tp[1]:'–')+' · '+L.m.ksequenz.stages[k.stage||0]+'</div></div>'+bandBadge(s)+
      '<div class="row"><button class="btn sm" data-act="kedit" data-id="'+k.id+'">'+(S.kedit===k.id?m.close:m.edit)+'</button></div></div>'+(S.kedit===k.id?kingEditor(k):'');
  }).join("")+'</div>';
  h+='</div>';
  h+='<div class="card stack"><h2>'+m.scoreT+'</h2>'+table(m.scoreCols,m.score.map(function(r){ return ['<b>'+r[0]+'</b>',r[1],r[2],r[3]]; }))+
   '<div class="row">'+m.bands.map(function(b,i){ return '<span class="badge '+(i===0?"b-ok":i===1?"b-warn":"b-bad")+'">'+b[0]+'</span> <span class="small">'+b[1]+'</span>'; }).join(" ")+'</div><p class="small muted">'+m.scoreNote+'</p></div>';
  h+='<div class="card stack"><h2>'+m.motT+'</h2><p class="muted small">'+m.motLead+'</p>'+table(m.motCols,m.motives.map(function(r){ return ['<b>'+r[0]+'</b>',r[1],'<span style="color:var(--gold)">'+r[2]+'</span>'+(r[3]?'<div style="margin-top:4px">'+cond(r[3])+'</div>':'')]; }))+'</div>';
  return h+task(L.ui.lbl.task,m.task);
};
function kingEditor(k){
  var m=L.m.kreife, sc=k.sc||{};
  var h='<div class="card kingedit stack">';
  h+='<div class="grid2"><label class="field"><span>Name</span><input type="text" data-kbind="'+k.id+'.name" value="'+esc(k.name)+'"></label>'+
   '<label class="field"><span>'+m.typeL+'</span><select data-kbind="'+k.id+'.type" data-rr="1"><option value="">–</option>'+L.m.ktypen.types.map(function(t,i){ return '<option value="'+i+'"'+(String(k.type)===String(i)?" selected":"")+'>'+t[0]+' · '+t[1]+'</option>'; }).join("")+'</select></label></div>';
  h+='<div class="grid2">'+m.fields.map(function(f){ return '<label class="field"><span>'+f[1]+'</span><input type="text" data-kbind="'+k.id+'.'+f[0]+'" value="'+esc(k[f[0]]||"")+'" placeholder="'+esc(f[2])+'"></label>'; }).join("")+'</div>';
  h+='<div class="grid2"><label class="field"><span>'+m.motiveL+'</span><select data-kbind="'+k.id+'.motive"><option value="">–</option>'+m.motives.map(function(x,i){ return '<option value="'+i+'"'+(String(k.motive)===String(i)?" selected":"")+'>'+x[0]+'</option>'; }).join("")+'</select></label>'+
   '<label class="field"><span>'+m.stageL+'</span><select data-kbind="'+k.id+'.stage" data-rr="1">'+L.m.ksequenz.stages.map(function(s,i){ return '<option value="'+i+'"'+(String(k.stage||0)===String(i)?" selected":"")+'>'+s+'</option>'; }).join("")+'</select></label></div>';
  h+='<div class="stack"><div class="row" style="justify-content:space-between"><h3>'+m.scoreL+'</h3>'+bandBadge(kScore(k))+'</div><div class="grid2">'+m.score.map(function(r,i){ return '<label class="field"><span>'+r[0]+'</span><select data-kbind="'+k.id+'.sc.'+i+'" data-rr="1">'+[0,1,2].map(function(v){ return '<option value="'+v+'"'+(String(sc[i]||0)===String(v)?" selected":"")+'>'+v+' · '+r[v+1]+'</option>'; }).join("")+'</select></label>'; }).join("")+
   '<label class="field"><span>'+m.scoreDate+'</span><input type="date" data-kbind="'+k.id+'.scDate" value="'+esc(k.scDate||"")+'"></label></div></div>';
  h+='<div class="row"><button class="btn sm" data-act="kpickGo" data-id="'+k.id+'">✉ '+MT("knachr")+'</button><button class="btn sm ghost" style="color:var(--bad);border-color:var(--bad)" data-act="kdel" data-id="'+k.id+'">'+(kDelPending===k.id?m.delSure:m.del)+'</button></div>';
  return h+'</div>';
}
var kDelPending="";

R.ktypen=function(){
  seen("ktypen");
  var m=L.m.ktypen, h=head("ktypen",m.lead);
  h+='<div class="stack">'+m.types.map(function(t){
    return '<div class="card kingtype"><div class="row"><span class="roman">'+t[0]+'</span><h2>'+t[1]+'</h2><span class="badge b-teal">'+t[2]+'</span></div><p class="muted small" style="margin:6px 0 10px">'+t[3]+'</p>'+
      '<div class="tablewrap"><table class="nohead"><tbody>'+m.rows.map(function(r,i){ var v=t[4+i]; return '<tr><th scope="row">'+r+'</th><td'+(i===3?' style="color:var(--gold)"':i===4?' style="color:var(--bad)"':'')+'>'+v+'</td></tr>'; }).join("")+'</tbody></table></div></div>';
  }).join("")+'</div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.ksequenz=function(){
  seen("ksequenz");
  var m=L.m.ksequenz, h=head("ksequenz",m.lead);
  h+='<div class="stack seq">'+m.steps.map(function(s,i){ return '<div class="card seqstep"><span class="seqn">'+(i+1)+'</span><div class="stack" style="gap:4px;min-width:0"><div class="row"><h3>'+s[0]+'</h3><span class="badge b-teal">'+s[1]+'</span></div><p class="small"><span class="label" style="margin:0 6px 0 0">'+m.goalL+'</span>'+s[2]+'</p><p class="small" style="color:var(--bad)"><span class="label" style="margin:0 6px 0 0;color:var(--muted)">'+m.exitL+'</span>'+s[3]+'</p></div></div>'; }).join("")+'</div><p class="small muted">'+m.takt+'</p>';
  var counts=m.stages.map(function(){return 0;}); S.kings.forEach(function(k){ counts[k.stage||0]++; });
  h+='<div class="card stack"><h2>'+m.pipeT+'</h2><p class="small muted">'+m.pipeHint+'</p><div class="row">'+m.stages.map(function(s,i){ return '<span class="badge '+(i===8?"b-mut":"b-teal")+'">'+s+' <b class="tab" style="color:var(--fg)">'+counts[i]+'</b></span>'; }).join("")+'</div>';
  if(!S.kings.length) h+='<p class="muted small">'+m.pipeEmpty+'</p><div><button class="btn sm" data-go="kreife">'+MT("kreife")+' →</button></div>';
  else{
    var today=new Date().toISOString().slice(0,10);
    h+='<div class="tablewrap"><table><thead><tr>'+m.pipeCols.map(function(c){return '<th>'+c+'</th>';}).join("")+'</tr></thead><tbody>'+S.kings.map(function(k){
      var od=k.date && k.date<today && (k.stage||0)<7;
      return '<tr><td style="min-width:130px"><b>♛ '+esc(k.name)+'</b></td><td>'+bandBadge(kScore(k))+'</td><td><select data-kbind="'+k.id+'.stage" data-rr="1" style="min-width:160px">'+m.stages.map(function(s,i){ return '<option value="'+i+'"'+(String(k.stage||0)===String(i)?" selected":"")+'>'+s+'</option>'; }).join("")+'</select></td>'+
       '<td><input type="text" data-kbind="'+k.id+'.next" value="'+esc(k.next||"")+'" style="min-width:170px"></td><td><input type="date" data-kbind="'+k.id+'.date" data-rr="1" value="'+esc(k.date||"")+'" style="'+(od?"border-color:var(--bad)":"")+'"></td></tr>'; }).join("")+'</tbody></table></div>';
  }
  h+='</div><div class="card stack"><h2>'+m.kpiT+'</h2>'+table(m.kpiCols,m.kpis.map(function(r){ return ['<b>'+r[0]+'</b>',r[1],'<span class="muted">'+r[2]+'</span>']; }))+'</div>';
  h+='<div class="card hi stack"><h2>'+m.planT+'</h2><p style="font-size:17px">'+m.plan+'</p><p class="small muted">'+m.planNote+'</p></div>';
  h+='<div class="card stack"><h2>'+m.rhythmT+'</h2>'+table(["",""],m.rhythm.map(function(r){ return ['<b>'+r[0]+'</b>',r[1]]; }),"nohead")+'</div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.knachr=function(){
  seen("knachr");
  var m=L.m.knachr, h=head("knachr",m.lead);
  var opts='<option value="">'+esc(m.manual)+'</option>'+S.kings.map(function(k){ return '<option value="'+k.id+'"'+(S.kpick===k.id?" selected":"")+'>♛ '+esc(k.name)+' · '+kScore(k)+'/10</option>'; }).join("");
  h+='<div class="card stack"><label class="field" style="max-width:360px"><span>'+m.forKing+'</span><select id="kpick" data-bind="kpick" data-rr="1">'+opts+'</select></label></div>';
  h+='<div class="card stack"><h2>'+m.rulesT+'</h2><ol class="small">'+m.rules.map(function(r){return '<li>'+esc(r)+'</li>';}).join("")+'</ol></div>';
  h+='<div class="stack"><h2>'+m.firstT+'</h2><div class="grid2">'+m.first.map(function(t,i){ return kingTpl("knachr","first",t,i); }).join("")+'</div></div>';
  h+='<div class="stack"><h2>'+m.reactT+'</h2><p class="muted">'+m.reactLead+'</p><div class="card">'+ul(m.reactRules)+'</div><div class="grid2">'+m.react.map(function(t,i){ return kingTpl("knachr","react",t,i,"→"); }).join("")+'</div></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.kgespr=function(){
  seen("kgespr");
  var m=L.m.kgespr, h=head("kgespr",m.lead);
  h+='<div class="card stack"><h2>'+m.aT+'</h2>'+table(m.aCols,m.a.map(function(r){ return ['<b class="tab">'+r[0]+'</b>','<b>'+r[1]+'</b>',r[2]]; }))+'<div class="task" style="border-left-color:var(--teal)"><b style="color:var(--teal)">'+m.diagT+'</b><ol class="small">'+m.diag.map(function(q){return '<li>'+q+'</li>';}).join("")+'</ol></div></div>';
  h+='<div class="card stack"><h2>'+m.bT+'</h2>'+table(m.bCols,m.b.map(function(r){ return ['<b>'+r[0]+'</b>','<span class="tab">'+r[1]+'</span>',r[2]+(r[3]?'<div style="margin-top:4px">'+cond(r[3])+'</div>':'')]; }))+'</div>';
  h+='<div class="card hi kingcard stack"><h2>'+m.qT+'</h2><ol>'+m.q.map(function(q){return '<li>'+q+'</li>';}).join("")+'</ol><p class="small">'+m.silence+'</p></div>';
  h+='<div class="card stack"><h2>'+m.cT+'</h2><span class="label">'+m.cSub+'</span>'+ul(m.c.map(function(x){ return '<b>'+x[0]+'</b> '+hl(esc(x[1])); }))+'</div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.keinw=function(){
  seen("keinw");
  var m=L.m.keinw, h=head("keinw",m.lead);
  h+='<input type="text" id="keinwq" placeholder="'+esc(m.search)+'" autocomplete="off" style="max-width:420px"><div class="grid2" id="keinwlist">'+m.items.map(function(o){
    return '<div class="card stack" data-s="'+esc((o[0]+" "+o[1]+" "+o[2]).toLowerCase())+'"><h3>'+o[0]+'</h3><p class="small muted"><b>'+m.behind+'</b> '+o[1]+'</p><p class="small">'+o[2]+'</p><div class="row" style="justify-content:space-between"><span class="label" style="color:var(--gold);margin:0">'+m.goal+' '+o[3]+'</span><button class="btn sm" data-act="copyTxt" data-t="'+esc(o[2])+'">'+L.ui.copy+'</button></div></div>'; }).join("")+'</div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.kabschl=function(){
  seen("kabschl");
  var m=L.m.kabschl, h=head("kabschl",m.lead);
  h+='<div class="stack"><h2>'+m.fomoT+'</h2><div class="grid2">'+m.fomo.map(function(f,i){ return '<div class="card stack"><span class="lawn">0'+(i+1)+'</span><h3>'+f[0]+'</h3><div class="quote" style="font-size:17px;text-transform:none;border-left:3px solid var(--gold);padding-left:12px">'+f[1]+'</div><p class="small muted">'+f[2]+'</p><div>'+cond(f[3])+'</div></div>'; }).join("")+'</div></div>';
  h+='<div class="card stack"><h2>'+m.okT+'</h2>'+table(m.okCols,m.ok.map(function(r){ return ['<span style="color:var(--ok)">'+hl(esc(r[0]))+'</span>','<span style="color:var(--bad)">'+r[1]+'</span>']; }))+'<p class="small muted">'+m.uwg+'</p></div>';
  h+='<div class="stack"><h2>'+m.closeT+'</h2><div class="grid2">'+m.close.map(function(t,i){ return kingTpl("kabschl","close",t,i); }).join("")+'</div></div>';
  h+='<div class="card hi kingcard stack"><h2>'+m.gkT+'</h2><p class="muted">'+m.gkLead+'</p><div class="grid4">'+m.gkFacts.map(function(f){ return '<div class="kpi"><b>'+f[0]+'</b><span>'+f[1]+'</span></div>'; }).join("")+'</div>'+
   '<div class="task" style="border-left-color:var(--teal)"><b style="color:var(--teal)">'+m.gkCritT+'</b>'+ul(m.gkCrit)+'</div>'+
   '<h3>'+m.gkFlowT+'</h3>'+table(m.gkCols,m.gkFlow.map(function(r){ return ['<b class="tab">'+r[0]+'</b>',r[1]]; }))+
   '<div class="flow">'+m.gkChain.map(function(x){return '<span>'+x+'</span>';}).join("")+'</div><div>'+cond(m.gkCond)+'</div></div>';
  h+='<div class="stack"><h2>'+m.invT+'</h2><div class="grid2">'+m.inv.map(function(t,i){ return kingTpl("kabschl","inv",t,i); }).join("")+'</div></div>';
  return h+task(L.ui.lbl.task,m.task);
};

R.kkodex=function(){
  seen("kkodex");
  var m=L.m.kkodex, h=head("kkodex",m.lead);
  h+='<div class="card stack"><h2>'+m.swapT+'</h2>'+table(m.swapCols,m.swap.map(function(r){ return ['<s class="muted">'+r[0]+'</s>','<span style="color:var(--gold)">'+r[1]+'</span>']; }))+'</div>';
  h+='<div class="grid2"><div class="card stack"><h3>'+m.goodT+'</h3><div class="row">'+m.good.map(function(w){return '<span class="pill">'+w+'</span>';}).join("")+'</div></div><div class="card stack"><h3>'+m.badT+'</h3><div class="row">'+m.bad.map(function(w){return '<span class="pill badw">'+w+'</span>';}).join("")+'</div></div></div>';
  h+='<div class="card stack"><h2>'+m.rulesT+'</h2>'+m.rules.map(function(r,i){ return '<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="lawn">0'+(i+1)+'</span><p class="small"><b>'+r[0]+'</b> '+r[1]+'</p></div>'; }).join("")+'<p class="small muted">'+m.legal+'</p></div>';
  h+='<div class="stack"><h2>'+m.cheatT+'</h2><div class="grid2">'+m.cheat.map(function(c,i){ return '<div class="card'+(i===m.cheat.length-1?" cheatlast":"")+'"><h3 style="color:var(--gold)">'+c[0]+'</h3><p class="small" style="margin-top:6px">'+c[1]+'</p></div>'; }).join("")+'</div>'+
   '<div class="row kfooter">'+m.footer.map(function(f){return '<span>'+f+'</span>';}).join('<span class="muted">·</span>')+'</div></div>';
  return h+task(L.ui.lbl.task,m.task);
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
function importData(t){
  try{ var d=JSON.parse(t); if(!d || d.v!==VERSION || !Array.isArray(d.list)) throw 0; S=merge(blank(),migrate(d)); setLang(S.lang); save(); render(); toast(L.m.bk.loaded); }
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
function go(id){ if(!id||!L.mods[id]) return; S.view=id; kDelPending=""; save(); render(); window.scrollTo(0,0); try{ history.replaceState(null,"","#"+id); }catch(e){} }
function closeSide(){ var s=document.getElementById("side"), o=document.getElementById("ov"); if(s) s.classList.remove("open"); if(o) o.classList.remove("open"); }
function markContacted(g){ var c=findC(pick[g]); if(c && !c.status) c.status="NEU"; }
function switchLang(l){
  var n=document.getElementById("w_name"), ld=document.getElementById("w_leader");
  var cs=document.getElementById("w_consent");
  if(n) draftName=n.value; if(ld) draftLeader=ld.value; if(cs) draftConsent=cs.checked;
  setLang(l); save(); render();
}
function keepScroll(fn){ var y=window.scrollY; fn(); window.scrollTo(0,y); }
function filterList(inputId,listId,noneId){
  var q=(document.getElementById(inputId).value||"").trim().toLowerCase(), any=false;
  [].forEach.call(document.querySelectorAll("#"+listId+" [data-s]"),function(d){ var hit=!q||d.getAttribute("data-s").indexOf(q)>=0; d.hidden=!hit; if(hit) any=true; });
  var n=noneId&&document.getElementById(noneId); if(n) n.hidden=any;
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
   case "delC": S.list=S.list.filter(function(c){return c.id!==id;}); save(); keepScroll(render); break;
   case "rate": var c=findC(id); c[el.getAttribute("data-k")]=+el.getAttribute("data-v"); save(); keepScroll(render); break;
   case "copyScript": var grp=el.getAttribute("data-g"), sc=scripts(grp).filter(function(s){return s.id===id;})[0]; copyText(fill(sc.x,findC(pick[grp]))); S.sent[id]=(S.sent[id]||0)+1; markContacted(grp); save(); setTimeout(function(){ keepScroll(render); },50); break;
   case "waScript": S.sent[id]=(S.sent[id]||0)+1; markContacted(el.getAttribute("data-g")); save(); setTimeout(function(){ keepScroll(render); },300); break;
   case "copy4": var t=[0,1,2,3].map(function(i){return (S.sent["f4_"+i]||"").trim();}).filter(Boolean).join(" "); if(t) copyText(t); else toast(L.m.warm.fill4); break;
   case "copyStory": var st=[0,1,2,3].map(function(i){return (S.story[i]||"").trim();}).filter(Boolean).join(" "); if(st) copyText(st); else toast(L.m.talk.storyEmpty); break;
   case "copyTxt": copyText(el.getAttribute("data-t")); break;
   case "kcopy": var arr=L.m[el.getAttribute("data-k")][el.getAttribute("data-f")], row=arr[+el.getAttribute("data-i")]; if(row) copyText(fillKing(row[3])); break;
   case "kedit": S.kedit=S.kedit===id?"":id; kDelPending=""; save(); keepScroll(render); break;
   case "kdel": if(kDelPending!==id){ kDelPending=id; keepScroll(render); break; } S.kings=S.kings.filter(function(k){return k.id!==id;}); if(S.kpick===id) S.kpick=""; S.kedit=""; kDelPending=""; save(); keepScroll(render); break;
   case "kpickGo": S.kpick=id; save(); go("knachr"); break;
   case "delTalk": S.talks.splice(+el.getAttribute("data-i"),1); save(); keepScroll(render); break;
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
  if(act==="topToggle"){ var c=findC(el.getAttribute("data-id")); c.top=el.checked; if(!c.top) c.first5=false; save(); keepScroll(render); return; }
  if(act==="first5"){ var c2=findC(el.getAttribute("data-id")), n5=S.list.filter(function(x){return x.first5;}).length; if(el.checked && n5>=5){ el.checked=false; toast(L.m.top.max5); return; } c2.first5=el.checked; save(); return; }
  if(act==="pick"){ pick[el.getAttribute("data-g")]=el.value; keepScroll(render); return; }
  if(el.hasAttribute("data-kbind")){ kbind(el); if(el.hasAttribute("data-rr")) keepScroll(render); return; }
  if(el.hasAttribute("data-cbind") && (el.tagName==="SELECT"||el.type==="checkbox"||el.type==="date")){ cbind(el); if(el.hasAttribute("data-rr")) keepScroll(render); return; }
  if(el.hasAttribute("data-bind") && el.type==="checkbox"){ setPath(el.getAttribute("data-bind"),el.checked); save(); keepScroll(render); return; }
  if(el.hasAttribute("data-bind") && el.hasAttribute("data-rr")){ setPath(el.getAttribute("data-bind"),el.value); save(); keepScroll(render); return; }
});
document.addEventListener("input",function(e){
  var el=e.target;
  if(el.id==="einwq"){ filterList("einwq","einwlist","einwnone"); return; }
  if(el.id==="keinwq"){ filterList("keinwq","keinwlist"); return; }
  if(el.hasAttribute("data-bind") && el.type!=="checkbox"){ setPath(el.getAttribute("data-bind"),el.value); save(); liveUpd(); return; }
  if(el.hasAttribute("data-kbind") && el.tagName!=="SELECT" && el.type!=="date"){ kbind(el); return; }
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
function kbind(el){
  var p=el.getAttribute("data-kbind").split("."), k=findK(p[0]); if(!k) return;
  if(p[1]==="sc"){ if(!k.sc) k.sc={}; k.sc[p[2]]=+el.value; if(!k.scDate) k.scDate=new Date().toISOString().slice(0,10); }
  else k[p[1]]= (p[1]==="stage")?+el.value:el.value;
  save();
}
document.addEventListener("submit",function(e){
  e.preventDefault();
  var f=e.target;
  if(f.id==="startform"){
    var n=document.getElementById("w_name").value.trim(); if(!n){ toast(L.ui.needName); return; }
    var cb=document.getElementById("w_consent"); if(SYNC && cb && !cb.checked){ toast(L.ui.consentNeed); return; }
    S.name=n; S.leader=document.getElementById("w_leader").value.trim(); S.consent=!!(cb&&cb.checked); S.startedAt=Date.now(); S.view="start"; save(); render(); sync(false); return; }
  if(f.id==="addform"){ var inp=document.getElementById("add_name"), nm=inp.value.trim(); if(!nm){ inp.focus(); return; } S.list.push({id:uid(),name:nm,ctx:document.getElementById("add_ctx").value.trim(),cat:addCat}); save(); keepScroll(render); var ni=document.getElementById("add_name"); if(ni) ni.focus(); if(S.list.length===30) toast(L.m.list.t30); if(S.list.length===100) toast(L.m.list.t100); return; }
  if(f.id==="kingform"){ var ki=document.getElementById("k_name"), kn=ki.value.trim(); if(!kn){ ki.focus(); return; } var nk={id:uid(),name:kn,type:"",motive:"",sc:{},stage:0,next:"",date:""}; S.kings.push(nk); S.kedit=nk.id; save(); keepScroll(render); return; }
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
if(!L.mods[S.view]) S.view="start";
try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){}
render();
if(S.startedAt) setTimeout(function(){ if(!S.updatedAt) S.updatedAt=Date.now(); sync(false); },1500);
})();

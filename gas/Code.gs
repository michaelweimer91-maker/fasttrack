/**
 * Best Prime | ePOINT | ePAY – FastTrack Controlling
 * Empfängt den Fortschritt aller Vertriebspartner aus der Academy-App
 * und schreibt ihn in diese Google-Tabelle (eine Zeile pro Partner).
 *
 * Einrichtung: siehe ANLEITUNG.md – kurz:
 * 1. Code hier einfügen, TOKEN unten setzen (gleicher Wert wie in config.js).
 * 2. Funktion "setup" einmal ausführen (Berechtigungen bestätigen).
 * 3. Bereitstellen → Neue Bereitstellung → Web-App
 *    Ausführen als: Ich · Zugriff: Jeder → URL in config.js eintragen.
 */

var TOKEN = 'bp-ft-50a52f708f03';   // muss mit FT_CONFIG.token in config.js übereinstimmen
var SHEET_PARTNER = 'Partner';
var SHEET_LOG = 'Verlauf';
var SHEET_OVERVIEW = 'Übersicht';
var TZ = 'Europe/Berlin';

var HEAD = ['Partner-ID','Name','Leader','Sprache','Start','Letzte Aktivität','Ampel','Hebel für Leader',
  'Fortschritt %','Module erledigt','Aktuelles Modul','Status','Sprint (h übrig)',
  '60s-Durchgänge','60s-Freigabe Leader','Quiz bestanden','Namen auf Liste','TOP 10','Kontaktiert','Reaktionen',
  'Status NEU','Status TERMIN','Status FOLLOW-UP','Status ENTSCHEIDUNG','Status GESTARTET','Kein Interesse',
  'Gespräche','Nächste Schritte','Netzwerk-Hebel (von 5)','Warm-Ansprachen','Kalt-Ansprachen',
  'Starttyp','Warum','Ziel 12 Monate','Kontakte / Netzwerke','Zeit pro Woche','Stärke im Vertrieb','Braucht Unterstützung bei',
  'KPI: neue Kontakte','KPI: Gespräche','KPI: Präsentationen','KPI: gestartet','KPI: Follow-ups','KPI: neue Partner',
  'Eigener neuer Partner','Duplikation (von 5)','Erledigte Module'];

var STATUS_NAMES = ['Offen','Certified','Active','Proven'];

/* ---------- Einmalige Einrichtung ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);

  var sh = ss.getSheetByName(SHEET_PARTNER) || ss.insertSheet(SHEET_PARTNER, 0);
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#244653').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(1); sh.setFrozenColumns(3);
  sh.setColumnWidth(1, 90); sh.setColumnWidths(2, 2, 150); sh.setColumnWidth(8, 320); sh.setColumnWidths(33, 6, 240);
  sh.getRange('E:F').setNumberFormat('dd.MM.yyyy HH:mm');
  if (!sh.getFilter()) sh.getRange(1, 1, Math.max(2, sh.getMaxRows()), HEAD.length).createFilter();

  var g = sh.getRange('G2:G');
  var rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ROT').setBackground('#f4c7c3').setFontColor('#9c1c12').setBold(true).setRanges([g]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('GELB').setBackground('#fce8b2').setFontColor('#7a5300').setBold(true).setRanges([g]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('GRÜN').setBackground('#b7e1cd').setFontColor('#0b5a33').setBold(true).setRanges([g]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(80).setBackground('#b7e1cd').setRanges([sh.getRange('I2:I')]).build()
  ];
  sh.setConditionalFormatRules(rules);

  var log = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  log.getRange(1, 1, 1, 8).setValues([['Zeitpunkt','Partner-ID','Name','Leader','Fortschritt %','Status','Ampel','Hebel für Leader']]).setFontWeight('bold').setBackground('#244653').setFontColor('#ffffff');
  log.setFrozenRows(1); log.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');

  var ov = ss.getSheetByName(SHEET_OVERVIEW) || ss.insertSheet(SHEET_OVERVIEW, 0);
  ov.clear();
  ov.getRange('A1').setValue('FastTrack Controlling – Übersicht').setFontSize(16).setFontWeight('bold');
  ov.getRange('A3:B3').setValues([['Ampel','Partner']]).setFontWeight('bold');
  buildOverview_();
  ov.setColumnWidth(8, 160); ov.setColumnWidth(10, 70); ov.setColumnWidth(11, 360);
  var def = ss.getSheetByName('Tabellenblatt1') || ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'refreshAmpel') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('refreshAmpel').timeBased().everyHours(1).create();
  return sh;
}

/* ---------- Bewertung: Ampel + wo der Leader ansetzen soll ---------- */
function assess_(p, now) {
  var hInactive = p.updatedAt ? (now - p.updatedAt) / 3600000 : 999;
  var hSinceStart = p.startedAt ? (now - p.startedAt) / 3600000 : 0;
  var sprintOver = hSinceStart >= 72;

  var lever;
  if (!p.diagDone) lever = 'Startdiagnose gemeinsam ausfüllen';
  else if (p.pitchReps < 3) lever = '60-Sekunden-Erklärung üben lassen (' + p.pitchReps + '/3)';
  else if (!p.leaderOk) lever = '60-Sekunden-Check abnehmen und freigeben';
  else if (p.list < 30) lever = 'Namensliste anschieben (' + p.list + '/30 heute)';
  else if (p.top < 10) lever = 'TOP 10 gemeinsam priorisieren (' + p.top + '/10)';
  else if (p.contacted < 5) lever = 'Erste Ansprachen begleiten (' + p.contacted + '/5)';
  else if (p.talks < 1) lever = 'Erstgespräch gemeinsam führen (2er-Gespräch)';
  else if (p.list < 100) lever = 'Liste auf 100 ausbauen (' + p.list + '/100)';
  else if (p.dupDone < 1) lever = 'Ersten eigenen Partner starten';
  else lever = 'Läuft – Duplikation coachen';

  var ampel = 'GRÜN';
  if (p.certLevel >= 2) ampel = 'GRÜN';
  else if (hInactive > 72 || (sprintOver && p.talks < 1)) ampel = 'ROT';
  else if (hInactive > 24 || (hSinceStart > 24 && p.list < 30) || (hSinceStart > 48 && p.contacted < 5)) ampel = 'GELB';

  if (hInactive > 48 && hInactive < 999) lever = 'Anrufen – seit ' + Math.floor(hInactive / 24) + ' Tagen inaktiv · ' + lever;
  return { ampel: ampel, lever: lever, sprintLeft: Math.max(0, Math.round(72 - hSinceStart)) };
}

function toRow_(p, now) {
  var a = assess_(p, now);
  var d = p.diag || [], k = p.kpi || [], st = p.st || {};
  function dt(ms) { return ms ? new Date(ms) : ''; }
  return [p.pid, p.name, p.leader, String(p.lang || '').toUpperCase(), dt(p.startedAt), dt(p.updatedAt), a.ampel, a.lever,
    p.pct, p.doneCount + '/' + p.total, p.view, STATUS_NAMES[p.certLevel] || 'Offen', a.sprintLeft,
    p.pitchReps, p.leaderOk ? 'ja' : 'nein', p.quizOk ? 'ja' : 'nein', p.list, p.top, p.contacted, p.replies,
    st.NEU || 0, st.TERMIN || 0, st.FU || 0, st.ENT || 0, st.GO || 0, st.NO || 0,
    p.talks, p.nextSteps, p.net, p.warm, p.cold,
    p.type, d[0] || '', d[1] || '', d[2] || '', d[3] || '', d[4] || '', d[5] || '',
    num_(k[0]), num_(k[1]), num_(k[2]), num_(k[3]), num_(k[4]), num_(k[5]),
    p.dupPartner || '', p.dupDone, (p.doneModules || []).join(', ')];
}
function num_(v) { var n = Number(v); return v === '' || v == null || isNaN(n) ? '' : n; }

/* ---------- Übersicht (vom Script berechnet, unabhängig vom Tabellen-Gebietsschema) ---------- */
function buildOverview_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ov = ss.getSheetByName(SHEET_OVERVIEW), sh = ss.getSheetByName(SHEET_PARTNER);
  if (!ov || !sh) return;
  ov.getRange(3, 1, Math.max(ov.getMaxRows() - 2, 1), Math.min(ov.getMaxColumns(), 12)).clearContent().setBackground(null).setFontWeight('normal');
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues() : [];
  var cnt = { 'GRÜN': 0, 'GELB': 0, 'ROT': 0 }, byLeader = {}, alert = [];
  rows.forEach(function (r) {
    if (!r[0]) return;
    cnt[r[6]] = (cnt[r[6]] || 0) + 1;
    var l = r[2] || '(ohne Leader)';
    var b = byLeader[l] || (byLeader[l] = { n: 0, pct: 0, rot: 0, gelb: 0, kontakt: 0, gespr: 0 });
    b.n++; b.pct += Number(r[8]) || 0; b.kontakt += Number(r[18]) || 0; b.gespr += Number(r[26]) || 0;
    if (r[6] === 'ROT') b.rot++; if (r[6] === 'GELB') b.gelb++;
    if (r[6] === 'ROT' || r[6] === 'GELB') alert.push([r[1], r[2], r[6], r[7], r[5]]);
  });
  var colors = { 'GRÜN': '#b7e1cd', 'GELB': '#fce8b2', 'ROT': '#f4c7c3' };
  ov.getRange('A3:B3').setValues([['Ampel', 'Partner']]).setFontWeight('bold');
  ov.getRange('A4:B6').setValues([['GRÜN', cnt['GRÜN']], ['GELB', cnt['GELB']], ['ROT', cnt['ROT']]]);
  ['GRÜN', 'GELB', 'ROT'].forEach(function (k, i) { ov.getRange(4 + i, 1).setBackground(colors[k]).setFontWeight('bold'); });
  ov.getRange('A8').setValue('Nach Leader').setFontWeight('bold');
  var lh = [['Leader', 'Partner', 'Ø Fortschritt %', 'ROT', 'GELB', 'Kontaktiert', 'Gespräche']];
  var lr = Object.keys(byLeader).sort().map(function (k) { var b = byLeader[k]; return [k, b.n, Math.round(b.pct / b.n), b.rot, b.gelb, b.kontakt, b.gespr]; });
  if (!lr.length) lr = [['Noch keine Partner', '', '', '', '', '', '']];
  ov.getRange(9, 1, 1, 7).setValues(lh).setFontWeight('bold');
  ov.getRange(10, 1, lr.length, 7).setValues(lr);
  ov.getRange('H3').setValue('Wo muss ich drücken? (ROT + GELB)').setFontWeight('bold');
  alert.sort(function (x, y) { return (x[2] === 'ROT' ? 0 : 1) - (y[2] === 'ROT' ? 0 : 1) || new Date(x[4]) - new Date(y[4]); });
  ov.getRange(4, 8, 1, 5).setValues([['Partner', 'Leader', 'Ampel', 'Hebel für Leader', 'Letzte Aktivität']]).setFontWeight('bold');
  if (!alert.length) alert = [['Aktuell niemand auf ROT oder GELB', '', '', '', '']];
  ov.getRange(5, 8, alert.length, 5).setValues(alert);
  ov.getRange(5, 12, alert.length, 1).setNumberFormat('dd.MM.yyyy HH:mm');
  for (var i = 0; i < alert.length; i++) { var c = colors[alert[i][2]]; if (c) ov.getRange(5 + i, 10).setBackground(c).setFontWeight('bold'); }
}

/* ---------- Web-App-Endpunkt ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse(e.postData.contents);
    if (TOKEN && p.token !== TOKEN) return out_('forbidden');
    if (!p.pid || !p.name) return out_('invalid');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_PARTNER) || setup();
    sh = ss.getSheetByName(SHEET_PARTNER);
    var row = toRow_(p, Date.now());
    var ids = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues();
    var at = -1;
    for (var i = 0; i < ids.length; i++) { if (ids[i][0] === p.pid) { at = i + 2; break; } }
    var prevPct = null, prevStatus = null;
    if (at > 0) {
      prevPct = sh.getRange(at, 9).getValue();
      prevStatus = sh.getRange(at, 12).getValue();
      sh.getRange(at, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    if (prevPct === null || prevPct !== row[8] || prevStatus !== row[11]) {
      var log = ss.getSheetByName(SHEET_LOG);
      if (log) log.appendRow([new Date(), p.pid, p.name, p.leader, row[8], row[11], row[6], row[7]]);
    }
    buildOverview_();
    return out_('ok');
  } catch (err) {
    return out_('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}
function doGet() { return out_('FastTrack Controlling läuft.'); }
function out_(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }

/* ---------- Ampel stündlich aktualisieren (auch ohne neue Meldung) ---------- */
function refreshAmpel() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTNER);
  if (!sh || sh.getLastRow() < 2) return;
  var n = sh.getLastRow() - 1, now = Date.now();
  var data = sh.getRange(2, 1, n, HEAD.length).getValues();
  var outVals = data.map(function (r) {
    var p = { updatedAt: r[5] ? new Date(r[5]).getTime() : 0, startedAt: r[4] ? new Date(r[4]).getTime() : 0,
      certLevel: STATUS_NAMES.indexOf(r[11]), talks: r[26], list: r[16], contacted: r[18], top: r[17],
      diagDone: !!(r[32] && r[33] && r[34] && r[35] && r[36] && r[37]), pitchReps: r[13], leaderOk: r[14] === 'ja', dupDone: r[45] };
    var a = assess_(p, now);
    return [a.ampel, a.lever];
  });
  sh.getRange(2, 7, n, 2).setValues(outVals);
  var spr = data.map(function (r) { var s = r[4] ? new Date(r[4]).getTime() : now; return [Math.max(0, Math.round(72 - (now - s) / 3600000))]; });
  sh.getRange(2, 13, n, 1).setValues(spr);
  buildOverview_();
}


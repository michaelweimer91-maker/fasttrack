# Best Prime Vertriebs-FastTrack

Installierbare Web-App (PWA) für Vertriebspartner, 6 Sprachen, mit Controlling-Sync in ein Google Sheet.
Live: https://michaelweimer91-maker.github.io/fasttrack/  (GitHub Pages, Branch main, Root)

## Aufbau
- `src/app_head.html` – Titel + komplettes CSS + Root-Container
- `src/app.js` – gesamte App-Logik (Vanilla JS, kein Optional Chaining – iOS-Safari-kompatibel)
- `src/i18n/{de,en,it,hr,pl,tr}.js` – alle Texte. **de.js ist die Referenz**, alle Sprachen müssen exakt dieselbe Struktur haben.
- `build.py` – baut `index.html` aus src/. **Nach jeder Änderung in src/ ausführen** und index.html mit committen.
- `config.js` – Sync-URL (Google Apps Script /exec) + Token. Nicht ändern ohne Grund.
- `sw.js` – Offline-Cache, network-first (Updates kommen beim nächsten Öffnen automatisch).
- `gas/Code.gs` – Google Apps Script der Controlling-Tabelle „FastTrack Controlling – Best Prime“.
  Änderungen daran muss Michael selbst einspielen: Apps Script → Code ersetzen → Bereitstellen → Bereitstellungen verwalten → ✏️ → Neue Version (URL bleibt gleich).

## Regeln
- Texte immer in allen 6 Sprachen ändern; Platzhalter `{x}` und `[Name]`/`[Ime]`/… beibehalten.
- localStorage-Key `bp_fasttrack_v1` nicht ändern (sonst verlieren Partner ihren Fortschritt). Strukturänderungen über `migrate()` in app.js.
- Gesendete Felder (`payload()` in app.js) und Spalten (`HEAD`/`toRow_` in Code.gs) immer gemeinsam ändern.
- Keine Kontaktnamen der 100er-Liste übertragen (DSGVO, Daten Dritter).
- Design: dunkles Navy, Teal/Gold-Akzente, Anton + Poppins.

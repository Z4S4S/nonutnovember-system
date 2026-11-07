# NNN-Tracker – Übergabe für Claude

Diese Datei erklärt Claude alles, was man zum Weiterarbeiten an diesem Projekt braucht. Sie wird automatisch geladen, wenn das Repository in einer Claude-Session verbunden ist.

## Worum es geht

Eine Web-App für **No Nut November 2026** zwischen zwei Freunden: **Ahmad** (Nutzer, Spieler 1 / `p1`) und **Atakan** (Spieler 2 / `p2`). Beide nutzen sie auf dem iPhone als App auf dem Home-Bildschirm (Safari → „Zum Home-Bildschirm“).

- Live-Adresse: **https://nonutnovember-system.netlify.app** (Netlify-Projekt „nonutnovember-system“, öffentlich)
- Repository: **Z4S4S/nonutnovember-system** (privat), Branch `main`
- Jeder Push auf `main` wird von Netlify automatisch veröffentlicht (ca. 1–2 Minuten). Danach die App einmal schließen und neu öffnen.
- Der Nutzer lädt **keine Dateien** mehr selbst hoch – alle Änderungen laufen über dieses Repo.

## Wie der Nutzer arbeiten möchte

- Antworten auf **Deutsch**, kurz und knapp; er liest meist am **iPhone**.
- Er spricht oft per Sprache ein – Tippfehler wie „gespawnt“ (= geschworen) oder „Attacan“ sinngemäß lesen, bei Unklarheit kurz nachfragen.
- Er will Ergebnisse, keine Technik-Erklärungen. Nach einer Änderung: in 2–4 Sätzen sagen, was jetzt anders ist und dass er die App neu öffnen soll.
- Design-Wunsch: **Solo-Leveling-System-Look** (blaue System-Fenster, Glitch-Effekte, „[SYSTEM]“-Meldungen), hell/dunkel umschaltbar. **Keine Anime-Figuren.**

## Feste Abmachungen (nicht ändern ohne ausdrücklichen Wunsch)

- **Topf:** Jeder zahlt 50 € Einsatz. Jeder Rückfall kostet 50 € extra für die Person. Start = 100 €. Am Monatsende wird der Topf gemeinsam für etwas Cooles ausgegeben. Der Einsatz ist **nicht** in der App änderbar (bewusst entfernt).
- **Ehrenkodex** (Status-Seite), Text bleibt so, inkl. der letzten Zeile „Wer lügt, ist ein Hurensohn.“ – ausdrücklich vom Nutzer gewünscht. Beide gelten als geschworen am 1.11.2026.
- **Daily Quests** (ab Tag 8 / Woche 2, Abmachung vom 8.11.2026): pro Tag und Spieler 30 Liegestütze, 30 Sit-ups, 30 Squats, 10 Seiten lesen – darf über den Tag verteilt werden. **Nicht alles erledigt = 10 € in den Topf**, höchstens 10 € pro Tag (egal wie viel fehlt). Fällig erst, wenn der Tag vorbei ist. Belohnung: alles erledigt = +1 Level (100 XP); zusätzlich bringt jede Übung über dem Ziel anteilig Bonus-XP: 2× = 25, 3× = 50, 5× = 100 (= 1 Level), linear bis max. 10×. Bonus zählt pro Übung, auch wenn die Quest nicht ganz erfüllt ist. Konstanten `QWEEKS`, `QFINE`, `QBONUS`, `QCAP` in index.html – neue Woche mit anderen Zielen = weiterer Eintrag in `QWEEKS`.
- Islamische Inhalte: pro Tag ein Koranvers oder Hadith, **sinngemäß übersetzt mit Quellenangabe** (Sure:Vers bzw. Sammlung + Nummer, nur authentische/hasan Hadithe). Wissenschaft: echte Studien mit Quelle, ehrlich formuliert (kleine Studien / nur Zusammenhang als solche benennen).

## Aufbau

```
public/index.html            die komplette App (HTML + CSS + JS in einer Datei)
public/apple-touch-icon.png  App-Icon für den Home-Bildschirm
netlify/functions/sync.mjs   Sync-Funktion – GEBÜNDELT, nicht direkt bearbeiten
netlify.toml                 publish = "public", functions = "netlify/functions"
tools/sync.src.mjs           Quellcode der Sync-Funktion (hier bearbeiten)
tools/devserver.mjs          lokaler Testserver (App + echte Funktion + lokale Blobs)
tools/package.json           npm run build:fn  /  npm run dev
```

### Sync

- Endpunkt: `/.netlify/functions/sync` – `POST` (neue Challenge, gibt `{id}` zurück), `GET ?id=` (Stand laden), `PUT ?id=` (Stand senden; **der Server führt zusammen** und gibt den zusammengeführten Stand zurück).
- Speicher: **Netlify Blobs**, Store `nnn-tracker`, ein Eintrag pro Challenge-ID (strong consistency, Fallback auf normal). Schreiben mit ETag-Bedingung + bis zu 5 Wiederholungen.
- Die Challenge-ID steht in der App-Adresse (`?c=…`) und in `localStorage`. Die Home-Bildschirm-App merkt sich die Adresse mit ID.
- Die App fragt alle 15 s und beim Öffnen nach neuen Daten.

### Datenmodell (Client `norm()/merge()` in index.html und Server in tools/sync.src.mjs **müssen identisch bleiben**)

```js
{ v:1, year:2026,
  names:{ p1:{v,t}, p2:{v,t} },                 // Name + Zeitstempel
  days:{ "1".."30": { p1:{s,st,n,nt,ri,rw,rc}, p2:{…} } },
  cfg:{ base:50, per:50, t },                   // Einsatz (fest)
  pact:{ p1:{t}, p2:{t} } }                     // Ehrenkodex
```
- `s` = `"clean" | "relapse" | null`, `st` = Zeitstempel des Status
- `n` = Gedanken/Notiz, `nt` = Zeitstempel der Notiz
- `ri` / `rw` = Zeitpunkt, an dem Koran/Hadith bzw. Wissenschaft entschlüsselt wurde
- `rc` = Anzahl Rückfälle an diesem Tag (≥ 1, wenn `s = "relapse"`)
- `q` = Daily-Quest-Stand `{kürzel: Anzahl}` (z. B. `pu` Liegestütze, `su` Sit-ups, `sq` Squats, `rd` Seiten; Schlüssel sortiert, max. 8, Werte 0–1000 – neue Kürzel nimmt der Server ohne Änderung an), `qt` = Zeitstempel
- Zusammenführen: pro Feldgruppe gewinnt der neuere Zeitstempel (`st` für Status+rc, `nt` für Notiz, `qt` für q), `ri/rw` = Maximum, `pact` = Maximum, `cfg`/`names` nach `t`.
- **Neue Felder** immer in beiden `norm()` + `merge()` ergänzen, sonst verwirft der Server sie oder die App synct endlos.

### Funktionen der App

Status-Seite (Countdown, **Daily Quest** mit Regler + / +10 je Übung, **Topf** = Einsatz + Rückfälle + 10 € je verpasster Quest, Status-Fenster je Spieler mit Rang E–S, Level = Streak, Attribute Glaube/Wissen/Disziplin/Ausdauer/Reflexion, „Funkverkehr“ mit dem neuesten Eintrag des anderen, Tagesimpuls, Ehrenkodex, 11 Titel/Abzeichen, Kalender) · Tag (verschlüsselte Inhalte zum Antippen, Check-in Standhaft/Rückfall mit Anzahl, Gedanken – eigene editierbar, die des anderen nur lesbar) · Duell (VS, Streak-Kurve, Kopf an Kopf) · Logbuch (Chat-Ansicht, „Neu“-Markierung, rote Zahl am Tab) · Einstellungen (Namen, „Ich bin“, Hell/Dunkel, Sound, Intro, Freund einladen, Backup).
Effekte: Boot-Sequenz, System-Fenster mit Glitch, Level-Up- und Titel-Overlays, WebAudio-Sounds, Partikel.
Streak-Logik: Vergangene Tage ohne Eintrag zählen automatisch als geschafft; heute zählt erst nach „Standhaft“.
Level: **LV = Streak + Quest-Level** (Quest-Level = alle Quest-XP / 100, bleibt bei Rückfall erhalten). Rang E–S hängt weiter nur an der Streak. Attribut „Stärke“ = 10 + Wiederholungen/30, „Wissen“ bekommt +1 pro 10 Seiten.
Kalender: zweite, dünne Balkenreihe = Daily Quest (lila erfüllt, rot = 10 € Strafe). Einmalige Systemmeldung „Daily Quest“ pro Gerät (`nnn.qintro.<id>`), am neuen Tag Hinweis auf Strafe vom Vortag.

## Änderungen machen

1. `public/index.html` bearbeiten (bei Sync-Änderungen zusätzlich `tools/sync.src.mjs`, dann `cd tools && npm install && npm run build:fn`).
2. Syntax prüfen und lokal testen: `cd tools && npm run dev`, dann mit Playwright zwei Browser-Kontexte (= zwei Handys) gegen `http://localhost:8766/?debugDate=2026-11-12` laufen lassen – erstellen, beitreten, eintragen, gegenseitig sehen. Screenshots auf iPhone-Größe (390×844) anschauen.
3. Commit auf `main` mit kurzer deutscher Nachricht, pushen.
4. Dem Nutzer sagen: in 1–2 Minuten App schließen und neu öffnen.

## Bekannte Stolpersteine (schon gelöst)

- Externer Sync-Dienst jsonblob.com funktionierte bei ihm nicht → eigener Sync über Netlify Functions + Blobs.
- Netlify-Drop-Upload der Funktion klappte vom iPhone/Laptop nicht → Deploy nur noch über GitHub.
- Neue Netlify-Projekte sind standardmäßig **privat** → muss „public“ sein, sonst kommt Atakan nicht rein.
- Neue GitHub-Repos kann Claude nicht selbst anlegen – das macht der Nutzer.
- Der „Teilen“-Button in der App teilt nur den Link; „Zum Home-Bildschirm“ geht über Safaris eigenes Teilen-Menü.

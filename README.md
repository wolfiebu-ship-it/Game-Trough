# WALDWACHT

Ein Top-Down-Pixelspiel: Du verteidigst deine Waldburg gegen Wellen von Schrott-Bots.
Schwert, Herzen, Burgtor, Wald — alles steckt in **einer einzigen HTML-Datei**.
Kein Build, keine Assets, kein Server: jedes Pixel, jeder Baum und jeder Ton
entsteht beim Laden zur Laufzeit.

## Starten

`index.html` doppelklicken. Fertig. (Alternativ `npx serve .` — nötig ist es nicht.)

## Steuerung

**Tastatur und Maus**

| Eingabe | Aktion |
|---|---|
| `W A S D` / Pfeile | laufen (frei, analog — kein Raster) |
| Maus | zielen |
| Linksklick oder `Leertaste` | Schwerthieb |
| Rechtsklick oder `Q` | Pfeil schießen |
| `Shift` | Rolle (kurz unverwundbar, 2,8 s Wartezeit) |
| `H` | heilen: ein ganzes Herz, alle 15 Sekunden |
| `X` / `C` | Ultra auslösen / Ultra wechseln (ab Welle 10) |
| `B` | Shop öffnen und schließen (in der Ruhephase) |
| `1` `2` `3` `4` | Karte kaufen |
| `Enter` | nächste Welle früher starten |
| `P` / `Esc` | Pause (auch per gelbem Pixel-Knopf oben rechts) |
| `S` oder Antippen von „SPEICHERN" (in der Pause) | von Hand speichern |
| `N` (im Titelbild) | neues Spiel, auch wenn ein Spielstand da ist |
| `M` | Ton an/aus |

**Handy / Tablet** — zwei Daumensticks wie in Brawl Stars: links ziehen = laufen,
rechts ziehen = zielen. Rechts unten liegen die Tasten für **Schwert**, **Bogen**,
**Rolle**, **Heilen** und (sobald freigeschaltet) **Ultra** — alle auf einer Seite,
damit man beim Laufen nicht aus Versehen draufkommt. Oben rechts schalten zwei
kleine Knöpfe Pause (⏸) und Vollbild (⛶). In der Ruhephase öffnet der
**SHOP**-Knopf unten rechts das Werkstattfenster.

## Spielregeln

- **Herzen**: Du startest mit fünf Herzen (halbe Herzen zählen mit). Sie stehen
  oben links. Bei null ist Schluss.
- **Heilen**: alle 5 Sekunden wächst ein halbes Herz von selbst nach (der feine
  Streifen unter den Herzen zeigt den Fortschritt), dazu heilt die Heiltaste
  alle 15 Sekunden ein ganzes Herz.
- **Das Tor**: Die Bots rennen zur Burg und hacken auf das Tor ein. Fällt das
  Tor, ist das Spiel ebenfalls vorbei. Das Tor erkennt nur dich — du kannst
  hindurch, die Bots nicht.
- **Speicherstand**: Nach jeder gehaltenen Welle und jedem Kauf wird automatisch
  gespeichert. Im Titelbild erscheint dann „SPIELSTAND FORTSETZEN" — Leertaste
  oder Tippen setzt genau da fort, `N` (bzw. Antippen der Zeile) startet
  stattdessen ein neues Spiel und ersetzt den Stand. In der Pause speichert ein
  eigener, immer klickbarer „SPEICHERN"-Knopf zuverlässig von Hand.
- **Pause**: Der Rest des Spiels bleibt sichtbar, nur abgedunkelt und leicht
  durchscheinend (wie beim Baum-Geist-Effekt) — der Pausentext selbst sitzt
  in einem eigenen, gut lesbaren Kästchen. Aufgerufen per `P`/`Esc` oder dem
  gelben Pixel-Knopf oben rechts.
- **Ruhephase**: Nach jeder Welle bleiben 5 Sekunden. Im Burghof heilst du dich,
  eingesammelte Schrauben gibst du im Shop aus. Solange das Werkstattfenster
  offen ist, läuft die Ruhezeit nicht weiter. Ab Welle 10 gibt es nach jeder
  gehaltenen Welle eine Prämie obendrauf: 10 Schrauben ab Welle 10, 20 ab
  Welle 20, 30 ab Welle 30 — und ab Welle 50 das Doppelte der Wellenzahl
  (Welle 50 gibt 100, Welle 100 gibt 200), jeweils plus etwas Zufall.
- **Berührungssteuerung**: linker Daumen läuft, rechter zielt. Schwert, Bogen,
  Rolle, Heilen und Ultra liegen als Tasten unten rechts (die Ultra-Taste
  erscheint dort, sobald du das erste Ultra hast). Der Shop-Knopf sitzt
  unten rechts über den Kampftasten, damit er nicht in die Zone des
  Lauf-Sticks gerät.
- **Ultras**: Der Ultra-Balken füllt sich durch ausgeteilten Schaden. Nach
  Welle 3 gibt es den **Donnerblitz** (neun Einschläge auf die dicksten Bots
  in der Nähe, mit Betäubung), nach Welle 10 den **Klingensturm** (anderthalb
  Sekunden Wirbel, der alles im Umkreis zerlegt), nach Welle 15 den
  **Pfeilregen** (drei Salven in alle Richtungen), nach Welle 20 den
  **Donnerschlag** (Druckwelle, betäubt die Bots und heilt ein Herz). Mehrere
  Ultras wechselst du mit `C` oder durch Antippen des Namens. Sobald ein
  Kolossus auftaucht, ist der Balken geschenkt voll.
- **Kombo**: Zwei schnelle Hiebe hintereinander enden im dritten, schweren
  Schlag — mehr Schaden, mehr Wucht, weiter Bogen.
- **Deckung**: Durch Bäume läuft man hindurch — wer im Laub steckt, lässt die
  Krone durchscheinend werden, Farben und Umriss bleiben sichtbar. Das gilt auch
  für Bots dicht bei dir, damit niemand hinter einer Krone verschwindet. Büsche
  bremsen, Felsen und Mauern blockieren. Auf den Lichtungen kämpft es sich am
  freiesten.

## Die Bots

| Bot | Verhalten |
|---|---|
| **Späher** (cyan) | schnell, schwach, kommt in Rudeln |
| **Klinge** (orange) | stürzt sich mit Sägearmen nach vorn |
| **Schütze** (lila) | hält Abstand und schießt Energiebolzen |
| **Brecher** (rot, groß) | langsam, zäh, prügelt besonders hart aufs Tor |
| **Zünder** (gelb) | rennt heran und sprengt sich — reißt auch eigene Bots mit |
| **Kolossus** (Boss) | alle fünf Wellen: doppelt so groß wie du, stampft Druckwellen aus dem Boden, feuert Salven aus den Schulterwerfern und ruft Späher. Unter halber Lebensanzeige geht er in **Wut**: schneller, weitere Druckwellen, größere Salven, mehr Verstärkung |

## Verbesserungen

Zweiundzwanzig Karten, immer vier zufällige zur Auswahl.

*Kampf*: schärfere Klinge, Wirbelklinge, schnelle Hiebe, Blutdurst,
Dornenpanzer, **Feuerklinge** (Hiebe entzünden die Bots).
*Bogen*: schneller Köcher, scharfe Spitzen, **Eispfeile** (bremsen),
**Doppelschuss** (ein Pfeil mehr je Schuss).
*Überleben*: Extra-Herz, leichtere Stiefel, Hetzrolle, **Schutzschild**
(fängt einen Treffer ab und lädt sich nach), **Zweites Leben** (einmal
wieder auf die Beine).
*Burg und Beute*: Torpanzer, Notreparatur, **Turmwache** (die Burg schießt
selbst auf anrückende Bots), Schraubenmagnet, **Schatzsucher** (mehr Beute),
**Kampfgeist** (Ultra lädt schneller), Waldtrunk.

Im Werkstattfenster gibt es außerdem ein **Code-Feld**. Bekannte Codes (Groß-
oder Kleinschreibung egal): `FOREST` gibt 50 Schrauben, `WALDWACHT` schaltet
sofort das nächste Ultra frei (oder füllt die Leiste und gibt Schrauben,
wenn du schon alle hast). Jeder Code ist einmal je Durchlauf einlösbar.

## Technik

- reines HTML/CSS/JavaScript mit Canvas 2D, ~1800 Zeilen, keine Abhängigkeiten
- interne Auflösung 256 × 144 Spielpixel, gezeichnet in einen dreifach feinen
  Rückpuffer (768 × 432): die Welt scrollt dadurch in Drittelpixeln statt in
  ganzen Pixeln, bleibt aber knackig (`image-rendering: pixelated`)
- Simulation läuft bildsynchron mit der tatsächlich verstrichenen Zeit (in
  Teilschritten von höchstens 1/40 s); feste 60-Hz-Pakete ruckelten sichtbar
  auf 120-Hz-Bildschirmen
- Figuren und Bots sind handgepixelte Sprites, direkt als Zeichenketten im Code;
  gelaufen wird im Dreierzyklus, die Rolle ist eine gedrehte Kugelhaltung
- Wald, Boden, Burg und Tor werden prozedural gemalt (Wertrauschen, Pixelkreise);
  der Weltboden entsteht einmalig pixelweise und wird danach nur noch geblittet
- Tiefensortierung nach Fußlinie, damit man hinter Bäumen und Mauern verschwindet
- Kamera pixelgerastert fest am Helden: kein Nachziehen, kein Zittern
- eigene 5×7-Bitmapschrift für die gesamte Anzeige
- Juice: Hitstop, Screenshake, Funken, Schockwellen, Trefferblitz, Lagerfeuer
- alle Geräusche und die kleine Endlosmusik werden per WebAudio synthetisiert

Zum Herumprobieren liegt in der Konsole `window.WALDWACHT` mit `game`, `player`,
`enemies` und `spawnEnemy` bereit, z. B. `WALDWACHT.spawnEnemy('boss', 500, 320)`.

---

Das frühere Projekt **NEON CLASH** (2D-Fighting-Game) liegt weiterhin als
`neon-clash.html` im Repo.

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
| `Shift` oder Rechtsklick | Rolle (kurz unverwundbar) |
| `1` `2` `3` | Karte in der Ruhephase kaufen |
| `Enter` / `E` | nächste Welle früher starten |
| `P` / `Esc` | Pause · `M` Ton an/aus |

**Handy / Tablet** — zwei Daumensticks wie in Brawl Stars:
links ziehen = laufen, rechts ziehen = zielen und beim Loslassen zuschlagen,
kurzes Tippen rechts = Hieb nach vorn, `ROLLE`-Taste = ausweichen.
Karten in der Ruhephase einfach antippen.

## Spielregeln

- **Herzen**: Du startest mit fünf Herzen (halbe Herzen zählen mit). Sie stehen
  oben links. Bei null ist Schluss.
- **Das Tor**: Die Bots rennen zur Burg und hacken auf das Tor ein. Fällt das
  Tor, ist das Spiel ebenfalls vorbei. Das Tor erkennt nur dich — du kannst
  hindurch, die Bots nicht.
- **Ruhephase**: Nach jeder Welle bleiben 22 Sekunden. Im Burghof heilst du dich,
  eingesammelte Schrauben gibst du in der Kartenauswahl unten aus.
- **Kombo**: Zwei schnelle Hiebe hintereinander enden im dritten, schweren
  Schlag — mehr Schaden, mehr Wucht, weiter Bogen.
- **Deckung**: Büsche bremsen dich und die Bots, Bäume und Felsen blockieren
  Wege und Geschosse. Auf den Lichtungen kämpft es sich am freiesten.

## Die Bots

| Bot | Verhalten |
|---|---|
| **Späher** (cyan) | schnell, schwach, kommt in Rudeln |
| **Klinge** (orange) | stürzt sich mit Sägearmen nach vorn |
| **Schütze** (lila) | hält Abstand und schießt Energiebolzen |
| **Brecher** (rot, groß) | langsam, zäh, prügelt besonders hart aufs Tor |
| **Zünder** (gelb) | rennt heran und sprengt sich — reißt auch eigene Bots mit |
| **Kolossus** (Boss) | alle fünf Wellen: Schockwellen-Schlag und ruft Späher |

## Verbesserungen

Zwölf Karten, immer drei zufällige zur Auswahl: schärfere Klinge, leichtere
Stiefel, Extra-Herz, Wirbelklinge, Torpanzer, Hetzrolle, schnelle Hiebe,
Blutdurst, Dornenpanzer, Schraubenmagnet sowie Notreparatur und Waldtrunk
als Sofortkauf.

## Technik

- reines HTML/CSS/JavaScript mit Canvas 2D, ~1600 Zeilen, keine Abhängigkeiten
- interne Auflösung 384 × 216, hart hochskaliert (`image-rendering: pixelated`)
- feste Simulationsrate von 60 Hz (Accumulator-Loop), Rendern unabhängig davon
- Figuren und Bots sind handgepixelte Sprites, direkt als Zeichenketten im Code
- Wald, Boden, Burg und Tor werden prozedural gemalt (Wertrauschen, Pixelkreise);
  der Weltboden entsteht einmalig pixelweise und wird danach nur noch geblittet
- Tiefensortierung nach Fußlinie, damit man hinter Bäumen und Mauern verschwindet
- eigene 5×7-Bitmapschrift für die gesamte Anzeige
- Juice: Hitstop, Screenshake, Funken, Schockwellen, Trefferblitz, Lagerfeuer
- alle Geräusche und die kleine Endlosmusik werden per WebAudio synthetisiert

Zum Herumprobieren liegt in der Konsole `window.WALDWACHT` mit `game`, `player`,
`enemies` und `spawnEnemy` bereit, z. B. `WALDWACHT.spawnEnemy('boss', 500, 320)`.

---

Das frühere Projekt **NEON CLASH** (2D-Fighting-Game) liegt weiterhin als
`neon-clash.html` im Repo.

# WALDWACHT ARENA

Ein kleines, fieses 2D-Fighting-Game im Neon-/Retrowave-Look.
Alles steckt in **einer einzigen Datei** — kein Server, keine Installation, keine Assets.

## Starten

`index.html` doppelklicken. Fertig.

(Wer mag, kann auch `npx serve .` benutzen — nötig ist es nicht.)

## Steuerung

**Spieler 1**

| Taste | Aktion |
|---|---|
| `A` / `D` | laufen |
| `W` | springen |
| `S` | ducken |
| `J` | leichter Angriff (Jab) |
| `K` | schwerer Angriff (Smash) |
| `S` + `K` | tiefer Sweep |
| Sprung + `J` | Dive Kick |
| `L` | **NEON WAVE** (Special, kostet 50 Meter) |
| `H` oder `Shift` | blocken |
| `A`/`D` doppelt tippen | Dash |

**Spieler 2** (im 2-Spieler-Modus)

Pfeiltasten zum Bewegen, `,` leicht, `.` schwer, `/` Special, rechte `Shift` blocken.

`M` schaltet den Ton an/aus. Auf dem Handy erscheinen automatisch Touch-Buttons.

## Spielregeln

- **Best of 3**: Wer zwei Runden gewinnt, gewinnt den Kampf. 60 Sekunden pro Runde,
  bei Zeitablauf gewinnt die höhere Lebensanzeige.
- **Blocken ist gestaffelt** — genau hier liegt die Tiefe:
  - tiefe Angriffe (Sweep) kann man **nur geduckt** blocken
  - Sprungangriffe (Dive Kick) **nur im Stehen**
  - alles andere geht in beiden Haltungen
  - Blocken kostet trotzdem ein bisschen Chip-Schaden
- **Combos**: Treffer in Folge zählen hoch, aber jeder weitere Treffer macht weniger
  Schaden und stößt stärker weg — Endlos-Combos gibt es also nicht.
- **Special-Meter** füllt sich durch aus- und eingeteilten Schaden. Ab 50 % leuchtet
  die Figur, ab da ist die NEON WAVE zündbar (26 Schaden, riesige Reichweite).
- Wer am Boden liegt, ist beim Aufstehen unverwundbar.
- Die CPU hat drei Schwierigkeitsgrade und wird mit jeder Runde eine Spur aggressiver.

## Technik

- reines HTML/CSS/JavaScript mit Canvas 2D, ~1200 Zeilen, keine Abhängigkeiten
- feste Simulationsrate von 60 Hz (Accumulator-Loop), Rendern unabhängig davon
- echte Frame-Daten pro Move (startup / active / recovery), AABB-Hitboxen gegen Hurtboxen
- Juice: Hitstop, Slowmo beim K.O., Screenshake, Partikel, Dash-Nachbilder, Bodenspiegelung
- Figuren sind prozedural animiert (Gelenkwinkel pro Zustand), es gibt keine Sprites
- alle Sounds werden zur Laufzeit mit der WebAudio-API synthetisiert

Zum Herumprobieren liegt in der Konsole `window.WALDWACHT` mit `Game`, `F` (beide
Kämpfer) und `MOVES` bereit, z. B. `WALDWACHT.F[0].meter = 100`.

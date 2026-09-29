# STURMFALL

Ein 3D-Battle-Royale im bunten Low-Poly-Look, das direkt im Browser läuft.
Du springst aus einem Luftschiff ab, gleitest auf eine Insel, suchst Waffen, baust Deckung
und versuchst, als Letzte(r) übrig zu bleiben, während ein Sturm die Spielfläche immer kleiner macht.

Alle Namen, Figuren, Orte, Waffen und Inhalte sind selbst erstellt. Es werden keine Grafiken,
Sounds oder Marken aus anderen Spielen verwendet. Grafik und Sound werden komplett im Code erzeugt.

## Starten

`sturmfall/index.html` im Browser öffnen (Doppelklick reicht). Du brauchst keinen Server,
keine Installation und kein Internet: die 3D-Bibliothek [three.js](https://threejs.org) (MIT-Lizenz)
liegt bereits unter `js/lib/`.

Empfohlen: ein aktueller Chrome, Edge oder Firefox mit Maus und Tastatur.

## Hauptmenü

| Menüpunkt | Inhalt |
|---|---|
| **Neues Spiel** | Match einrichten: Spielername, Anzahl Gegner (1–49 Bots), Schwierigkeit (Leicht / Normal / Schwer / Profi), Start per Luftschiff oder direkt am Boden, Sturm-Tempo, Beute-Menge, Baumaterial (normal / Startbonus / unbegrenzt), Karten-Seed für eine bestimmte Insel |
| **Schnellstart** | startet sofort mit den zuletzt benutzten Einstellungen |
| **Spind** | 10 Outfits mit Live-Vorschau: Figur drehen, laufen lassen, tanzen |
| **Einstellungen** | siehe unten |
| **Statistik** | Siege, Eliminierungen, K/D, Top 10, beste Platzierung, Schaden … |
| **Steuerung & Hilfe** | alle Tasten und Tipps |

## Einstellungen (werden automatisch gespeichert)

- **Steuerung:** Maus-Empfindlichkeit (wie schnell man sich umschaut), eigene Empfindlichkeit beim
  Zielen und mit Zielfernrohr, Y-Achse invertieren, Sprinten/Ducken umschalten statt halten,
  Gleiter automatisch öffnen, Munition automatisch aufheben
- **Tasten:** jede Aktion frei belegbar (auch Maustaste 4/5)
- **Grafik:** Qualitäts-Voreinstellung, Schatten, Render-Auflösung, Sichtweite, Sichtfeld (FOV),
  Partikel, Kamera-Wackeln, FPS-Anzeige
- **Audio:** Gesamt, Effekte, Musik
- **HUD:** Farbe und Größe des Fadenkreuzes, Schadenszahlen, Minimap und Minimap-Zoom, HUD-Größe
- **Kamera:** Schulterseite (links/rechts), Kamera-Abstand

## Steuerung (Standard)

| Taste | Aktion |
|---|---|
| `W` `A` `S` `D` | laufen |
| `Shift` | sprinten |
| `C` | ducken |
| `Leertaste` | springen · im Luftschiff abspringen · im Fall den Gleiter öffnen |
| Linke Maustaste | schießen / bauen / mit dem Erntehammer schlagen / heilen |
| Rechte Maustaste | zielen (beim Präzisionsgewehr mit Zielfernrohr) |
| `R` | nachladen |
| `1` | Erntehammer |
| `2`–`6` | Inventar-Slots, alternativ Mausrad |
| `E` | aufheben / Truhe öffnen |
| `H` | Gegenstand fallen lassen |
| `Q` | Baumodus an/aus |
| `Z` / `X` / `V` / `F` | direkt Wand / Boden / Rampe / Dach bauen |
| `G` | Baumaterial wechseln (Holz → Stein → Metall) |
| `M` | große Karte |
| `B` | tanzen |
| `Esc` | Pause (mit Einstellungen) |

## Was drin ist

- **Animationen:** Die Figuren haben ein Gelenkskelett mit prozeduralen Animationen: stehen und
  atmen, gehen, sprinten, rückwärts und seitwärts laufen (Beine drehen in Laufrichtung), ducken,
  springen und fallen, freier Fall mit Sturzflug, Gleiter, Waffe halten und zielen, Rückstoß,
  Nachladen, mit dem Erntehammer ausholen und zuschlagen, heilen, getroffen zucken,
  drei Tanzbewegungen und Umfallen mit Auflösungseffekt.
- **Insel:** Jede Insel wird aus dem Seed neu erzeugt: Hügel, Berge, Strände, Wälder, Felsen, Büsche
  und acht benannte Orte (Städte, Bauernhöfe und Industriegebiete) mit begehbaren, teils
  zweistöckigen Häusern und Treppen, dazu Autos, Container, Silos und Heuballen.
- **Eliminierungen:** Wer eliminiert wird, fliegt vom Schützen weg durch die Luft, überschlagen und
  wild rudernd, prallt auf, flackert kurz und zerfällt dann in leuchtende Würfel in den eigenen
  Farben, mit Lichtsäule und Schockwellen-Ring. Bei eigenen Eliminierungen gibt es eine kurze
  Zeitlupe, einen Kamera-Ruck, einen animierten „ELIMINIERT“-Schriftzug mit Entfernung und
  Serien-Ansagen (Doppel, Dreifach, Vierfach …). Wird man selbst eliminiert, sieht man den eigenen
  Flug in Zeitlupe mit entsättigten Farben.
- **Alles ist zerstörbar** außer Böden und Fundamenten. Mit dem Erntehammer bekommst du Holz,
  Stein und Metall. Ab und zu gibt es einen Volltreffer mit doppeltem Material.
- **Bauen:** Wände, Böden, Rampen und Dächer rasten im 4-m-Raster ein. Es gibt eine Vorschau und
  Rampen-Treppen. Holz, Stein und Metall unterscheiden sich in Stärke und Aufbauzeit.
- **Waffen** in fünf Seltenheitsstufen: Funken-Pistole, Hummel-MP, Sturmkarabiner, Donner-Pumpe,
  Falkenauge (Zielfernrohr) und Knallrohr (Raketen mit Flächenschaden). Die Waffen haben Streuung,
  Bloom, Kopftreffer und Schadensabfall über die Entfernung.
- **Heilung:** Verband, Medikit, Mini-Schild, Schildtrank, Sprudelfrucht
- **Beute:** Goldene Truhen summen, wenn du in der Nähe bist. Außerdem gibt es Munitionskisten und
  Bodenbeute. Eliminierte Spieler lassen ihr ganzes Inventar fallen.
- **Sturm** in 7 Phasen: Die nächste Zone wird auf Karte und Minimap angezeigt, der Schaden steigt
  mit jeder Phase und der Schild schützt nicht davor.
- **Bots** landen, looten, bauen sich bei Beschuss Deckung, heilen sich, meiden den Sturm und
  kämpfen auch gegeneinander. Sie haben vier Schwierigkeitsstufen.
- **HUD:** Leben- und Schildleiste, Hotbar mit Seltenheitsfarben, Munition und Material, Minimap,
  Kompass, Killfeed, Schadenszahlen, Trefferanzeige, Richtungsanzeige für Schaden, Sturm-Timer
  und große Karte mit Planquadraten
- **Nach dem Tod** kannst du zuschauen, mit Linksklick zum nächsten Spieler wechseln oder direkt
  ein neues Spiel starten.

## Projektstruktur

```
sturmfall/
  index.html        Seite, HUD und Menüs
  style.css         Oberfläche
  js/lib/           three.js r149 (MIT)
  js/util.js        Mathe, Zufall, Rauschen, Speicher
  js/settings.js    Einstellungen, Tastenbelegung, Statistik
  js/audio.js       synthetische Sounds und Musik
  js/input.js       Tastatur, Maus, Pointer-Lock
  js/world.js       Insel, Häuser, Natur, Kollisionen, Raycasts
  js/items.js       Waffen, Gegenstände, Beute-Tabellen
  js/character.js  Figuren-Rig und Animationen, Outfits
  js/effects.js     Partikel, Leuchtspuren, Explosionen
  js/building.js    Bausystem
  js/storm.js       Sturm
  js/actor.js       Spieler/Bot: Physik, Inventar, Kampf
  js/bots.js        Bot-KI
  js/hud.js         HUD, Minimap, Karte
  js/game.js        Match-Ablauf
  js/ui.js          Menüs und Lobby
  js/main.js        Start und Hauptschleife
```

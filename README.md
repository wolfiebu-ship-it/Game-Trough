# WALDWACHT

Ein Top-Down-Pixelspiel: Du verteidigst deine Waldburg gegen Wellen von Schrott-Bots.
Schwert, Herzen, Burgtor, Wald — alles steckt in **einer einzigen HTML-Datei**.
Kein Build, keine Assets, kein Server: jedes Pixel, jeder Baum und jeder Ton
entsteht beim Laden zur Laufzeit.

## Starten

`index.html` doppelklicken. Fertig. (Alternativ `npx serve .` — nötig ist es nicht.)

## Als App aufs Handy

WALDWACHT ist eine installierbare Web-App (PWA) mit eigenem Icon, eigenem
Fenster ohne Browserleiste und Offline-Cache. Dafür muss die Seite über eine
echte `http(s)`-Adresse laufen (z. B. GitHub Pages), nicht als lokal
geöffnete Datei:

- **iPhone/iPad (Safari):** Seite öffnen → Teilen-Symbol → „Zum
  Home-Bildschirm“. Das Icon landet direkt neben den anderen Apps und
  startet vollflächig ohne Adressleiste.
- **Android (Chrome):** Seite öffnen → Menü (⋮) → „App installieren“ bzw.
  „Zum Startbildschirm hinzufügen“.

Technisch steckt dahinter `manifest.json` (Name, Icons, `display:
standalone`) und `service-worker.js` (cacht die Seite fürs Offline-Spielen).
Die Icons in `icons/` sind direkt aus dem Helden-Sprite des Spiels gerendert,
damit sie zum Rest passen.

## Steuerung

**Tastatur und Maus**

| Eingabe | Aktion |
|---|---|
| `W A S D` / Pfeile | laufen (frei, analog — kein Raster) |
| Maus | zielen |
| Linksklick oder `Leertaste` | Schwerthieb |
| Rechtsklick oder `Q` | Pfeil schießen (verbraucht einen Pfeil) |
| `F` (halten) | Schild: bleibt nur, solange du F hältst – höchstens 3 s und bis zu 3 Treffer |
| `Shift` | Rolle (kurz unverwundbar, 2,8 s Wartezeit) |
| `H` | heilen: ein ganzes Herz, alle 15 Sekunden |
| `X` / `C` | Ultra auslösen / Ultra wechseln (ab Welle 10) |
| `B` | Shop öffnen und schließen (in der Ruhephase) |
| `1` `2` `3` `4` | Karte kaufen |
| `Enter` | nächste Welle früher starten |
| `P` / `Esc` | Pause (auch per gelbem Pixel-Knopf oben rechts) |
| `S` oder Antippen von „SPEICHERN UND ZURÜCK" (in der Pause) | Stand sichern und zurück zur Auswahl der drei Spielwelten (im Level: eigener Level-Speicher, Fortsetzen über LEVEL) |
| `N` (im Titelbild) | neues Spiel, auch wenn ein Spielstand da ist |
| `M` | Ton an/aus |
| `?` / `F1` oder **HILFE**-Knopf im Titelbild | Steuerungs-Übersicht mit allen Tasten (auch in der Pause) |

Im Spiel liegen oben links unter **SUPERKRÄFTE!** zwei weitere Knöpfe im
selben Stil, alle untereinander (Listen klappen rechts daneben auf):
**ANLEITUNG** klappt eine kompakte Tastenliste auf, **LEVEL** zeigt, welche
Level geschafft, frei oder noch gesperrt sind. Antippen der Ultra-Leiste löst
das Ultra aus; geht es noch nicht (kein Ultra / noch nicht voll geladen), sagt
das Spiel warum. Im Titelbild stehen **HILFE**, **EINSTELLUNGEN** und **LEVEL** über den
Spielständen.

Tastatur/Maus ist immer aktiv. Die Touch-Oberfläche erscheint nur nach echtem
Antippen und verschwindet wieder, sobald man eine Taste drückt oder die Maus
bewegt.

**Handy / Tablet** — zwei Daumensticks wie in Brawl Stars: links ziehen = laufen,
rechts ziehen = zielen. Rechts unten liegen die Tasten für **Schwert**, **Bogen**,
**Rolle**, **Heilen** und (sobald freigeschaltet) **Ultra** — alle auf einer Seite,
damit man beim Laufen nicht aus Versehen draufkommt. Oben rechts schalten zwei
kleine Knöpfe Pause (⏸) und Vollbild (⛶). In der Ruhephase öffnet der
**SHOP**-Knopf unten rechts das Werkstattfenster.

## Einstellungen

Der Knopf **EINSTELLUNGEN** (im Titelbild in der Mitte, im Spiel oben links
unter LEVEL) öffnet ein Fenster mit:

- **Heldenname** (bis 12 Zeichen): steht klein über dem Helden, das Spiel
  begrüßt ihn beim Start („LOS, NAME!") und meldet „NAME IST GEFALLEN".
- **Lautstärke**, **Musik** und **Effekte** getrennt, je 0–10 (über −/+ oder
  direkt auf den Balken tippen).
- **Avatar**: zeigt dein Köpfchen. Antippen öffnet „FARBE WÄHLEN" mit 12 Farben
  (Grün, Gelb, Rot, Blau, Orange, Lila, Pink, Türkis, Hellblau, Braun, Weiß,
  Schwarz). Kapuze und Umhang des Helden nehmen die Farbe an, im Spiel, in der
  Rolle und auf den Speicherplätzen. Die Wahl bleibt gespeichert. Auch der Schwertschwung und die Luftwirbel um den Helden haben die Farbe des Helden.
- **Wackeln** an/aus: Bildschirmwackeln bei Treffern und Explosionen.

Während das Fenster offen ist, steht das Spiel. Alles wird im Browser
gespeichert und gilt auch nach dem Neuladen.

## Spielregeln

- **Herzen**: Du startest mit fünf Herzen (halbe Herzen zählen mit). Sie stehen
  oben links. Bei null ist Schluss.
- **Heilen**: alle 5 Sekunden wächst ein halbes Herz von selbst nach (der feine
  Streifen unter den Herzen zeigt den Fortschritt), dazu heilt die Heiltaste
  alle 15 Sekunden ein ganzes Herz.
- **Das Tor**: Die Bots rennen zur Burg und hacken auf das Tor ein. Fällt das
  Tor, ist das Spiel ebenfalls vorbei. Das Tor erkennt nur dich — du kannst
  hindurch, die Bots nicht.
- **Speicherstand**: Drei Speicherplätze nebeneinander im Titelbild. Ein
  belegter Platz zeigt „WELT 1/2/3" mit Heldenköpfchen, der erreichten Welle
  und „SCHRAUBEN: n" — antippen (oder `1`/`2`/`3`) setzt genau
  dort fort. Ein leerer Platz zeigt „NEUES SPIEL ANFANGEN" und startet dort
  ein frisches Spiel. Nach jeder gehaltenen Welle, jedem Kauf und beim
  Verlassen des Spiels wird automatisch in den aktiven Platz gespeichert (ein
  Spiel belegt immer nur seinen eigenen Platz, Level-Läufe gar keinen); in der Pause speichert
  zusätzlich ein eigener, immer klickbarer „SPEICHERN"-Knopf zuverlässig von
  Hand.
- **Ultra-Name**: Wählst du per Menü oder `C` ein Ultra aus, steht sein Name
  fünf Sekunden lang neben dem Knopf und verschwindet dann wieder, damit er
  nicht dauerhaft im Weg steht.
- **Pause**: Deutlich abgedunkelt, damit kein HUD-Text im Hintergrund lesbar
  bleibt — nur die Umrisse der Welt schimmern noch schwach durch. Aufgerufen
  per `P`/`Esc` oder dem gelben Pixel-Knopf direkt unter der Tor-Anzeige
  oben rechts. „SPEICHERN" ist in der Pixel-Schrift des Spiels gehalten,
  genau wie alle anderen Knöpfe. Die Pause ist „klebrig": Nur `P`/`Esc` oder
  erneutes Antippen des Pause-Knopfs setzt fort — Tippen irgendwo im Bild
  tut nichts mehr. Wechselt man die App, verliert das Fenster den Fokus oder
  geht der Bildschirm aus, pausiert das Spiel von selbst und bleibt es,
  bis man es bewusst wieder freigibt.
- **Pfeile**: Der Bogen ist nicht mehr unendlich. Zum Start gibt es 100
  Pfeile (die Zahl steht am BOGEN-Balken), je 10 besiegte Bots kommen 5 dazu,
  jeder eingelöste Code bringt zusätzlich 10. Der Code `PFEILE` gibt 30
  Pfeile und 20 Schrauben. Ohne Pfeile meldet das Spiel „KEINE PFEILE".
- **Schild (F halten)**: Eine leuchtende Blase um den Helden schluckt bis zu 3
  Treffer komplett – aber nur, solange du **F gedrückt hältst**, höchstens 3
  Sekunden. Lässt du los, verschwindet das Schild sofort (kurze Sperre von 2 s).
  Hält es 3 Treffer aus oder läuft die Zeit ab, lädt es 5 s nach (im Bosskampf
  10 s; SCHILD-Balken). Am Handy: die Taste SCHILD gedrückt halten.
- **Luftwirbel**: Um den Helden wehen kleine Wirbel in seiner Avatar-Farbe, im Stehen etwas
  mehr; beim Schlagen kommen Luftwirbel dazu.
- **Fokus**: Verliert das Spiel den Fokus (z. B. zum Chatten), werden alle
  gehaltenen Tasten losgelassen und das Spiel pausiert – der Held läuft nie
  von allein weiter.
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
  in der Nähe; gegen Bosse deutlich schwächer und ohne Betäubung). Jedes
  geschaffte Level schenkt dir **dauerhaft** eine neue Superkraft – genauso
  jede zehnte Welle im Endlos-Modus: Level 1 / Welle 10 den **Klingensturm**
  (Wirbel, der alles im Umkreis zerlegt), Level 2 / Welle 20 den **Pfeilregen**
  (drei Salven in alle Richtungen), Level 3 / Welle 30 den **Donnerschlag**
  (Druckwelle, betäubt die Bots, heilt ein Herz), Level 4 / Welle 40 den
  **Waldzorn** (Wurzeln reißen alles im großen Umkreis nieder und verlangsamen
  die Bots). Über den Code `DEMIRCI` gibt es zusätzlich den **Wurzelstich**:
  drei Ringe schießen zeitversetzt aus dem Boden und durchbohren alles
  ringsum – und **je nach Welt kommt etwas anderes heraus**: im Wald Wurzeln,
  in der Stadt Stahlstreben mit Funken, im Eis Kristalle, am Strand Tentakel,
  in der Hölle Lavasäulen. Der gelbe Knopf **SUPERKRÄFTE!** öffnet eine Liste
  aller besessenen Ultras zum Auswählen; `C` wechselt schnell durch.
  Sobald ein Boss auftaucht, ist der Balken geschenkt voll.
- **Kombo**: Zwei schnelle Hiebe hintereinander enden im dritten, schweren
  Schlag — mehr Schaden, mehr Wucht, weiter Bogen.
- **Deckung**: Durch Bäume läuft man hindurch — wer im Laub steckt, lässt die
  Krone durchscheinend werden, Farben und Umriss bleiben sichtbar. Das gilt auch
  für Bots dicht bei dir, damit niemand hinter einer Krone verschwindet. Büsche
  bremsen, Felsen und Mauern blockieren. Auf den Lichtungen kämpft es sich am
  freiesten.

## Level-Modus und Welten

Neben dem Endlos-Modus (drei Spielstände, unendlich viele Wellen) gibt es fünf
feste Level zum Durchspielen, jedes in einer **eigenen Welt** mit eigenem Boden,
eigenen Bäumen/Häusern, eigener Musik und eigenen Gegnern. Der Knopf **LEVEL**
(im Titelbild und im Spiel unter SUPERKRÄFTE!) zeigt, welche Level geschafft,
frei oder noch gesperrt sind.

| Level | Welt | Ziel | Gegner |
|---|---|---|---|
| 1 | **Wald** | Welle 5 (Kolossus) | die normalen Schrott-Bots |
| 2 | **Stadt** bei Nacht: Straße, Häuser (man kann komplett hindurchlaufen), Autos mit Abstand zu den Häusern, Laternen | Welle 10 (Glutgolem) | Schrott-Bots |
| 3 | **Eisberge**: Schnee, Kiefern, Eiskristalle, Schneefall | Welle 15 (Frostkoloss) | Eiswölfe, Alphawölfe, Pinguine, Eisbären, Schneemänner |
| 4 | **Strand**: Sand, Palmen, Meer, Möwen, die einzeln nacheinander vorbeifliegen, ruhige Musik | Welle 20 (Schattenfürst) | Seesterne, Krabben, Quallen, Riesenseesterne, Seeigel |
| 5 | **Hölle** (Endlevel): Lava, tote Bäume, Schädel, Glut | nur der **Teufel-Kolossus** | nur große Gegner: Teufel-Kolossus + Höllenbrecher, keine kleinen Roboter; gleichbleibendes Musiktempo |

Der **Teufel-Kolossus** ist der stärkste Gegner im Spiel: rot-schwarz, mit
Hörnern, größer als alle anderen, mit drei rotierenden Angriffsmustern
(Stampf-Druckwelle, Schulter-Salven, Teleport-Klingenwirbel). Er wird schon ab
65 % Leben wütend und ruft schneller Verstärkung. Das Endlevel ist bewusst richtig
schwer: Boss und Höllenbrecher sind schneller und härter als in Level 1–4.

In den Welten **Eis, Strand und Hölle** hat jeder Gegner einen **roten
Leben-Balken** über sich (nah dran steht zusätzlich die Zahl), damit man
sofort sieht, dass es ein Gegner ist und wie viel Leben er noch hat.

So schaltest du Level frei: Level 1 (und der **Endlos-Modus**, der im Wald
spielt) ist immer frei und ganz normal spielbar. **Ein geschafftes Level
schaltet das nächste frei.** Außerdem schaltet im Endlos-Modus **jede zehnte
Welle** das nächste Level frei: Welle 10 → Level 2, Welle 20 → Level 3,
Welle 30 → Level 4, Welle 40 → Endlevel. Einen Knopf zum Freischalten gibt es
nicht mehr; alte „alle frei"-Stände aus früheren Versionen werden beim Start
zurückgesetzt (vorhandene Spielstände zählen weiter). **Teleportieren:** Im Spiel öffnet der Knopf LEVEL unter SUPERKRÄFTE! eine Liste;
tippe eine Zeile an (HIN), um sofort in dieses Level/diese Welt zu springen, oder
„ENDLOS-SPIEL", um zurück in deinen Spielstand zu gehen. Ein laufendes Endlos-Spiel
wird vorher automatisch gespeichert. Ein gewonnenes Level bekommt „GESCHAFFT".

**Musik:** Jede Welt hat ihre eigene Musik (Stadt: ruhiger Nacht-Jazz,
Strand: chillig, Eis: sanft, Hölle: düster). Beim Levelwechsel wechselt die Musik
sofort, ohne Verzögerung.

Während eines Levels steht oben
„LEVEL 1 · WELLE 3/5", gesperrte Level zeigen „ERST LEVEL … ODER WELLE …".

Level-Durchläufe nutzen einen eigenen Fortschrittsspeicher (höchstes
freigeschaltetes Level) und rühren die drei Endlos-Spielstände nicht an.

**Beim Sterben** kannst du direkt weitermachen, ohne zum Titelbild zu müssen:
Im Endlos-Modus zeigt der Bildschirm die drei Spielstände. Der Stand beim Tod
wird automatisch in den aktuellen Platz gespeichert (die Welle, in der du
gestorben bist, zählt als nicht geschafft, also beginnst du genau mit ihr, mit
vollen Herzen und heilem Tor, Schrauben und Verbesserungen bleiben). Tippe einen
Platz an, um dort weiterzuspielen (ein leerer Platz startet ein neues Spiel),
oder drücke `1`/`2`/`3`, `Leertaste` (selber Platz) oder `Esc` (Titelbild). Im
Level-Modus gibt es „Nochmal versuchen", „Anderes Level" und „Zum Titelbild".

## Die Bots

| Bot | Verhalten |
|---|---|
| **Späher** (cyan) | schnell, schwach, kommt in Rudeln |
| **Klinge** (orange) | stürzt sich mit Sägearmen nach vorn |
| **Schütze** (lila) | hält Abstand und schießt Energiebolzen |
| **Brecher** (rot, groß) | langsam, zäh, prügelt besonders hart aufs Tor |
| **Zünder** (gelb) | rennt heran und sprengt sich — reißt auch eigene Bots mit |
| **Kolossus** (Boss) | Welle 5, 25, 45, … doppelt so groß wie du, stampft Druckwellen, feuert Salven aus den Schulterwerfern und ruft Späher. Unter halber Lebensanzeige **Wut**: schneller, mehr Salven, mehr Verstärkung |
| **Frostkoloss** (Boss) | Welle 15, 35, 55, … der eisblaue Bruder des Kolossus mit denselben Angriffen (Welle 5, 25, 45 bleiben dem Kolossus) |
| **Glutgolem** (Boss) | Welle 10, 30, 50, … reiner Nahkämpfer mit deutlich mehr Leben als der Kolossus, ein einzelner aber sehr weitreichender Feuerstampfer, ruft Brecher statt Späher |
| **Schattenfürst** (Boss) | Welle 20, 40, 60, … schneller und aggressiver als die anderen beiden, teleportiert sich mit einem kurzen Sprung heran und schlägt sofort mit einem Klingenwirbel zu |

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

Im Werkstattfenster gibt es außerdem ein gelb beschriftetes **Code-Feld**
("CODE EINLÖSEN" in der Pixelschrift, gut sichtbar über der Eingabe).
Bekannte Codes (Groß- oder Kleinschreibung egal): `FOREST` gibt 100
Schrauben, `WALDWACHT` gibt 250 Schrauben und schaltet zusätzlich das
exklusive Ultra **Waldzorn** frei (dicke Wurzeln reißen alles im Umkreis
nieder und verlangsamen die Bots), `DEMIRCI` gibt 300 Schrauben und schaltet
das exklusive Ultra **Wurzelstich** frei (drei zeitversetzte Ringe aus
Wurzeln durchbohren ringsum alles, was in Reichweite steht) — beide Ultras
gibt es sonst nirgends, nur über den jeweiligen Code. Wer sie schon hat,
bekommt stattdessen die volle Ultra-Leiste dazu. Daneben gibt es 17 weitere
Fundstück-Codes (`GLUTKERN`, `MONDSCHEIN`,
`SCHATTENPAKT`, `BAERENTATZE`, `WURZELWERK`, `STERNENSTAUB`, `NEBELGEIST`,
`RAUCHZEICHEN`, `STURMWIND`, `EISENHAUT`, `FUNKENFLUG`, `WOLFSSPRUNG`,
`RABENAUGE`, `NEBELSCHLEIER`, `FEUERSTEIN`, `FROSTHAUCH`, `GOLDADER`) —
manche schalten direkt eine Werkstatt-Verbesserung frei (oder geben
Schrauben, wenn die schon auf Maximalstufe ist), andere würfeln eine
zufällige Belohnung aus (Schrauben, volle Heilung, volle Ultra-Leiste,
Tor-Reparatur oder ein kleiner permanenter Bonus). Jeder Code ist einmal je
Durchlauf einlösbar. Alle Codes funktionieren in jedem Level – auch in Level 1.

### Codes je Level
| Level | Codes |
|---|---|
| 1 · Wald | `FOREST`, `PFEILE`, `WALDWACHT`, `DEMIRCI` und die Fundstück-Codes oben |
| 2 · Stadt | `STADTLICHT` (120 Schrauben, Ultra voll), `NEONNACHT` (Zufall), `STRASSENFEGER` (Schaden), `BETONHERZ` (Herz) |
| 3 · Eis | `EISZAPFEN` (Eispfeile), `SCHNEEBALL` (80 Schrauben, voll geheilt), `FROSTBISS` (Rolle), `POLARSTERN` (Ultra voll) |
| 4 · Strand | `MUSCHELHORN` (Zufall), `SONNENBRAND` (Feuerklinge), `WELLENREITER` (Tempo), `PALMENSCHATTEN` (Tor +40, voll geheilt) |
| 5 · Hölle | `HOELLENFEUER` (Feuerklinge + 100 Schrauben), `TEUFELSPAKT` (300 Schrauben), `LAVAHERZ` (Herz), `ASCHEREGEN` (100 Schrauben, Ultra voll) |

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

## Spielende
Besiegst du im Endlevel den Teufel-Kolossus, läuft die Endanimation (Feuerwerk,
Konfetti, „SIEG!", „ENDE"). Danach geht es mit der Leertaste zurück zur
Auswahl.

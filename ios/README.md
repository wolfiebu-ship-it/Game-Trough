# WALDWACHT als iOS-App

Native iOS-App (Swift/UIKit): Ein `WKWebView` zeigt das Spiel aus der mitgelieferten `../index.html`. Das Spiel läuft komplett offline, der Spielstand bleibt in der App gespeichert.

- Nur Querformat, Vollbild, Display bleibt beim Spielen an
- Ton auch bei aktiviertem Stumm-Schalter
- iPhone und iPad, ab iOS 15
- Vollbild-Knopf des Spiels ist in der App ausgeblendet

## Auf dem eigenen iPhone/iPad (Mac mit Xcode nötig)

```bash
brew install xcodegen          # einmalig
cd ios
xcodegen generate              # erzeugt Waldwacht.xcodeproj
open Waldwacht.xcodeproj
```

In Xcode: Ziel *Waldwacht* → *Signing & Capabilities* → eigenes **Team** (die normale Apple-ID reicht) wählen und bei Bedarf die *Bundle Identifier* (`de.waldwacht.spiel`) in etwas Eigenes ändern. iPhone anschließen, oben als Ziel wählen, ▶ drücken. Beim ersten Mal auf dem Gerät unter *Einstellungen → Allgemein → VPN & Geräteverwaltung* dem Entwickler vertrauen.

Mit kostenloser Apple-ID läuft die App 7 Tage, danach neu installieren. Für dauerhaft und für den App Store braucht es das Apple Developer Program (99 $/Jahr).

## Ohne Mac

Der GitHub-Workflow `.github/workflows/ios-build.yml` baut die App auf einem Mac-Server und legt eine **unsignierte `.ipa`** als Download ab (Actions → letzter Lauf → *Waldwacht-unsigned-ipa*). Die lässt sich z. B. mit Sideloadly oder AltStore und der eigenen Apple-ID auf das iPhone laden.

## Spiel ändern

Das Spiel ist die `index.html` im Hauptordner. Nach einer Änderung dort einfach in Xcode neu bauen, es gibt nichts zu kopieren.

## App Store

Icon (1024 px, ohne Transparenz) und `ITSAppUsesNonExemptEncryption` sind gesetzt. Es werden keine Daten gesammelt und nichts nachgeladen. Noch zu tun: App Store Connect-Eintrag, Screenshots, Datenschutz-Angabe „keine Daten erfasst“, Archivieren (*Product → Archive*) und hochladen.

# Tagesplaner (lokal-first PWA)

Tagesplaner für tägliche Routinen mit Journal, plus Dashboard für Fortschritt:
prozentuale Erfüllung der Themen, Gewichtsverlauf und Sport-Leistung aus
Apple Health / Apple Watch / Waage.

**Datenschutz:** Alle Daten bleiben im Browser des Geräts (localStorage).
Es gibt keinen Server, keine Cloud, kein Tracking. Die App wird nur lokal
geserved (z. B. `localhost`) und ist als PWA installierbar.

## Themen

Affirmationen, Meditation, Kälte (Dusche/Eisbad), Sport, Lesen, Dankbarkeit,
Visualisierung – pro Tag abhakbar, mit Streak-Anzeige.

## Start (nur lokal)

```sh
cd routine-planner
python3 -m http.server 8000
# Browser: http://localhost:8000
```

Danach optional als App installieren („Zum Home-Bildschirm hinzufügen" /
„Als App installieren"). Auf dem iPhone: Safari → Teilen → „Zum Home-Bildschirm".

## Bedienung

- **Heute:** Datum wählen, Themen abhaken, freier Journal-Text (Auto-Save).
- **Dashboard:** Zeitraum (7/14/30/90 Tage) wählen. Oben Kennzahlen (heute erledigt,
  Gewichtsänderung, aktive kcal, Workouts, Schritte, Journal-Tage), darunter die
  Themen nach Erfüllungs-% sortiert, Gewichtsverlauf als Kurve, aktive kcal pro Woche.
- **Daten:** Apple-Health-/Waagen-Daten importieren (JSON/CSV), eigene Daten als
  JSON exportieren oder löschen.

## Apple Health / Apple Watch importieren (über Kurzbefehle)

Apple Health hat keine Server-API. Der Weg: iOS-**Kurzbefehl** liest die Daten
per HealthKit aus und erzeugt JSON/CSV, das du in den Tab „Daten" einfügst
(Zwischenablage oder Datei).

Kurzbefehl bauen (iOS-App „Kurzbefehle"):

1. Neuer Kurzbefehl, z. B. „Health Export".
2. Aktion **„Gesundheitsdaten abrufen"** mehrfach hinzufügen, jeweils Datentyp wählen:
   Schritte, Aktive Energie (kcal), Trainingsdauer, Distanz Laufen/Gehen,
   Gewicht, Körperfettanteil – Zeitraum z. B. „Letzte 7 Tage" / „Letzte 30 Tage".
3. Pro Datentyp mit **„Wiederholen mit jedem"** eine Textzeile bauen:
   `Datum;Typ;Wert;Einheit` (z. B. über „Datum formatieren" auf `JJJJ-MM-TT`).
4. Ergebnis als Text/CSV anzeigen oder in Zwischenablage kopieren.
5. Optional als persönliche Automation „täglich 21:00 Uhr" laufen lassen.

### Akzeptierte Formate

JSON (Liste von Objekten):

```json
[
  {"date": "2025-06-10", "type": "steps", "value": 8432, "unit": "count"},
  {"date": "2025-06-10", "type": "activeEnergy", "value": 512, "unit": "kcal"},
  {"date": "2025-06-10", "type": "workoutMinutes", "value": 30, "unit": "min"},
  {"date": "2025-06-10", "type": "weight", "value": 82.4, "unit": "kg"},
  {"date": "2025-06-10", "type": "bodyFatPercent", "value": 18.2, "unit": "%"}
]
```

CSV mit Header `date,type,value,unit` (auch `;` als Trenner).

Typen (Aliase werden erkannt, inkl. HealthKit-Identifier wie
`HKQuantityTypeIdentifierStepCount`, `HKQuantityTypeIdentifierBodyMass`, …):

| Typ | Bedeutung |
|---|---|
| `steps` | Schritte |
| `activeEnergy` | aktive Kalorien (kcal) |
| `workoutMinutes` | Trainingsdauer (min, zählt auch als 1 Workout) |
| `distance` | Distanz (km) |
| `weight` | Gewicht (kg) |
| `bodyFatPercent` | Körperfett (%) |
| `muscleMass` | Muskelmasse (kg) |
| `boneMass` | Knochenmasse (kg) |
| `waterPercent` | Körperwasser (%) |
| `restingHeartRate` | Ruheherzfrequenz |
| `vo2max` | VO2max |

Duplikate (Datum+Typ+Wert+Einheit) werden beim Import automatisch übersprungen.

## Waage

Da alles über Apple Health läuft, landet das Wiegen automatisch im Import, sobald
die Waagen-App in Apple Health schreibt.

- **OMRON BF511** (dein Link): Bluetooth-Sync mit der App **OMRON connect**, die
  Gewicht, Körperfett %, BMI, Skelettmuskel %, viszerales Fett etc. erfasst und an
  **Apple Health** übergeben kann (Einstellungen → Health). Eine öffentliche
  Endkunden-API gibt es für die BF511 nicht (OMRONs „Connect Create"-API ist ein
  B2B-Partnerprogramm; Aggregatoren wie Terra/Thryve sind kostenpflichtig).
  → Für diesen Planer reicht das: Waage → OMRON connect → Apple Health → Kurzbefehl → App.
- **Empfehlung Withings** (z. B. **Body+** oder günstiger **Body**), wenn du neu kaufst
  und mehr willst: misst Gewicht, Fettmasse, **Muskelmasse**, Knochenmasse,
  Wasseranteil und hat eine **voll öffentliche OAuth2-API**
  (`POST wbsapi.withings.net/v2/measure action=getmeas`, meastypes u. a.
  1=Gewicht, 6=Fettanteil, 8=Fettmasse, 73=Muskelmasse, 88=Knochenmasse) –
  zusätzlich schreibt sie in Apple Health. Damit gäbe es später auch einen
  direkten Cloud-Sync ohne Apple Health in der Mitte.

## Tests

```sh
cd routine-planner
node --test 'tests/*.test.js'
```

Testet die gesamte Kernlogik (Check-ins, Streaks, Erfüllung %, Health-Import
JSON/CSV inkl. Aliase, Dedup, Gewichts-/Sport-Aggregation) – `js/core.js` läuft
identisch im Browser und unter Node.

## Aufbau

```
index.html            UI (Tabs: Heute / Dashboard / Daten)
css/style.css         Dark Theme
js/core.js            Kernlogik, rein, ohne DOM (Browser + Node)
js/app.js             UI-Wiring, localStorage, SVG-Charts
sw.js                 Service Worker (Offline-PWA)
manifest.webmanifest  PWA-Manifest
tests/core.test.js    Unit-Tests (node:test)
```

## Roadmap (nächste Schritte)

1. Kurzbefehle-Export automatisieren (tägliche Automation).
2. Direkt-Sync Withings-API (OAuth2) als Alternative zum Health-Import.
3. Ziele pro Thema mit Einheit (z. B. Meditation 10 min, Lesen 20 Seiten).
4. Wochen-/Monatsansicht, Export als PDF/CSV.
5. Optional native iOS-App mit HealthKit für echten Auto-Sync.

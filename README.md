# Finanzcockpit 💶📈

Dein privates Finanz-Dashboard für Bargeld, Bankkonten und dein Trade-Republic-Depot. Es besteht aus **einer einzigen Datei**, läuft komplett offline und ist verschlüsselt.

## Starten
Doppelklick auf **`Finanzcockpit.html`**. Die Datei öffnet sich in Edge, Chrome oder Firefox, eine Installation ist nicht nötig.
Beim ersten Start legst du ein Master-Passwort fest und wählst dann **eigene Daten** oder die **Demo**.

> Die Daten liegen im Speicher des Browsers, mit dem du die Datei öffnest. Nutze also immer denselben Browser und lege regelmäßig Backups an (Einstellungen → Backup).

## Als App auf PC & Handy (Web-App)
Die Web-Version liegt im Ordner `docs/` und wird über GitHub Pages ausgeliefert. Dort liegt **nur der Programmcode**, deine Daten bleiben verschlüsselt auf jedem Gerät.
- **PC (Edge/Chrome):** Seite öffnen → Einstellungen → „App installieren“
- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** ⋮ → „App installieren“

Nach der Installation läuft die App **offline**, und neue Versionen meldet sie selbst („Aktualisieren“).

### PC ⇄ Handy abgleichen
1. **Am PC:** Einstellungen → „Abgleich einrichten“ → **Neue Sync-Datei** im OneDrive- oder iCloud-Drive-Ordner anlegen.
2. **Am Handy beim ersten Start:** „Vom anderen Gerät übernehmen“ → diese Sync-Datei wählen → Passwort des PCs eingeben. Danach teilen sich beide Geräte denselben Tresor.
3. **Ab dann:** „Jetzt abgleichen“. Am PC wird beim Entsperren und Sperren automatisch abgeglichen. Am Handy wählst du die Datei aus und sicherst sie danach zurück.

Änderungen beider Geräte werden **zusammengeführt**: Pro Eintrag gewinnt die neuere Version, und Löschungen werden übernommen. Daueraufträge werden dabei nie doppelt gebucht.

## Funktionen
| Bereich | Was es kann |
|---|---|
| **Übersicht** | Gesamtvermögen mit Verlauf (1M bis Max), Verteilung, Sparquote, „Spielraum pro Tag“ bis Monatsende, automatische Insights |
| **Konten** | Bargeld, Bankkonten, Depots · Saldo-Abgleich mit der Banking-App · **Kassensturz** (Scheine und Münzen zählen) |
| **Buchungen** | Ausgaben, Einnahmen, Umbuchungen · Suche und Filter · lernt Kategorien aus deinen Notizen · Löschen mit Rückgängig |
| **Depot** | Positionen mit Ø Einstand und G/V · Kauf/Verkauf (Stückzahl aus Betrag) · Dividenden · Sparpläne werden automatisch ausgeführt |
| **Budgets** | Limits pro Kategorie mit Monatsfortschritt und Hochrechnung · Ausgaben-Kalender (Heatmap) |
| **Sparziele** | Fortschrittsringe, nötige Rate pro Monat, optional mit einem Konto verknüpft · Konfetti beim Erreichen 🎉 |
| **Fixkosten** | Daueraufträge und Abos werden am Fälligkeitstag automatisch gebucht · Abo-Check |
| **Prognose** | Zinseszins, Inflation, Sparraten-Dynamik · FIRE-Rechner (4-%-Regel) |

**Tastenkürzel:** `Strg K` Befehlspalette · `N` neue Buchung · `P` Privatmodus (Beträge verschleiert) · `L` sperren · `1`–`9` Bereiche
**Schnellerfassung:** In der Befehlspalette z. B. `4,20 Bäcker` oder `+2500 Gehalt` eintippen und Enter drücken.

## Sicherheit
- **AES-256-GCM** (authentifizierte Verschlüsselung). Der Schlüssel wird per **PBKDF2-SHA256 mit 600.000 Iterationen** und zufälligem Salt aus deinem Passwort abgeleitet.
- Eine **Content-Security-Policy verbietet jede Netzwerkverbindung**. Es gibt keine Cloud, kein Tracking und keine externen Bibliotheken.
- Der Schlüssel liegt nur im Arbeitsspeicher und lässt sich nicht exportieren. Die App sperrt sich bei Inaktivität automatisch. Nach Fehlversuchen beim Passwort steigt die Wartezeit.
- Backups (`.fcbak`) sind ebenfalls verschlüsselt. Nur der CSV-Export ist bewusst unverschlüsselt.
- ⚠️ **Für ein vergessenes Passwort gibt es keine Wiederherstellung.**

## Weiterentwickeln
Der Quellcode liegt in `src/` (`styles.css`, `js/01-…06-*.js`, `shell.html`). Nach Änderungen neu bauen:
```powershell
.\build.ps1
```

# AP19 – Aussehen der Figuren: Avatar-Editor (Plan, 20.10.2026)

**Auftrag:** 14.10.2026 ([ausblick.md](../ausblick.md), Abschnitt 2): „Figuren auf Basis der Vorlage-Avatare erstellen und Farben, Haare, Kleidung usw. ändern.“ Am 20.10.2026 beauftragt („baue direkt alle APs“).
**Umfang:** L, Schritt 0 plus drei Teilpakete (a–c). **Abhängig von:** AP18b (Formensprache, Bausteine in `frontend/src/ui/`), AP17b (Charaktereditor, Vorlagen). **Vor:** AP18h (Mitleben), damit man die eigene Figur gestalten kann.

## Ziel
Jede Figur hat ein **Aussehen als Daten** (Hautton, Frisur, Haarfarbe, Oberteil, Beine, Schuhe, Zubehör, Akzentfarbe). Es steht im Profil und damit in Vorlagen und Spielständen. Ein **Avatar-Editor** mit großer Vorschau ändert es. Alex und Mira sehen danach **Pixel für Pixel** aus wie heute.

## Ausgangslage
- Gezeichnet wird in `frontend/src/world/art/people.ts`: `interface Look` (Farben, `dress`, `longHair`, `clip`, `accent`), `LOOKS` für `alex` und `mira`, für alle anderen ein Aussehen aus der Kennung (`lookOf(id)`, Hash über `TOPS` und `HAIRS`). Figur 15 × 23 Pixel, Richtungen `down`, `up`, `left` (rechts gespiegelt), Bilder `stand`, 0–3, Pose `sit`; dazu `sleeper`, `lying`, `portrait`. Alles ist über `memo` nach `id|dir|frame|pose` zwischengespeichert.
- `lookOf`/`accentOf` werden auch für Schilder, Auswahlring, Bildnisse (`lib/Portrait.tsx`) und Besitzerfarben (`art/things.ts`, `ownerColor`) benutzt.
- Profil: `backend/simulacra/agents/model.py` (`AgentProfile`), gespeichert als JSON in `agent_profiles` (keine Migration nötig für ein neues Feld). Vorlagen: `agents/templates.py`, Schema und Grenzen `agents/schema.py` (`TEMPLATE_VERSION = 1`). Mitgelieferte Vorlagen: `agents/defaults/*.json`.
- API: `ProfileBrief` in `api/models.py` geht mit jedem `AgentInfo` ins Frontend.
- Charaktereditor: `frontend/src/assistent/Charaktereditor.tsx` mit `ProfilMaske.tsx`; erreichbar über Menü › Editoren › Figuren und aus dem Assistenten (Schritt Bewohner).

## Festlegungen
1. **Aussehen steht nie im Prompt** (Frage 64, Vorschlag). Die Bewohner „sehen“ es nicht; `profile_texts` in `agents/schema.py` bleibt unverändert. Ein Test sichert das.
2. **Ändern im laufenden Spiel** nur in der Spielart Gott (Bewohner-Karte › Aussehen, Zeit steht still) und für die eigene Figur (AP18h). In der Spielart Leben lehnt das Backend mit 403 ab (Frage 65).
3. Das Ereignis `agent.appearance_changed` hat **keine Agenten** (`agents=[]`) und wird von `agents/observations.py` nicht beachtet (dort steht eine feste Liste von Ereignistypen; der neue Typ kommt **nicht** hinein). Es erzeugt also keine Erinnerung.
4. **Neue Pixelteile** (Frisuren, Hüte, Brille, Bart, Hauttöne) gibt es nur nach Mockup und Abnahme (Mockup-Treue). Bis dahin kann der Editor nur, was `people.ts` heute zeichnen kann (Farben, kurz/lang, Kleid/Hose, Spange).
5. Ohne gespeichertes Aussehen bleibt alles wie heute (Aussehen aus der Kennung).

## Datenformat `Appearance` (Version 1)
Backend `backend/simulacra/agents/appearance.py` (neu), Pydantic, `extra="forbid"`:
```python
HEX = r"^#[0-9a-f]{6}$"
class Appearance(BaseModel):
    version: Literal[1] = 1
    skin: str = Field("#f7cba2", pattern=HEX)                   # heute WP.skin
    hair_style: Literal["kurz", "lang"] = "kurz"                # nach Abnahme: "zopf", "dutt", "locken", "glatze"
    hair: tuple[str, str]                                       # Grundfarbe, Glanz (hairHi)
    top_style: Literal["hemd", "kleid"] = "hemd"                # nach Abnahme: "pulli", "schuerze", "mantel"
    top: tuple[str, str, str]                                   # Grund, hell (topHi), dunkel (topLo)
    legs: str = Field(pattern=HEX)                              # bei Kleid meist Hautfarbe
    shoes: str = Field("#5a3a2a", pattern=HEX)
    accessory: Literal["keins", "spange"] = "keins"             # nach Abnahme: "hut", "muetze", "brille", "tuch", "bart"
    accessory_color: str | None = Field(None, pattern=HEX)
    accent: str = Field(pattern=HEX)
```
Jede Farbe in den Tupeln wird mit demselben Muster geprüft (Validator). `AgentProfile` bekommt `appearance: Appearance | None = None`. `ProfileBrief` bekommt dasselbe Feld. `scripts/gen_types.sh` erzeugt den TypeScript-Typ.

**Alex und Mira** bekommen in `agents/defaults/alex.json` und `mira.json` ein `appearance`, das **genau** die heutigen Werte aus `LOOKS` trägt:
- Alex: `skin #f7cba2`, `hair_style kurz`, `hair [#7a4a2b, #9b6a44]`, `top_style hemd`, `top [#efa24b, #ffc07a, #c9802f]`, `legs #4f6c9c`, `shoes #5a3a2a`, `accessory keins`, `accent #e8ac5c`.
- Mira: `skin #f7cba2`, `hair_style lang`, `hair [#3d2a3c, #5a4058]`, `top_style kleid`, `top [#7fc48f, #a2dcae, #5ea873]`, `legs #f7cba2`, `shoes #c95c6c`, `accessory spange`, `accessory_color #ff9fc2`, `accent #93c79f`.
Hanne, Jonas, Rosa und Kim bekommen **kein** `appearance` in a (sie behalten ihr Aussehen aus der Kennung); die Projektleitung kann ihnen später eines geben.

## Schritt 0 – Mockup und Fragen (eine Sitzung, kein Anwendungscode)
1. Mockup `docs/mockups/avatar.html` mit `docs/mockups/avatar/` im Stil von `docs/mockups/rework/stil.css`:
   - **Bild 1, Avatar-Editor** als Bereich in Menü › Editoren › Figuren › (Vorlage) › Reiter „Aussehen“: links große Vorschau (Figur 8-fach vergrößert, `image-rendering: pixelated`), darunter vier Knöpfe für die Richtungen und „Laufen“ (Animation 0–3), daneben das Bildnis in 44 und 88 px. Rechts Gruppen: **Haut** (6 Töne), **Frisur** (Chips), **Haarfarbe** (8 Felder + „eigene …“), **Oberteil** (Chips Hemd/Kleid …), **Farbe** (10 Felder + eigene), **Beine**, **Schuhe**, **Zubehör** (Chips + Farbe), **Akzent**. Oben „Würfeln“, „Zurück zur Vorlage“, unten „Speichern“.
   - **Bild 2, Teilebogen:** alle neuen Teile in allen Richtungen und Laufbildern auf Wiese und im Haus (Tiefe und Flach), je auf Alex' und Miras Körper: Frisuren Zopf, Dutt, Locken, Glatze; Oberteile Pulli, Schürze, Mantel; Zubehör Hut, Mütze, Brille, Tuch, Bart; 6 Hauttöne. Gezeichnet mit derselben `Spr`-API wie `people.ts` (das Mockup darf `docs/mockups/` eigene Kopien von `pen.ts`-Hilfen benutzen).
   - **Bild 3, im Spiel:** Bewohnerleiste und Bewohner-Karte (AP18b) mit drei neuen Figuren, damit man sieht, ob sie sich gut unterscheiden.
2. Fragen in `docs/offene-fragen.md` ergänzen, wenn das Mockup neue aufwirft. **Abnahme durch die Projektleitung**, bevor a beginnt.

## AP19a – Aussehen als Daten, Zeichnen daraus (keine sichtbare Änderung)
1. **Pixel-Basis sichern (zuerst!):** Vitest läuft ohne Canvas (`environment: "node"`), darum im Browser: Hänge in `people.ts` eine Testhilfe an `window.__figuren = { hash(id, dir, frame, pose) }` (nur wenn `import.meta.env.DEV` oder `?test` in der Adresse, wie `window.__welt` in `e2e/bilder-editor.spec.ts`). `hash` zeichnet die Figur und bildet FNV-1a über `getImageData`. Playwright `frontend/e2e/figuren-basis.spec.ts` ruft das für `alex`, `mira`, `hanne`, `x1`, `x2` je Richtung × Bild × Pose (`""`, `"sit"`) auf, dazu `sleeper` und `portrait(…, 44)`, und vergleicht mit `frontend/e2e/fixtures/figuren-basis.json`. **Test und Datei entstehen auf dem alten Code und werden committet, bevor `people.ts` sonst geändert wird** (Schalter `UPDATE_BASIS=1` schreibt die Datei neu).
2. Backend: `appearance.py`, Feld im Profil und in `ProfileBrief`, Defaults für Alex und Mira, Typen erzeugen. Vorlagen-Export und -Import (`agents/templates.py`) nehmen `appearance` mit; alte Vorlagen ohne das Feld laden weiter (Test). `TEMPLATE_VERSION` bleibt 1, weil das Feld optional ist.
3. Frontend `frontend/src/world/art/avatar.ts` (neu):
   - `toLook(ap: Appearance): Look` – `dress = top_style === "kleid"`, `longHair = hair_style === "lang"`, `clip = accessory === "spange" ? accessory_color : undefined`, alle Farben 1:1.
   - `appearanceKey(ap): string` – stabile Kurzform (`JSON.stringify` der Felder in fester Reihenfolge).
   - Register: `registerAppearance(id: string, ap: Appearance | null)` und `appearanceOf(id)`. Änderungen erhöhen einen Stempel je Kennung.
4. `people.ts`: `lookOf(id)` fragt zuerst das Register (`toLook`), dann `LOOKS`, dann den Hash. Die `memo`-Schlüssel von `figure`, `sleeper`, `lying` bekommen den Stempel dazu (`${id}#${stamp}|…`), damit eine Änderung neu zeichnet. `LOOKS` bleibt als Rückfall für Spielstände ohne `appearance`.
5. `simStore`: Beim Snapshot und bei jedem `AgentInfo` mit `profile.appearance` → `registerAppearance`. Bei `agent.appearance_changed` → Profil neu holen (wie bei Profiländerungen heute) und registrieren.
6. **Prüfen:** `figuren-basis.spec.ts` grün (Alex und Mira gleich, obwohl jetzt aus Daten gezeichnet), Goldbilder unverändert, Prompt-Test „kein Aussehen im Prompt“ (`tests/agents/test_planner.py`: Profil mit auffälliger Farbe `#123456` → das Wort kommt im Prompt nicht vor).

## AP19b – Der Avatar-Editor
1. Komponenten in `frontend/src/avatar/` (neu): `AvatarEditor.tsx` (Gesamtbild), `AvatarVorschau.tsx` (Canvas, Richtungen, Laufen mit `requestAnimationFrame`, 4 Bilder je Sekunde), `FarbFelder.tsx` (Felder plus „eigene …“ mit `<input type="color">`), `avatarStore.ts` (Entwurf, Rückgängig für die letzten 20 Schritte, „Zurück zur Vorlage“).
2. **Farbsätze** in `avatar/farben.ts`: Hauttöne (6), Haarfarben (8, je `[Grund, Glanz]`, die vier aus `HAIRS` plus Alex und Mira plus Grau `#8a8a8a/#b0b0b0` und Rot `#a8402a/#c86a50`), Oberteile (10, je `[Grund, hell, dunkel]`, die fünf aus `TOPS`, Alex, Mira und drei neue). Bei „eigene Farbe“ rechnet `schattierung(hex)` hell (+18 % Helligkeit) und dunkel (−18 %) aus; die Funktion hat einen Vitest.
3. **Würfeln** mit sichtbarem Seed wie im Assistenten (`assistent/wuerfeln.ts` als Vorbild), nur aus den Farbsätzen.
4. **Einbau:** Reiter „Aussehen“ im Charaktereditor (neben der Profilmaske), Knopf „Aussehen …“ im Assistenten, Schritt Bewohner (öffnet den Editor als Ebene; Esc führt zurück, AP18a). Gespeichert wird mit der Vorlage bzw. im Entwurf des Assistenten.
5. Aussehen und Formensprache **1:1 nach Mockup Bild 1**.
6. **Prüfen:** Playwright `frontend/e2e/avatar.spec.ts`: Vorlage kopieren, Haarfarbe ändern, speichern, neu laden → Farbe da; Assistent mit dieser Vorlage starten → Bildnis in der Bewohnerleiste hat die Farbe (Pixel an fester Stelle prüfen); Esc führt Ebene für Ebene zurück.

## AP19c – Im Spiel und neue Teile
1. **Gott:** Bewohner-Karte (AP18b) › „Aussehen“ öffnet den Editor für den laufenden Bewohner. `PATCH /api/agents/{id}/appearance` (neu, in der Spielart Leben 403 mit Text „In der Spielart Leben verändert niemand von außen die Bewohner.“) schreibt das Profil und sendet `agent.appearance_changed` (ohne Agenten). Die Zeit steht dabei still wie beim Gestalten.
2. **Neue Teile nach Abnahme** (Schritt 0, Bild 2): je Teil eine Zeichenfunktion in `art/people.ts` oder, wenn die Datei zu groß wird, in `art/people-teile.ts`. Die `Literal`-Listen in `Appearance` wachsen mit. Für jedes neue Teil kommen Einträge in `figuren-basis.json` dazu; die alten bleiben unverändert.
3. **Bildnis:** `portrait` nimmt Hüte und Frisuren mit (Ausschnitt ggf. höher, im Mockup festgelegt).
4. **Prüfen:** pytest für den Endpunkt (Gott erlaubt, Leben 403, Ereignis ohne Agenten, keine Erinnerung entsteht: nach dem Ereignis ist `memories` für alle Bewohner unverändert), Playwright: Gott › Aussehen ändern → Figur in der Welt ändert sich ohne Neuladen.

## Abnahme
Jemand gestaltet im Editor eine neue Figur, startet damit eine Simulation und sieht sie in Welt, Bewohnerleiste und Bewohner-Karte. Alex und Mira sind unverändert. Bericht `docs/status/AP19.md` mit Bildern.

## Fallen
- **Zwischenspeicher:** Ohne Stempel im `memo`-Schlüssel bleibt die alte Figur stehen. Bei Spielstandwechsel (`simulation.reset`) das Register leeren.
- **Akzentfarbe** wird an vielen Stellen benutzt (`accentOf`). Sie muss aus dem Register kommen, sonst haben Schild und Figur verschiedene Farben.
- **Besitzerfarbe** (`ownerColor` in `art/things.ts`) sucht heute `alex`/`mira` im Text. Nicht anfassen, außer sie bricht (eigener Fehler, eigener Commit).
- **Mira hat Beine in Hautfarbe** (wegen Kleid). Bei anderen Hauttönen müssen die Beine beim Kleid mitwechseln: Der Editor setzt `legs = skin`, wenn `top_style = kleid` und `legs` vorher der alten Hautfarbe entsprach.

## Nicht in diesem Paket
Eigene Pixel-Teile zeichnen (das ist AP23e), Aussehen im Prompt, Kleidung wechseln als Handlung der Bewohner.

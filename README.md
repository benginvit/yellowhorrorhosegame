# Yellow Horror Hose 🏠👻

Ett webbaserat 3D horror-överlevnadsspel byggt med React och Three.js, inspirerat av Roblox-estetik.

## 🎮 Spelbeskrivning

Navigera genom 6 successivt svårare nivåer i ett gult tegelhus med orange tak. Hitta nyckeln i varje nivå och nå dörren innan karaktären hinner fånga dig!

## 📊 Nivåer

1. **Level 1: Molltas** - Vit katt (Hastighet: 1.5)
2. **Level 2: Astrid** - 13 år (Hastighet: 1.8)
3. **Level 3: Selma** - 11 år (Hastighet: 2.0)
4. **Level 4: Kerstin** - 13 år (Hastighet: 2.3)
5. **Level 5: Mamma** - 46 år (Hastighet: 2.6)
6. **Level 6: Pappa** - 48 år (Hastighet: 3.0)

## 🎯 Spelets Mål

- Hitta den gyllene nyckeln i varje nivå
- Undvik karaktären som jagar dig
- Nå dörren när du har nyckeln för att gå vidare till nästa nivå
- Klara alla 6 nivåer för att vinna!

## 🕹️ Kontroller

- **WASD** - Förflytta dig
- **Mus** - Titta runt (klicka för att låsa muspekaren)
- **E** - Interagera (plocka upp nyckel)
- **ESC** - Lås upp muspekaren

## 🚀 Komma Igång

### Installation

```bash
npm install
```

### Köra Spelet

```bash
npm run dev
```

Öppna sedan din webbläsare och gå till `http://localhost:5173/`

### Bygga för Produktion

```bash
npm run build
```

## 🚦 Testmiljö och releaseflöde

1. Feature-PR mergas till `staging` (push deployar automatiskt via `.github/workflows/deploy-staging.yml`).
2. Testa på https://staging-yellowhorrorhouse.benom.nu (bygget är `noindex`).
3. Benjamin godkänner och öppnar PR `staging` → `main`.
4. Push till `main` deployar till prod (https://yellowhorrorhouse.benom.nu) via `deploy.yml`.

Staging-bygget använder image-taggen `:staging` (och `:staging-<sha>`), bara `linux/amd64`, och körs på servern via `staging/docker-compose.yml` (kopieras till `~/yellowhorrorhosegame-staging/`) på `127.0.0.1:3004`. Cloudflare-tunneln pekar `staging-yellowhorrorhouse.benom.nu` dit. Tunneln är user-tjänsten `cloudflare-mcp` (`~/.cloudflared/config.yml`) och startas om med `systemctl --user restart cloudflare-mcp`. Det är inte systemtjänsten `cloudflared` / `/etc/cloudflared`. Förslag: lägg Cloudflare Access framför staging.

Kontrollera att testläge-markören inte läckt in i prod-bygget (exit 1 om den finns):

```bash
bash scripts/check-prod-bundle.sh
```

### Testimage (lokalt)

Test-imagen byggs med build-arg `VITE_TEST_MODE=1` (default är `0` = prod). Den taggas `yellowhorrorhose:test`, pushas **inte** till ghcr och körs lokalt på port 3003, skilt från prod på 3002:

```bash
docker build --build-arg VITE_TEST_MODE=1 -t yellowhorrorhose:test .
docker run -d -p 127.0.0.1:3003:80 yellowhorrorhose:test
```

Prod-imagen bygger du som vanligt med `docker build -t yellowhorrorhose .`.

### End-to-end-tester (Playwright)

Playwright-sviten i `tests/e2e` kör headless Chromium med SwiftShader (mjukvaru-WebGL), viewport 1280x720, dpr 1, endast desktop.

```bash
npx playwright install chromium   # en gång
npm run test:e2e                  # bygger test- och prod-variant, startar vite preview, kör allt
```

`npm run test:e2e` bygger lokalt motsvarigheten till de två imagerna (`dist-e2e/prod` och `dist-e2e/test` med `VITE_TEST_MODE=1`) och kör `scripts/check-prod-bundle.sh` mot prod-bygget. För att köra mot redan körande servrar (t.ex. docker-containrar eller live-prod) sätt `E2E_TEST_URL=http://127.0.0.1:3003` och/eller `E2E_PROD_URL=https://…`.

| Spec | Projekt | Vad |
|------|---------|-----|
| `smoke.spec.js` | test + prod | Canvas renderar (inte blank), inga konsolfel/page errors; klassrum (test) |
| `visual.spec.js` | test | Screenshot-diff med `?seed=1&freeze=1` från 5 fasta kamerapositioner (`views.js`: 3 hus, 2 klassrum) + determinismtest (två laddningar av house-front resp. classroom-start ger samma bild; klassrummet kan avvika några dussin pixlar, gräns 0,1 %) |
| `perf.spec.js` | test | p95 frametid (rAF) och `renderer.info` (calls/triangles) via `window.__YHH_TEST_MODE__.gl`, loggas per körning |
| `prod-check.spec.js` | prod | `?seed=1&freeze=1&level=3` mot prod: `window.__YHH_TEST_MODE__` är `undefined`, parametrarna är verkningslösa |
| `lighting.spec.js` | test | Ljuskontroller (se nedan): ljusstyrka per kamerapose, läsbarhet kring nyckel/dörr, max 2 skuggkastare, inget flimmer när scenen är frusen |

- **Baslinjer** för screenshots (`tests/e2e/__baselines__/`) och frametid (`tests/e2e/perf-baseline.json`) genereras i den miljö som kör testerna och checkas **inte** in (SwiftShader ger olika pixlar/tider per maskin). Första körningen skriver baslinjerna och passerar (lokalt, med varning); kör `npm run test:e2e` igen för att faktiskt jämföra. **Med `CI` satt är det fail-closed:** saknad screenshot-baslinje (`updateSnapshots: 'none'`) och saknad frametidsbaslinje får testerna att *fela* i stället för att tyst skriva en ny – en färsk CI-miljö kan alltså inte passera utan jämförelse (frametidsbaslinje kan ändå skrivas med `E2E_SET_BASELINE=1`). Ny baslinje efter medvetna visuella ändringar: `npm run test:e2e:update` (screenshots) resp. `E2E_SET_BASELINE=1 npm run test:e2e` (frametid). När en baslinje skrivs lokalt skrivs en varning i konsolen och en annotation (`baseline-written`) läggs i rapporten.
- **Diffens känslighet (viktigt):** screenshot-diffen (`threshold: 0.2`, `maxDiffPixelRatio: 0.01`) fångar grova regressioner (saknade objekt, trasig rendering, fel kamera) men **inte subtila ljus- eller färgändringar**. Vid granskning ändrade ambient-ljus 0,25 → 0,3 51–67 % av husets pixlar och passerade ändå. Lita alltså inte på diffen som skydd för ljus-/färgarbete; granska sådana ändringar visuellt.
- **Sätt om baslinjerna** (`npm run test:e2e:update` + `E2E_SET_BASELINE=1 npm run test:e2e`) efter PostFX (#3) landat och efter allt ljus- och färgarbete, annars jämförs ny rendering mot en föråldrad baslinje.
- **Portar och servrar:** `reuseExistingServer` är av. Om en gammal `vite preview` ligger kvar på :4173/:4174 (t.ex. från en annan worktree) avbryter Playwright med "… is already used" i stället för att tyst testa fel bygge. Hitta och döda den: `ss -ltnp | grep -E ':417[34]'`.
- **Frametidsbudget:** p95 < 16,7 ms rapporteras alltid. Utan baslinje kan testet inte fela lokalt (men felar med `CI` satt); med baslinje felar det vid regression (p95 > max(1,5x, +40 ms) av baslinjen, calls/triangles > 1,1x). Den absoluta 16,7 ms-gränsen kräver riktig GPU och slås på med `E2E_ENFORCE_BUDGET=1` – på SwiftShader ligger p95 runt 70–130 ms.
- **Typsnitt:** drei `<Text>` hämtar glyfdata från cdn.jsdelivr.net vid körning. Svaren är incheckade i `tests/e2e/fixtures/jsdelivr-fonts.har.zip` och spelas upp så att testerna är offline-säkra. Spela in på nytt: `E2E_RECORD_FONTS=1 npx playwright test -c tests/e2e/playwright.config.js --project=test -g "classroom \(level 3\)"`.
- **Klassrumsintrot** har timers (skott efter 7 s) som inte kan frysas utifrån; visual-testerna avbryts om en capture tar > 6 s.
- Testläget har utöver `?seed`/`?freeze` stöd för `?level=1-6` (och `&inside=1` för Astrids hus) samt `window.__YHH_TEST_MODE__.camera/scene`; allt ligger bakom `VITE_TEST_MODE=1` och finns inte i prod-bygget.
- Rapport: `playwright-report/` (öppna med `npx playwright show-report playwright-report`).
- CI-integration av e2e ingår inte (separat uppgift).

#### Ljuskontroller (`lighting.spec.js`)

Screenshot-diffen fångar inte subtila ljusändringar, så ljuset mäts direkt på bilden (canvas-screenshot utan HTML-överlägg, luma = Rec. 709, 0–255). Posar och gränser står i `tests/e2e/views.js` (`LIGHT_VIEWS`, `LIGHT_LIMITS`); gränserna är satta med marginal runt uppmätta värden på nuvarande ljus (`feat/lighting`) och är deterministiska (frusen scen, SwiftShader).

| Kontroll | Pose(r) | Gräns | Uppmätt nu |
|----------|---------|-------|------------|
| Ljusstyrka, hela bilden | outdoor-front/-door/-key, classroom-start, house-interior | medel 40–110, median ≥ 30, p95 60–220, svart (luma < 8) ≤ 10 %, vitt (luma > 247) ≤ 2 % | medel 57–67, median 59–75, p95 80–158, svart 0–4,6 %, vitt ≤ 0,16 % |
| Läsbarhet nyckel | outdoor-key, ±70 px runt nyckeln (`[8, 1, -10]`) | kontrast (p95 − p5) ≥ 50, p95 ≥ 65 | 59 / 73 |
| Läsbarhet dörr | outdoor-key, ±100 px runt dörren (`[0, 2, -17.4]`) | kontrast ≥ 48, p95 ≥ 52 | 53 / 58 |
| Skuggkastare | outdoor, classroom, house interior | högst 2 ljus med `castShadow` i `scene` | 2 / 1 / 1 |
| Flimmer | outdoor-door (bild + ljus), house-interior (ljus) | ljusens typ/intensitet/färg/position och (utom interiören) hela bilden identiska efter 3 nya frames utan tidssteg | identiska |

- Poserna renderas först när scenen har innehåll (≥ 20 draw calls): innehållet ligger i `<Suspense>`, och direkt efter `ready` kan en bild bestå av bara himmel och ljus (1 draw call).
- Bildjämförelsen för flimmer kräver att inget animeras per frame i bild: nyckeln roterar +0,02 rad **per frame** (`Key.jsx`) och husinteriörens snarkbubblor styrs av väggklocke-timers (`Character.jsx`), så nyckeln hålls utanför bild och interiören jämförs bara på ljustillstånd.
- Verifierat negativt: ambient = 0 gör `classroom-start`, `house-interior` och dörr-läsbarheten röda; ett tredje skuggkastande ljus gör skuggräkningen röd. Utomhusbilden domineras av himlen, så ambient = 0 syns där bara i dörrregionen.
- Dörren är mörk (42 % av regionen svart, p95 58) trots att kontrasten klarar gränsen; stramas gränsen åt för mer läsbar dörr, höj `door.p95Min`.
- Efter medvetet ljusarbete: kör `npm run test:e2e -- --project=test lighting.spec.js`, läs raderna `[lighting] …` och justera `LIGHT_LIMITS` i samma PR.

## 🛠️ Teknologier

- **React** - UI-ramverk
- **Vite** - Build-verktyg
- **Three.js** - 3D-grafik
- **React Three Fiber** - React renderer för Three.js
- **@react-three/drei** - Hjälpbibliotek för R3F

## 🏗️ Projektstruktur

```
yellowhorrorhosegame/
├── src/
│   ├── components/
│   │   ├── Game.jsx          # Huvudsaklig spelkomponent
│   │   ├── UI.jsx             # UI-overlay (menyer, HUD)
│   │   ├── House.jsx          # Gult tegelhus med orange tak
│   │   ├── Character.jsx      # Jagande karaktärer
│   │   ├── Key.jsx            # Insamlingsbar nyckel
│   │   ├── Ground.jsx         # Markplan
│   │   └── Player.jsx         # Spelarens kontroller
│   ├── App.jsx                # Huvudapp med spellogik
│   ├── main.jsx               # React entry point
│   └── index.css              # Styles
├── index.html
├── package.json
└── vite.config.js
```

## 🎨 Design-Funktioner

- **Roblox-stil blockmässig grafik**
- **Dynamisk belysning och skuggor**
- **Första-person kamera-kontroller**
- **Smooth rörelse och animationer**
- **Progressivt svårighetsgrad**
- **Responsive UI med HUD**

## 🎭 Gameplay-Mekanik

1. **Nyckel-insamling**: Nyckeln svävar och roterar, automatiskt insamlad när du kommer nära
2. **Dörr-interaktion**: Närma dig dörren med nyckeln för att gå vidare
3. **Fiendeförföljelse**: Karaktärer följer alltid spelaren och blir snabbare för varje nivå
4. **Hälsosystem**: Tar skada när du är nära karaktären, Game Over vid 0 hälsa
5. **Level-progression**: 6 nivåer med ökande svårighetsgrad

## 🐛 Kända Problem

- Inga för närvarande!

## 🔮 Framtida Förbättringar

Potentiella förbättringar att lägga till:

- [ ] Ljudeffekter och bakgrundsmusik
- [ ] Power-ups (hastighetsökning, osynlighet)
- [ ] Fler karaktärer och nivåer
- [ ] Multiplayer-läge
- [ ] Mobile-stöd med touch-kontroller
- [ ] Flera hus med olika utformningar
- [ ] Achievement-system
- [ ] Highscore-tabell

## 📝 Licens

Privat projekt - Ingen licens

## 🎮 Tips för Spelare

1. **Håll dig i rörelse** - Stanna aldrig stilla
2. **Planera din rutt** - Memorera var nyckeln och dörren är
3. **Använd husets hörn** - Gå runt huset för att undvika karaktären
4. **Titta dig omkring** - Håll koll på var karaktären är
5. **Agera snabbt** - Ju högre nivå, desto snabbare måste du vara!

---

**Lycka till och överlevnad! 🎮👻**

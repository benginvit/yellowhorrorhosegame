# ADR 0001: e2e i CI och baslinjestrategi

## Kontext
e2e-sviten (`npm run test:e2e`) körs i `pr-check.yml`-jobbet `e2e` för PR:er mot `main` och `staging`. Baslinjerna (`tests/e2e/__baselines__/`, `perf-baseline.json`) är per miljö (SwiftShader-output skiljer sig mellan maskiner) och committas inte. Med `CI` satt fallerar en saknad baslinje.

## Beslut: (b) baslinjer genereras från PR:ens basbranch
Jobbet checkar ut basbranchens commit och PR:ens merge-commit (head sammanslagen med basen; det är vad `actions/checkout` hämtar), kör `visual.spec.js` på basen (`lighting-baseline.spec.js` ingår i anropet men **hoppar över sig själv** utan `E2E_BASELINE_URL`, så den körs aldrig i CI; den är opt-in även lokalt) i samma pinnade container (`CI` avsatt med `env -u CI`, eftersom GitHub sätter `CI=true`, så baslinjer skrivs), kopierar baslinjerna till head och kör hela sviten där med `CI=true` (saknad baslinje = fel).

- Inga committade binärer, ingen separat baslinjejobb, följer basbranchen automatiskt.
- Kostnad: extra bygge + en kort körning på basen (ca 1,5 min lokalt).
- Alternativet (a), committade baslinjer, kräver binärer i git och en manuell regenereringsrutin vid varje avsiktlig visuell ändring.

## Perf: opt-in
`perf.spec.js` jämför p95 mot baslinje med tolerans, men på mjukvarurenderade delade runners varierar frametiderna kraftigt (lokalt p95 66-83 ms, max 916 ms mellan körningar). Det är för flakigt som obligatorisk grind, så perf är **av som standard**: hela `perf.spec.js` utelämnas (inte bara p95-kontrollen), alltså körs inte heller de deterministiska kontrollerna av draw calls/trianglar som standard. Lägg etiketten `e2e-perf` på PR:en för att ta med perf; då spelas även en perf-baslinje in från basen och calls/trianglar kontrolleras tillsammans med p95. Att dela upp specen så att calls/trianglar alltid körs är en möjlig uppföljning.

**När ska `e2e-perf` användas:** på PR:er som ändrar renderingskostnaden, främst partikelarbete (BENG-27, BENG-28, BENG-29), nya ljuskällor/skuggor/postprocessing och stora ändringar av scenens geometri. Inte på ren logik, UI eller dokumentation. Etiketten startar en ny körning (workflowet lyssnar på `labeled`). p95 är brusig på mjukvaru-GL: läs siffrorna som en trend och kör om en gång innan du drar slutsatser.

## Pinning och bump av Playwright
Containern `mcr.microsoft.com/playwright:v1.64.1` ska ha exakt samma version som `@playwright/test` i `package-lock.json`. Steget "Check image matches package.json" fallerar om de glider isär. Bump: uppdatera `@playwright/test` (och lockfilen), sätt image-taggen och `PLAYWRIGHT_IMAGE_VERSION` i `pr-check.yml` till samma version. **Bump-PR:en förväntas bli röd i `e2e (visual)`:** bassteget gör `npm ci` på basens lockfil (gamla `@playwright/test`) men körs i den *nya* imagen. Om chromium-revisionen skiljer sig hittar den gamla versionen ingen webbläsare (`Executable doesn't exist`), och glidningskontrollen fångar det inte eftersom den bara läser head. Hantering: merga bump-PR:en med admin-åsidosättning efter att alla andra shards är gröna (eller lägg `npx playwright install chromium` i bassteget om det blir ett återkommande problem). Därefter jämför alla senare PR:er mot en bas som redan har den nya versionen.

## Shards (körtid)
Hela sviten på en 4-vCPU-runner tar ca 11 min seriellt (workers=1 är avsiktligt; determinism-testerna renderar hundratals mjukvaru-GL-frames och tar ~8 min ensamma), över 10-minutersgränsen. Jobbet är därför uppdelat i parallella shards (`visual`, `prod`, `determinism-*`) som alla kör samma `npm run test:e2e` med fil-/`-g`-filter. Bara `visual`-shardet behöver baslinjer från basbranchen. Jobbet `e2e` aggregerar resultatet av alla shards.

## Retries och flakes
`visual` och `prod` körs med `--retries=1`: på delade runners händer det att en skärmdump överskrider Playwrights 5 s-timeout (fontladdning) trots oförändrad rendering. En verklig visuell regression faller i båda försöken.

`determinism-*`-shardsen körs med **`--retries=0`**. De testerna finns för att fånga icke-determinism, och ett test som faller en gång och går igenom andra gången är just den signalen; med retries skulle det bli `flaky` med exit 0. Timeoutproblem hanteras i stället med `--timeout=240000`. Matrisen har ett `retries`-fält per shard så att detta syns.

## Shard-vakt
Shard-filtren är handskrivna, så ett nytt test kan tappas tyst. Jobbet `e2e-shard-guard` kör `scripts/check-e2e-shards.mjs` (bara `npm ci`, ingen webbläsare): det listar alla tester med `playwright test --list`, listar unionen av matrisens `args`, och failar om något test (utom opt-in `perf.spec.js`) inte körs av något shard, eller om en `tests/e2e/*.spec.js` inte matchas av något Playwright-projekt (`testMatch`). Aggregatjobbet `e2e` kräver att vakten är grön. Ny spec-fil: lägg den i ett projekts `testMatch` och i ett shards `args`.

Vakten visar att ett test är *valt* av något shard, inte att det *körs*: tester som hoppar över sig själva (`lighting-baseline.spec.js`, `E2E_KEY_THROTTLE`-testet) räknas som täckta. Test-id:t byggs av projekt, fil, hela describe-sökvägen och titel (`-g` matchar också describe-titlar). `forbidOnly: !!process.env.CI` i `playwright.config.js` gör att en incheckad `test.only` ger rött både i `--list` (vakten) och i körningen, så att ett shard inte tyst krymper.

Determinism-liknande tester i visual-shardet (`frozen render is deterministic…` i `visual.spec.js`, `no flicker when frozen` i `lighting.spec.js`) har `test.describe.configure({ retries: 0 })`, vilket går före CLI:ns `--retries=1`.

## Avsiktliga visuella ändringar: etiketten `visual-change-approved`
Med (b) blir varje PR med en avsiktlig visuell ändring röd i `e2e (visual)`, och särskilt release-PR:er `staging` → `main`, där baslinjerna tas från `main`. Rött som rutin gör att folk slutar lita på det, så det finns en uttrycklig mekanism:

1. Granska diffen (artefakten `e2e-report-visual` från en körning utan etiketten, eller lokalt).
2. Lägg etiketten `visual-change-approved` på PR:en. Det startar en ny körning.
3. Med etiketten spelas **screenshot-baslinjerna** in från **PR:ens merge-commit** i stället för basen, så screenshot-diffen är inte längre en grind. **Perf-baslinjen (`e2e-perf`) spelas alltid in från basen**, även med etiketten, så att perf förblir en grind mot basen (annars jämförs head med sig själv och kan aldrig falla). Allt annat körs som vanligt: smoke, ljuskontroller, alla determinism-shards, prod-check och shard-vakten. Körningen skriver en notice i loggen att etiketten är aktiv.
4. **Vem sätter etiketten:** en människa eller reviewern, **aldrig PR:ens författare**. Det gäller också agenter. Etiketten är den enda grinden för visuella ändringar, så författaren får inte godkänna sitt eget arbete.
5. **Etiketten måste bedömas på nytt efter nya commits.** Den är inte bunden till en commit: pushar man nya visuella ändringar efter godkännandet är de också godkända. En push på en PR som redan har etiketten ger därför `::warning::` i körningen. Ta bort etiketten om ändringarna inte ska godkännas på samma sätt. Bara den som får sätta etiketter (triage/write) kan godkänna.
6. Ändrar PR:en själva workflowen, `playwright.config.js` eller `visual.spec.js` följer det med `pull_request`; granska sådana ändringar särskilt.

Etiketten gäller även PR:er som lägger till eller döper om en vy i `visual.spec.js` (basen saknar då baslinjen).

# ADR 0001: e2e i CI och baslinjestrategi

## Kontext
e2e-sviten (`npm run test:e2e`) körs i `pr-check.yml`-jobbet `e2e` för PR:er mot `main` och `staging`. Baslinjerna (`tests/e2e/__baselines__/`, `perf-baseline.json`) är per miljö (SwiftShader-output skiljer sig mellan maskiner) och committas inte. Med `CI` satt fallerar en saknad baslinje.

## Beslut: (b) baslinjer genereras från PR:ens basbranch
Jobbet checkar ut basbranchens commit och PR:ens head, kör `visual` och `lighting-baseline` på basen i samma pinnade container (`CI` avsatt med `env -u CI`, eftersom GitHub sätter `CI=true`, så baslinjer skrivs), kopierar baslinjerna till head och kör hela sviten där med `CI=true` (saknad baslinje = fel).

- Inga committade binärer, ingen separat baslinjejobb, följer basbranchen automatiskt.
- Kostnad: extra bygge + en kort körning på basen (ca 1,5 min lokalt).
- Alternativet (a), committade baslinjer, kräver binärer i git och en manuell regenereringsrutin vid varje avsiktlig visuell ändring.

## Perf: opt-in
`perf.spec.js` jämför p95 mot baslinje med tolerans, men på mjukvarurenderade delade runners varierar frametiderna kraftigt (lokalt p95 66-83 ms, max 916 ms mellan körningar). Det är för flakigt som obligatorisk grind, så perf är **av som standard** (`--grep-invert "frame time"`). Lägg etiketten `e2e-perf` på PR:en för att ta med perf; då spelas även en perf-baslinje in från basen. Draw calls/trianglar (deterministiska) kontrolleras då också.

## Pinning och bump av Playwright
Containern `mcr.microsoft.com/playwright:v1.64.1` ska ha exakt samma version som `@playwright/test` i `package-lock.json`. Steget "Check image matches package.json" fallerar om de glider isär. Bump: uppdatera `@playwright/test` (och lockfilen), sätt image-taggen och `PLAYWRIGHT_IMAGE_VERSION` i `pr-check.yml` till samma version. Baslinjerna genereras om automatiskt eftersom de spelas in på basen i samma image; första PR:en efter en bump jämför dock bara mot en bas som kör samma nya image, så ingen särskild åtgärd krävs.

## Shards (körtid)
Hela sviten på en 4-vCPU-runner tar ca 11 min seriellt (workers=1 är avsiktligt; determinism-testerna renderar hundratals mjukvaru-GL-frames och tar ~8 min ensamma), över 10-minutersgränsen. Jobbet är därför uppdelat i parallella shards (`visual`, `prod`, `determinism-*`) som alla kör samma `npm run test:e2e` med fil-/`-g`-filter. Bara `visual`-shardet behöver baslinjer från basbranchen. Jobbet `e2e` aggregerar resultatet av alla shards.

Alla shards körs med `--retries=1`: på delade runners händer det att en skärmdump överskrider Playwrights 5 s-timeout (fontladdning) trots oförändrad rendering. En verklig visuell regression faller i båda försöken.

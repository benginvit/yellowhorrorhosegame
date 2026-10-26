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

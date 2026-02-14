# Guide för Röstinspelningar / Voice Recording Guide

## 🎤 Vad har ändrats / What has changed

### Nya funktioner:
1. ✅ **Språkval i början** - Välj Svenska eller English när spelet startar
2. ✅ **Stöd för egna röstinspelningar** - Spelet försöker ladda dina röster först, sedan fallback till AI-ljud
3. ✅ **Alla texter översatta** - Hela spelet finns på både svenska och engelska

---

## 📁 Var ska filerna ligga / File Structure

```
public/
  sounds/
    sv/              ← Svenska röster här
      molltas-meow.m4a
      astrid-snoring.m4a   ← NYTT! Snarkljud
      astrid-wake.m4a
      astrid-catch.m4a
      astrid-failed.m4a
      astrid-success.m4a
      selma-catch.m4a
      kerstin-catch.m4a
      maria-catch.m4a
      pappa-catch.m4a
    en/              ← Engelska röster här
      molltas-meow.m4a
      astrid-snoring.m4a   ← NEW! Snoring sound
      astrid-wake.m4a
      astrid-catch.m4a
      astrid-failed.m4a
      astrid-success.m4a
      selma-catch.m4a
      kerstin-catch.m4a
      maria-catch.m4a
      pappa-catch.m4a
```

---

## 🎙️ Hur du spelar in / How to Record

### Alternativ 1: Med din telefon
1. Öppna **Röstmemo** (iPhone) eller **Ljudinspelare** (Android)
2. Spela in rösten
3. Dela filen till datorn (AirDrop, email, etc.)
4. Konvertera till MP3 om nödvändigt (kan göras online på https://convertio.co/)

### Alternativ 2: Med datorn
1. **Windows**: Använd "Voice Recorder" appen
2. **Mac**: Använd "Voice Memos" eller QuickTime
3. **Online**: Gå till https://online-voice-recorder.com/

### Alternativ 3: Audacity (Bäst för redigering)
1. Ladda ner gratis från https://www.audacityteam.org/
2. Tryck på röd knapp för att spela in
3. Exportera som MP3

---

## 🎬 Vad ska du spela in / What to Record

### Svenska versionen (sv folder):

#### **molltas-meow.m4a**
- Din katts jamande
- Flera versioner fungerar! Spelet väljer slumpmässigt
- Tips: Spela in när katten är hungrig 😺

#### **astrid-snoring.m4a** ⭐ NYTT!
- Astrid snarkar när hon sover
- Spela in ett snarkljud (kan vara riktigt eller låtsas)
- Exempel: "Zzzzzz..." eller ett naturligt snarkande
- Ljudet kommer loopa så gör det lagom långt (3-5 sekunder)
- Tips: Gör det lite gulligt och lugnande först, sen kommer det läskiga!

#### **astrid-wake.m4a**
- Astrid säger när hon vaknar
- Exempel: "Vad gör du i mitt hus?!"
- Eller: "HEJ! Vem är du?!"
- Gör det läskigt: Viska ilsket eller skrik plötsligt!

#### **astrid-catch.m4a**
- När Astrid fångar spelaren
- Exempel: "JAG FÅR TAG I DIG!"
- Eller: "NU ÄR DU MIN!"

#### **astrid-failed.m4a** ⭐ NYTT!
- När timern tar slut och du INTE gömde dig i tid
- Exempel: "Nu ska du få!"
- Eller: "Där är du ju!"
- Arg, hotfull röst!

#### **astrid-success.m4a** ⭐ NYTT!
- När du LYCKADES gömma dig i tid
- Exempel: "Va, vart tog den vägen?"
- Eller: "Var är den? Jag såg den ju nyss..."
- Förvirrad, undrande röst

#### **selma-catch.m4a**
- Exempel: "Jag hittade dig!"

#### **kerstin-catch.m4a**
- Exempel: "Kom hit!"

#### **maria-catch.m4a**
- Exempel: "Försök inte fly!"

#### **pappa-catch.m4a**
- Djup, läskig röst
- Exempel: "Nu är det slut..."

### Engelska versionen (en folder):
Samma filer men på engelska!
- astrid-snoring.m4a: "Zzzzzz..." (snoring sound - same recording can be used for both languages!)
- astrid-wake.m4a: "What are you doing in my house?!"
- astrid-catch.m4a: "I GOT YOU!"
- astrid-failed.m4a: "Now I got you!" eller "There you are!"
- astrid-success.m4a: "What, where did they go?" eller "I just saw them..."
- etc.

---

## 💡 Tips för läskigare inspelningar:

### För barn (Astrid, Selma, Kerstin):
- Låt dem prata med "arg" röst
- Be dem viska men på ett läskigt sätt
- Låt dem skrika lite (men inte för mycket!)
- Prova olika tagningar och välj den bästa

### För vuxna (Maria, Pappa):
- Sänk rösten
- Prata långsammare
- Lägg till eko-effekt i Audacity om du vill
- Pappa ska vara EXTRA läskig (djup, mörk röst)

### För katten (Molltas):
- Spela in när katten jamar naturligt
- Flera olika jam är bra!
- Klipp bort tystnad i början och slutet

---

## 🔧 Tekniska krav:

- **Format**: MP3 eller OGG (MP3 rekommenderas)
- **Storlek**: Under 1 MB per fil (helst under 500 KB)
- **Kvalitet**: 128 kbps är tillräckligt
- **Längd**: 1-3 sekunder för catch-ljud, 0.5-1 sekund för jam

---

## 📝 Hur du lägger till filerna:

### Om du använder VS Code / Codespaces:
1. Öppna mappen `public/sounds/sv/` eller `public/sounds/en/`
2. Dra och släpp dina MP3-filer här
3. Se till att namnen är exakt som ovan (små bokstäver, inga mellanslag)

### Från din dator:
1. Hitta projektet på din dator
2. Gå till `public/sounds/sv/`
3. Kopiera in dina MP3-filer
4. Upprepa för `public/sounds/en/` med engelska versioner

---

## ✅ Testa dina röster:

1. Starta spelet
2. Välj språk (Svenska eller English)
3. När du spelar:
   - **Level 1**: Du ska höra din katts jam
   - **Level 2**: När Astrid vaknar ska du höra hennes röst
   - **Alla nivåer**: När karaktär fångar dig, hör deras röst

### Om rösten inte spelar:
- Kolla att filnamnet är rätt stavat (små bokstäver!)
- Kolla att filen är i rätt mapp (sv/ eller en/)
- Öppna webbläsarens konsol (F12) för att se felmeddelanden
- Spelet använder automatiskt AI-ljud om filen inte hittas

---

## 🌟 Exempel-script för inspelning:

### Astrid (13 år) - Svenska:
1. **wake**: "Vad gör du här?! Det här är MITT rum!"
2. **catch**: "Jag får tag i dig! MUAHAHAHA!"

### Astrid (13 years) - English:
1. **wake**: "What are you doing here?! This is MY room!"
2. **catch**: "I got you! MUAHAHAHA!"

### Pappa - Svenska:
1. **catch**: "Nu är det slut för dig..." (djup, läskig röst)

### Pappa - English:
1. **catch**: "It's over for you now..." (deep, scary voice)

---

## ❓ Vanliga frågor / FAQ:

**Q: Måste jag spela in ALLA röster?**
A: Nej! Spelet fungerar utan. Om en röst saknas använder det AI-ljud istället.

**Q: Kan jag använda samma röst för både svenska och engelska?**
A: Ja! Bara kopiera filen till båda mapparna.

**Q: Kan jag ändra en röst senare?**
A: Ja! Byt bara ut MP3-filen med samma namn.

**Q: Varför hörs inte min röst?**
A: Kolla filnamnet! Det måste vara exakt rätt (t.ex. "astrid-wake.m4a" inte "Astrid Wake.m4a")

**Q: Kan jag lägga till fler ljud?**
A: Ja! Fråga mig så hjälper jag dig lägga till fler ljud.

---

## 🚀 Redo att börja!

1. Spela in dina röster
2. Lägg filerna i `public/sounds/sv/` och `public/sounds/en/`
3. Starta spelet och välj språk
4. Ha kul och bli skrämd! 😱

Lycka till med inspelningarna! 🎤👻

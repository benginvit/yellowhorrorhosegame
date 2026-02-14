# Dev Container Setup

Detta projekt använder en Dev Container för att säkerställa en konsistent utvecklingsmiljö.

## Vad ingår?

### Verktyg
- ✅ **Node.js 18** - För Vite/React development
- ✅ **Azure CLI** - För att hantera Azure-resurser
- ✅ **kubectl** - För att interagera med Kubernetes
- ✅ **Docker-in-Docker** - För att bygga Docker images
- ✅ **Git** - Versionskontroll

### VS Code Extensions
- ESLint
- Prettier
- Docker
- Kubernetes
- Azure Account
- GitHub Copilot (om du har det)

### Portar
- 5173 (Vite dev server)
- 80 (Nginx)
- 3000 (Extra för utveckling)

## Användning

### Första gången (i GitHub Codespaces eller VS Code)

1. **GitHub Codespaces:**
   - Öppna repot på GitHub
   - Klicka "Code" → "Codespaces" → "Create codespace on main"
   - Dev containern startar automatiskt!

2. **VS Code lokalt:**
   - Öppna projektet i VS Code
   - Du får en prompt: "Reopen in Container"
   - Klicka "Reopen in Container"

   Eller:
   - Öppna Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Sök efter: "Dev Containers: Reopen in Container"

### Verifiera installation

Öppna en terminal i containern och kör:

```bash
# Kolla Node.js
node --version

# Kolla npm
npm --version

# Kolla Azure CLI
az --version

# Kolla kubectl
kubectl version --client

# Kolla Docker
docker --version
```

### Logga in på Azure

```bash
# Device code login (fungerar i alla miljöer)
az login --use-device-code

# Lista dina subscriptions
az account list -o table

# Sätt default subscription om du har flera
az account set --subscription <SUBSCRIPTION_ID>
```

### Verifiera Azure-resurser

```bash
# Lista Container Registries
az acr list -o table

# Lista AKS clusters
az aks list -o table

# Lista Resource Groups
az group list -o table
```

## Starta utvecklingsserver

```bash
# Installera dependencies (görs automatiskt första gången)
npm install

# Starta Vite dev server
npm run dev
```

Servern startar på http://localhost:5173

## Bygg och testa Docker image lokalt

```bash
# Bygg image
docker build -t yellowhorrorhose:local .

# Kör lokalt
docker run -p 8080:80 yellowhorrorhose:local

# Öppna http://localhost:8080
```

## Kör setup script för GitHub Actions

```bash
./setup-github-actions.sh
```

## Tips

### Snabbare omstart
Om du behöver starta om containern:
- Command Palette → "Dev Containers: Rebuild Container"

### Installera extra verktyg
Lägg till i `.devcontainer/devcontainer.json` under `features`

### Debug i containern
Alla VS Code debug-funktioner fungerar som vanligt!

### Dela filer med host
Projektet mountas automatiskt i containern från din host-maskin.

## Felsökning

### "Cannot connect to Docker daemon"
- Kontrollera att Docker körs på din host-maskin
- I Windows: Starta Docker Desktop

### Azure CLI login fungerar inte
- Använd `az login --use-device-code`
- Detta fungerar i alla miljöer (även headless)

### Port redan används
- Ändra portarna i `devcontainer.json` under `forwardPorts`

### Containern startar inte
- Kolla Docker logs
- Försök: "Dev Containers: Rebuild Container Without Cache"

# GitHub Actions CI/CD Setup

## Konfigurera GitHub Secrets

För att GitHub Actions ska fungera behöver du lägga till följande secrets i ditt GitHub repository.

### Steg 1: Skapa Azure Service Principal

Kör detta i Azure CLI:

```bash
az ad sp create-for-rbac \
  --name "github-yellowhorrorhose" \
  --role contributor \
  --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID>/resourceGroups/<YOUR_RESOURCE_GROUP> \
  --sdk-auth
```

Detta ger dig en JSON output som du ska använda för `AZURE_CREDENTIALS` secreten.

### Steg 2: Hitta ditt Subscription ID

```bash
az account show --query id -o tsv
```

### Steg 3: Lägg till GitHub Secrets

Gå till ditt GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Lägg till följande secrets:

#### 1. `AZURE_CREDENTIALS`
```json
{
  "clientId": "<CLIENT_ID>",
  "clientSecret": "<CLIENT_SECRET>",
  "subscriptionId": "<SUBSCRIPTION_ID>",
  "tenantId": "<TENANT_ID>"
}
```
(Kopiera hela JSON outputen från Service Principal kommandot)

#### 2. `ACR_NAME`
```
ditt-acr-namn
```
(Endast namnet, utan .azurecr.io)

#### 3. `AZURE_RESOURCE_GROUP`
```
din-resource-group
```

#### 4. `AKS_CLUSTER`
```
ditt-aks-cluster-namn
```

## Ge Service Principal åtkomst till ACR

```bash
# Hämta ACR ID
ACR_ID=$(az acr show --name <YOUR_ACR_NAME> --query id -o tsv)

# Hämta Service Principal ID
SP_ID=$(az ad sp list --display-name "github-yellowhorrorhose" --query "[0].id" -o tsv)

# Ge AcrPush role
az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope $ACR_ID
```

## Ge AKS åtkomst till ACR (om inte redan gjort)

```bash
az aks update \
  -n <YOUR_AKS_CLUSTER> \
  -g <YOUR_RESOURCE_GROUP> \
  --attach-acr <YOUR_ACR_NAME>
```

## Hur det fungerar

När du pushar till `main` branch:

1. 🔐 Loggar in på Azure
2. 🐳 Bygger Docker image
3. 📤 Pushar till ACR med både commit SHA och 'latest' tag
4. ☸️ Deployar till AKS
5. ⏳ Väntar på att deployment ska bli klar
6. ✅ Visar deployment info och URL

## Manuell triggering

Du kan också köra workflow manuellt:
1. Gå till **Actions** tab i GitHub
2. Välj "Deploy to Azure AKS"
3. Klicka "Run workflow"

## Se deployment status

Efter varje push:
1. Gå till **Actions** tab
2. Klicka på den senaste workflow run
3. Se deployment progress och resultat

## Troubleshooting

### Workflow misslyckas på Azure Login
- Kontrollera att `AZURE_CREDENTIALS` är korrekt formaterad JSON
- Verifiera att Service Principal har rätt permissions

### Image kan inte pushas till ACR
- Kontrollera att Service Principal har `AcrPush` role
- Verifiera att `ACR_NAME` är korrekt

### Deployment misslyckas
- Kontrollera AKS credentials
- Se till att AKS kan pulle från ACR (`az aks update --attach-acr`)

### Loggar och felsökning

```bash
# Se pods
kubectl get pods -l app=yellowhorrorhose-game

# Se deployment status
kubectl describe deployment yellowhorrorhose-game

# Se logs
kubectl logs -l app=yellowhorrorhose-game --tail=100

# Se events
kubectl get events --sort-by='.lastTimestamp'
```

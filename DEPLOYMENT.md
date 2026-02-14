# Yellow Horror Hose Game - Azure Kubernetes Deployment

## Förutsättningar

- Azure CLI installerat (`az`)
- Docker installerat
- kubectl installerat
- Ett Azure Container Registry (ACR)
- Ett Azure Kubernetes Cluster (AKS)
- Tillgång till klustret

## Steg-för-steg deployment

### 1. Konfigurera deploy.sh

Öppna `deploy.sh` och uppdatera följande variabler:

```bash
ACR_NAME="<YOUR_ACR_NAME>"              # Ditt ACR namn (utan .azurecr.io)
RESOURCE_GROUP="<YOUR_RESOURCE_GROUP>"  # Din Azure Resource Group
AKS_CLUSTER="<YOUR_AKS_CLUSTER>"        # Ditt AKS cluster namn
```

### 2. Kör deployment script

```bash
./deploy.sh
```

Scriptet kommer att:
1. Logga in på Azure och ACR
2. Bygga Docker imagen
3. Pusha till ACR
4. Deployas till Kubernetes
5. Vänta tills deployment är klar

### 3. Få extern IP-adress

Efter deployment, hämta den externa IP-adressen:

```bash
kubectl get service yellowhorrorhose-game -w
```

Vänta tills EXTERNAL-IP inte längre är `<pending>`. Detta kan ta några minuter.

### 4. Testa spelet

När du har EXTERNAL-IP, öppna i webbläsaren:
```
http://<EXTERNAL-IP>
```

## Manual deployment (utan script)

### Steg 1: Bygg Docker image

```bash
docker build -t <YOUR_ACR>.azurecr.io/yellowhorrorhose:latest .
```

### Steg 2: Pusha till ACR

```bash
az acr login --name <YOUR_ACR>
docker push <YOUR_ACR>.azurecr.io/yellowhorrorhose:latest
```

### Steg 3: Uppdatera deployment.yaml

Redigera `k8s/deployment.yaml` och ersätt `<YOUR_ACR_NAME>` med ditt ACR namn.

### Steg 4: Deploy till Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Steg 5 (Valfritt): Konfigurera Ingress

Om du vill använda ett domännamn istället för IP:

1. Uppdatera `k8s/ingress.yaml` med ditt domännamn
2. Applicera ingress:
   ```bash
   kubectl apply -f k8s/ingress.yaml
   ```

## Användbara kommandon

### Se status på pods
```bash
kubectl get pods -l app=yellowhorrorhose-game
```

### Se loggar
```bash
kubectl logs -l app=yellowhorrorhose-game -f
```

### Skala antal replicas
```bash
kubectl scale deployment yellowhorrorhose-game --replicas=3
```

### Uppdatera till ny version
```bash
# Bygg och pusha ny image
docker build -t <YOUR_ACR>.azurecr.io/yellowhorrorhose:v2 .
docker push <YOUR_ACR>.azurecr.io/yellowhorrorhose:v2

# Uppdatera deployment
kubectl set image deployment/yellowhorrorhose-game yellowhorrorhose-game=<YOUR_ACR>.azurecr.io/yellowhorrorhose:v2
```

### Ta bort deployment
```bash
kubectl delete -f k8s/
```

## Felsökning

### Pod startar inte
```bash
kubectl describe pod -l app=yellowhorrorhose-game
kubectl logs -l app=yellowhorrorhose-game
```

### Image kan inte pullas
Kontrollera att AKS har rätt att läsa från ACR:
```bash
az aks update -n <AKS_CLUSTER> -g <RESOURCE_GROUP> --attach-acr <ACR_NAME>
```

### Service får ingen extern IP
Kontrollera att AKS har en LoadBalancer tillgänglig:
```bash
kubectl describe service yellowhorrorhose-game
```

## Säkerhet

För produktion, överväg:
- Aktivera HTTPS med cert-manager och Let's Encrypt
- Använd ingress med SSL/TLS
- Sätt upp Network Policies
- Konfigurera Resource Quotas
- Aktivera Pod Security Standards

## Kostnad

Tänk på:
- LoadBalancer kostar extra i Azure
- Varje pod tar CPU och minne
- ACR lagring kostar baserat på storlek

För utveckling/test kan du använda NodePort istället för LoadBalancer:
```yaml
spec:
  type: NodePort  # Istället för LoadBalancer
```

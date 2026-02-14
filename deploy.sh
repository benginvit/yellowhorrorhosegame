#!/bin/bash

# Yellow Horror Hose Game - Deployment Script for Azure Kubernetes

set -e

# Configuration - UPPDATERA DESSA!
ACR_NAME="<YOUR_ACR_NAME>"
RESOURCE_GROUP="<YOUR_RESOURCE_GROUP>"
AKS_CLUSTER="<YOUR_AKS_CLUSTER>"
IMAGE_NAME="yellowhorrorhose"
VERSION="latest"

echo "🎮 Deploying Yellow Horror Hose Game to Azure Kubernetes..."

# 1. Login to Azure (om inte redan inloggad)
echo "📝 Checking Azure login..."
az account show > /dev/null 2>&1 || az login

# 2. Login to ACR
echo "🔐 Logging in to Azure Container Registry..."
az acr login --name $ACR_NAME

# 3. Build Docker image
echo "🏗️  Building Docker image..."
docker build -t $ACR_NAME.azurecr.io/$IMAGE_NAME:$VERSION .

# 4. Push to ACR
echo "📤 Pushing image to ACR..."
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:$VERSION

# 5. Get AKS credentials
echo "🔑 Getting AKS credentials..."
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER --overwrite-existing

# 6. Update deployment with new image
echo "📝 Updating deployment.yaml with ACR name..."
sed -i.bak "s|<YOUR_ACR_NAME>|$ACR_NAME|g" k8s/deployment.yaml

# 7. Deploy to Kubernetes
echo "🚀 Deploying to Kubernetes..."
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Optional: Deploy ingress (kommentera in om du vill använda ingress)
# kubectl apply -f k8s/ingress.yaml

# 8. Wait for rollout
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/yellowhorrorhose-game

# 9. Get service URL
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Service information:"
kubectl get service yellowhorrorhose-game

echo ""
echo "🎮 Get external IP (kan ta några minuter):"
echo "   kubectl get service yellowhorrorhose-game -w"
echo ""
echo "📊 Check pods:"
echo "   kubectl get pods -l app=yellowhorrorhose-game"
echo ""
echo "📝 View logs:"
echo "   kubectl logs -l app=yellowhorrorhose-game -f"

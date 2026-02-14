#!/bin/bash

# Setup script for GitHub Actions deployment to Azure AKS

set -e

echo "🚀 Yellow Horror Hose - GitHub Actions Setup"
echo "============================================="
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first:"
    echo "   https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo "📝 Checking Azure login..."
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Running 'az login'..."
    az login
fi

echo ""
echo "Please provide the following information:"
echo ""

# Get inputs
read -p "ACR Name (without .azurecr.io): " ACR_NAME
read -p "Resource Group: " RESOURCE_GROUP
read -p "AKS Cluster Name: " AKS_CLUSTER

echo ""
echo "🔍 Getting subscription ID..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "   Subscription ID: $SUBSCRIPTION_ID"

echo ""
echo "🔐 Creating Service Principal..."
SP_NAME="github-yellowhorrorhose-$(date +%s)"

# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth)

echo "   ✅ Service Principal created: $SP_NAME"

# Get SP ID for ACR access
SP_APP_ID=$(echo $SP_OUTPUT | jq -r '.clientId')

echo ""
echo "🐳 Granting ACR access to Service Principal..."
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)

az role assignment create \
  --assignee $SP_APP_ID \
  --role AcrPush \
  --scope $ACR_ID > /dev/null

echo "   ✅ AcrPush role assigned"

echo ""
echo "☸️  Attaching ACR to AKS..."
az aks update \
  -n $AKS_CLUSTER \
  -g $RESOURCE_GROUP \
  --attach-acr $ACR_NAME > /dev/null

echo "   ✅ ACR attached to AKS"

echo ""
echo "============================================="
echo "✅ Setup Complete!"
echo "============================================="
echo ""
echo "📋 Add these secrets to your GitHub repository:"
echo ""
echo "Go to: GitHub repo → Settings → Secrets and variables → Actions"
echo ""
echo "1️⃣  AZURE_CREDENTIALS (JSON):"
echo "─────────────────────────────"
echo "$SP_OUTPUT"
echo ""
echo "2️⃣  ACR_NAME:"
echo "─────────────"
echo "$ACR_NAME"
echo ""
echo "3️⃣  AZURE_RESOURCE_GROUP:"
echo "──────────────────────────"
echo "$RESOURCE_GROUP"
echo ""
echo "4️⃣  AKS_CLUSTER:"
echo "─────────────────"
echo "$AKS_CLUSTER"
echo ""
echo "============================================="
echo ""
echo "🎯 Next steps:"
echo "1. Add the secrets above to GitHub"
echo "2. Push your code: git push origin main"
echo "3. Watch the deployment in GitHub Actions tab"
echo ""
echo "📖 For detailed instructions, see: .github/workflows/README.md"

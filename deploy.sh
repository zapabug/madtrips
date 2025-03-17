#!/bin/bash

echo "🚀 MadTrips Deployment Script"
echo "=============================="
echo "Preparing your application for deployment with fully decentralized architecture..."

# 1. Check if the API directory exists and remove it
if [ -d "api" ]; then
  echo "🧹 Removing API directory..."
  rm -rf api
  echo "✅ API directory removed successfully."
else
  echo "ℹ️ API directory not found. Already decentralized!"
fi

# 2. Check for API references in environment files
echo "🔍 Checking environment files for API references..."
if grep -q "API_URL" .env* 2>/dev/null; then
  echo "⚠️ Found API references in environment files."
  echo "   Please review and remove them manually."
else
  echo "✅ No API references found in environment files."
fi

# 3. Build the application
echo "🏗️ Building the application..."
npm run build

# 4. Output deployment instructions
echo "=============================="
echo "✅ Build completed!"
echo ""
echo "🚀 Deployment Instructions:"
echo "1. Deploy the '.next' directory to your hosting provider."
echo "2. Ensure your hosting provider supports Next.js applications."
echo "3. Set up any required environment variables on your hosting provider."
echo ""
echo "Your application is now ready for deployment as a fully decentralized application!"
echo "It uses Nostr for authentication and data storage, and client-side Lightning for payments."
echo "No traditional backend API is required."
echo "==============================" 
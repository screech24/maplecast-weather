#!/bin/bash

# MapleCast Weather App Deployment Script
# This script commits changes, builds and deploys the app to GitHub Pages

# Ensure we're in the weather-app directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🍁 MapleCast Weather App Deployment 🍁"
echo "======================================="
echo "Version: $(grep '"version"' package.json | cut -d '"' -f 4)"
echo "Deploying to: $(grep '"homepage"' package.json | cut -d '"' -f 4)"
echo "======================================="

# Install dependencies if needed
if [ "$1" == "--install" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if we're in a git repository
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  # Check for uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    # Get commit message
    if [ -z "$2" ]; then
      VERSION=$(grep '"version"' package.json | cut -d '"' -f 4)
      COMMIT_MSG="Update to version $VERSION"
    else
      COMMIT_MSG="$2"
    fi
    
    echo "📝 Committing changes with message: '$COMMIT_MSG'..."
    git add .
    git commit -m "$COMMIT_MSG"
    
    echo "⬆️ Pushing changes to repository..."
    git push origin $(git branch --show-current)
  else
    echo "✓ No changes to commit"
  fi
else
  echo "⚠️ Not a git repository. Skipping git operations."
fi

# Build and deploy
echo "🔨 Building application..."
npm run build

echo "🚀 Deploying to GitHub Pages..."
npm run deploy

echo "✅ Deployment complete!"
echo "Visit $(grep '"homepage"' package.json | cut -d '"' -f 4) to see your deployed app."
echo "Note: It may take a few minutes for the changes to propagate."

echo ""
echo "Usage:"
echo "  ./deploy.sh                       # Deploy without installing dependencies"
echo "  ./deploy.sh --install             # Install dependencies and deploy"
echo "  ./deploy.sh \"Custom commit message\" # Deploy with custom commit message"
echo "  ./deploy.sh --install \"Custom commit message\" # Install dependencies and deploy with custom commit message"
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
  # Get the homepage URL from package.json
  HOMEPAGE=$(grep '"homepage"' package.json | cut -d '"' -f 4)
  
  # Extract the repository name from the homepage URL
  REPO_NAME=$(echo "$HOMEPAGE" | sed -E 's|https://[^/]+/([^/]+)/?.*|\1|')
  
  # Check if the remote URL needs to be updated
  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  EXPECTED_REMOTE="https://github.com/screech24/$REPO_NAME.git"
  
  if [[ "$CURRENT_REMOTE" != "$EXPECTED_REMOTE" ]]; then
    echo "⚠️ Git remote URL needs to be updated."
    echo "Current:  $CURRENT_REMOTE"
    echo "Expected: $EXPECTED_REMOTE"
    
    read -p "Update git remote URL? (y/n): " update_remote
    if [[ $update_remote == "y" || $update_remote == "Y" ]]; then
      git remote set-url origin "$EXPECTED_REMOTE"
      echo "✅ Git remote URL updated."
    fi
  fi
  
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
    
    # Get current branch
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Try to pull changes from remote before pushing
    echo "⬇️ Pulling latest changes from remote repository..."
    if ! git pull --rebase origin $CURRENT_BRANCH 2>/dev/null; then
      echo "⚠️ Pull failed. There might be merge conflicts."
      
      # Ask if user wants to continue with deployment anyway
      read -p "Continue with deployment anyway? (y/n): " continue_deploy
      if [[ $continue_deploy != "y" && $continue_deploy != "Y" ]]; then
        echo "Deployment aborted."
        exit 1
      fi
      
      echo "Continuing with deployment..."
    else
      echo "✅ Successfully pulled latest changes."
    fi
    
    echo "⬆️ Pushing changes to repository..."
    if ! git push origin $CURRENT_BRANCH 2>/dev/null; then
      echo "⚠️ Push failed even after pulling. There might be other issues."
      
      # Ask if user wants to continue with deployment anyway
      read -p "Continue with deployment anyway? (y/n): " continue_deploy
      if [[ $continue_deploy != "y" && $continue_deploy != "Y" ]]; then
        echo "Deployment aborted."
        exit 1
      fi
      
      echo "Continuing with deployment..."
    else
      echo "✅ Successfully pushed changes to repository."
    fi
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

# Set environment variables for production
export NODE_ENV=production

# Build the app
echo "Building the app for production..."
npm run build

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "Build failed. Please fix the errors and try again."
  exit 1
fi

# Deployment options
echo "Choose a deployment option:"
echo "1. Deploy to GitHub Pages"
echo "2. Deploy to Netlify"
echo "3. Deploy to Vercel"
echo "4. Serve locally with HTTPS"

read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    # GitHub Pages deployment
    echo "Deploying to GitHub Pages..."
    
    # Check if gh-pages package is installed
    if ! npm list -g gh-pages > /dev/null 2>&1; then
      echo "Installing gh-pages package..."
      npm install -g gh-pages
    fi
    
    # Deploy using gh-pages
    npx gh-pages -d build
    
    echo "Deployed to GitHub Pages. Your app should be available at https://[username].github.io/[repository-name]"
    ;;
    
  2)
    # Netlify deployment
    echo "Deploying to Netlify..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
      echo "Installing Netlify CLI..."
      npm install -g netlify-cli
    fi
    
    # Deploy to Netlify
    netlify deploy --prod
    
    echo "Deployed to Netlify. Your app should be available at the URL provided above."
    ;;
    
  3)
    # Vercel deployment
    echo "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo "Installing Vercel CLI..."
      npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod
    
    echo "Deployed to Vercel. Your app should be available at the URL provided above."
    ;;
    
  4)
    # Serve locally with HTTPS
    echo "Serving locally with HTTPS..."
    
    # Check if serve package is installed
    if ! npm list -g serve > /dev/null 2>&1; then
      echo "Installing serve package..."
      npm install -g serve
    fi
    
    # Generate self-signed certificate for local HTTPS
    echo "Generating self-signed certificate for local HTTPS..."
    mkdir -p .cert
    
    # Check if OpenSSL is available
    if command -v openssl &> /dev/null; then
      openssl req -x509 -newkey rsa:2048 -keyout .cert/key.pem -out .cert/cert.pem -days 365 -nodes -subj "/CN=localhost"
      
      # Serve with HTTPS
      echo "Starting local HTTPS server..."
      serve -s build --ssl-cert .cert/cert.pem --ssl-key .cert/key.pem
    else
      echo "OpenSSL not found. Serving without HTTPS..."
      serve -s build
    fi
    ;;
    
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo "Deployment complete!"
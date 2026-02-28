#!/bin/bash

# Script to push code to GitHub
# This script provides instructions for pushing to GitHub as automated push requires authentication

echo "=========================================="
echo "  Push to GitHub - Image to Video AI App"
echo "=========================================="
echo ""

echo "The code has been committed locally and is ready to be pushed to GitHub."
echo ""
echo "To push the code, you need to authenticate with GitHub. Choose one of the following methods:"
echo ""

echo "OPTION 1: Using Personal Access Token (Recommended)"
echo "---------------------------------------------------"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token' -> 'Generate new token (classic)'"
echo "3. Give it a name and select 'repo' scope"
echo "4. Copy the generated token"
echo "5. Run the following commands:"
echo ""
echo "   git remote set-url origin https://YOUR_TOKEN@github.com/veo446688-hub/Veo4.git"
echo "   git push -u origin main"
echo ""
echo "Replace YOUR_TOKEN with your actual GitHub token"
echo ""

echo "OPTION 2: Using GitHub CLI"
echo "--------------------------"
echo "1. Install GitHub CLI if not already installed"
echo "2. Run: gh auth login"
echo "3. Follow the prompts to authenticate"
echo "4. Then run: git push -u origin main"
echo ""

echo "OPTION 3: Using SSH"
echo "-------------------"
echo "1. Set up SSH keys on your machine"
echo "2. Add your SSH public key to GitHub"
echo "3. Run the following commands:"
echo ""
echo "   git remote set-url origin git@github.com:veo446688-hub/Veo4.git"
echo "   git push -u origin main"
echo ""

echo "Current Git Status:"
echo "-------------------"
git status --short
echo ""

echo "Repository: https://github.com/veo446688-hub/Veo4"
echo ""
echo "For more detailed deployment instructions, see DEPLOYMENT.md"
echo "=========================================="

#!/bin/bash

# Deploy script for io game
# Usage: ./deploy.sh "commit message"

# Check if commit message is provided
if [ $# -eq 0 ]; then
    echo "Usage: ./deploy.sh \"commit message\""
    echo "Example: ./deploy.sh \"Add player names and healthbars\""
    exit 1
fi

COMMIT_MESSAGE="$1"

echo "🚀 Starting deployment process..."
echo "📝 Commit message: $COMMIT_MESSAGE"
echo ""

echo "Building client..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build client"
    exit 1
fi
echo "✅ Client built successfully"

# Step 1: Git add
echo "📁 Adding all files to git..."
git add .
if [ $? -ne 0 ]; then
    echo "❌ Failed to add files to git"
    exit 1
fi
echo "✅ Files added successfully"

# Step 2: Git commit
echo "💾 Committing changes..."
git commit -m "$COMMIT_MESSAGE"
if [ $? -ne 0 ]; then
    echo "❌ Failed to commit changes"
    exit 1
fi
echo "✅ Changes committed successfully"

# Step 3: Git push
echo "📤 Pushing to remote repository..."
git push
if [ $? -ne 0 ]; then
    echo "❌ Failed to push to remote"
    exit 1
fi
echo "✅ Changes pushed successfully"

# Step 4: Fly deploy
echo "☁️  Deploying to Fly.io..."
fly deploy
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy to Fly.io"
    exit 1
fi
echo "✅ Deployment completed successfully!"

echo ""
echo "🎉 All done! Your changes are now live!" 
#!/bin/bash
# Release build script for ClaudeProjects

# Set Xcode path (run this once if you get xcode-select errors)
# sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

cd "$(dirname "$0")"

echo "Building ClaudeProjects (Release)..."
xcodebuild -scheme ClaudeProjects -configuration Release build 2>&1 | tail -20

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful! App copied to /Applications/ClaudeProjects.app"
else
    echo ""
    echo "❌ Build failed. Check errors above."
fi

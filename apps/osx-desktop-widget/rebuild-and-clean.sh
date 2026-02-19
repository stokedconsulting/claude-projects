#!/bin/bash
# Rebuild and Clean Widget Script
# This script removes old OrchestrationHUD widgets and builds the new ClaudeProjects widget

set -e

echo "🧹 Cleaning old OrchestrationHUD widgets..."

# Remove old app if it exists
if [ -d "/Applications/OrchestrationHUD.app" ]; then
    echo "   Removing /Applications/OrchestrationHUD.app"
    sudo rm -rf "/Applications/OrchestrationHUD.app"
fi

# Kill widget processes to force reload
echo "   Killing widget processes..."
killall -9 WidgetKit-Extension 2>/dev/null || true
killall -9 "Widget Extension" 2>/dev/null || true

# Clean build artifacts
echo ""
echo "🧼 Cleaning Xcode build artifacts..."
cd "$(dirname "$0")"
xcodebuild clean -project ClaudeProjects.xcodeproj -scheme ClaudeProjects -configuration Release

# Build the new widget
echo ""
echo "🔨 Building ClaudeProjects widget..."
xcodebuild -project ClaudeProjects.xcodeproj \
    -scheme ClaudeProjects \
    -configuration Release \
    -derivedDataPath ./build \
    build

# The build script automatically copies to /Applications in Release mode
echo ""
echo "✅ Build complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Open System Settings > Desktop & Dock > Widgets"
echo "   2. Remove any old 'OrchestrationHUD' widgets from your desktop"
echo "   3. Click the '+' button to add new widgets"
echo "   4. Look for 'Stoked Projects' in the widget gallery"
echo "   5. Add the 'Stoked Projects' widget to your desktop"
echo ""
echo "   Or use the widget picker (Cmd+Space, type 'widget', click notification center)"
echo ""

# Clean old user data references
echo "🧹 Cleaning old Xcode user data..."
if [ -f "ClaudeProjects.xcodeproj/xcuserdata/$(whoami).xcuserdatad/xcschemes/xcschememanagement.plist" ]; then
    # Remove old OrchestrationHUD scheme reference
    plutil -replace SchemeUserState.OrchestrationHUD.xcscheme -xml '<dict/>' \
        "ClaudeProjects.xcodeproj/xcuserdata/$(whoami).xcuserdatad/xcschemes/xcschememanagement.plist" 2>/dev/null || true
fi

echo "✨ All done! The 'Stoked Projects' widget should now appear in your widget gallery."

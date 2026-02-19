#!/bin/bash
# Install ClaudeProjects Widget
# Copies the built app bundle to /Applications

set -e

echo "📦 Installing ClaudeProjects widget..."

BUILD_APP="/Users/stoked/work/stoked-projects/apps/osx-desktop-widget/build/Build/Products/Release/ClaudeProjects.app"
INSTALL_PATH="/Applications/ClaudeProjects.app"

# Check if build exists
if [ ! -d "$BUILD_APP" ]; then
    echo "❌ Error: Built app not found at $BUILD_APP"
    echo "   Run './rebuild-and-clean.sh' first to build the app"
    exit 1
fi

# Check if widget extension is included
if [ ! -d "$BUILD_APP/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex" ]; then
    echo "❌ Error: Widget extension not found in app bundle"
    echo "   The build may have failed. Check build logs."
    exit 1
fi

# Remove old app if exists
if [ -d "$INSTALL_PATH" ]; then
    echo "🗑️  Removing old installation..."
    sudo rm -rf "$INSTALL_PATH"
fi

# Copy new app
echo "📋 Copying app to /Applications..."
sudo cp -R "$BUILD_APP" /Applications/

# Verify installation
if [ -d "$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex" ]; then
    echo "✅ Installation successful!"
    echo ""
    echo "Widget extension verified at:"
    echo "   $INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex"
else
    echo "❌ Installation failed - widget extension not found"
    exit 1
fi

# Kill widget processes to force reload
echo ""
echo "🔄 Refreshing widget system..."
killall -9 WidgetKit-Extension 2>/dev/null && echo "   ✓ Killed WidgetKit-Extension" || echo "   ℹ️  WidgetKit-Extension not running"
killall -9 "Widget Extension" 2>/dev/null && echo "   ✓ Killed Widget Extension" || echo "   ℹ️  Widget Extension not running"
killall -9 Dock 2>/dev/null && echo "   ✓ Restarted Dock" || echo "   ℹ️  Dock restart failed"

echo ""
echo "✨ Done! Now add the widget:"
echo ""
echo "   1. Click on your Desktop"
echo "   2. Click 'Edit Widgets' or press Fn+F5"
echo "   3. Search for 'Stoked Projects'"
echo "   4. Drag the widget to your desktop"
echo ""
echo "   If it doesn't appear, restart your Mac."
echo ""

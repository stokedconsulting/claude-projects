#!/bin/bash
# Fix Code Signing for ClaudeProjects Widget
# Re-signs the app and widget extension with ad-hoc signature

set -e

echo "🔐 Fixing code signature for ClaudeProjects widget..."
echo ""

INSTALL_PATH="/Applications/ClaudeProjects.app"
WIDGET_PATH="$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex"

# Check if app exists
if [ ! -d "$INSTALL_PATH" ]; then
    echo "❌ Error: App not found at $INSTALL_PATH"
    echo "   Run: ./install-widget.sh"
    exit 1
fi

# Remove old signature
echo "1️⃣  Removing old signatures..."
sudo codesign --remove-signature "$WIDGET_PATH" 2>/dev/null || echo "   (No signature to remove from widget)"
sudo codesign --remove-signature "$INSTALL_PATH" 2>/dev/null || echo "   (No signature to remove from app)"

# Sign widget extension first (must sign inner bundles before outer)
echo ""
echo "2️⃣  Signing widget extension..."
sudo codesign --force --deep --sign - "$WIDGET_PATH"

# Sign main app
echo ""
echo "3️⃣  Signing main app..."
sudo codesign --force --deep --sign - "$INSTALL_PATH"

# Verify signatures
echo ""
echo "4️⃣  Verifying signatures..."
codesign -dv "$WIDGET_PATH" 2>&1 | grep "Signature" && echo "   ✅ Widget extension signed" || echo "   ❌ Widget signing failed"
codesign -dv "$INSTALL_PATH" 2>&1 | grep "Signature" && echo "   ✅ Main app signed" || echo "   ❌ App signing failed"

# Kill widget processes
echo ""
echo "5️⃣  Restarting widget system..."
killall -9 WidgetKit-Extension 2>/dev/null && echo "   ✓ Killed WidgetKit-Extension" || true
killall -9 "Widget Extension" 2>/dev/null && echo "   ✓ Killed Widget Extension" || true
killall Dock && echo "   ✓ Restarted Dock" || true

echo ""
echo "✅ Done! Widget signatures fixed."
echo ""
echo "   Now try adding the widget:"
echo "   1. Wait for Dock to restart (a few seconds)"
echo "   2. Click Desktop → Edit Widgets"
echo "   3. Search for 'Claude Projects'"
echo "   4. Drag to desktop"
echo ""
echo "   If it still doesn't appear, you may need to:"
echo "   - Open System Settings → Privacy & Security"
echo "   - Look for a message about blocked software"
echo "   - Click 'Open Anyway' if you see ClaudeProjects"
echo ""

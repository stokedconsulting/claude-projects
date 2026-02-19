#!/bin/bash
# Reset Widget System Cache
# Forces macOS to rediscover widgets by clearing caches

echo "🔄 Resetting widget system cache..."
echo ""

# Kill all widget-related processes
echo "1️⃣  Stopping widget processes..."
killall -9 WidgetKit-Extension 2>/dev/null && echo "   ✓ Killed WidgetKit-Extension" || echo "   ℹ️  WidgetKit-Extension not running"
killall -9 "Widget Extension" 2>/dev/null && echo "   ✓ Killed Widget Extension" || echo "   ℹ️  Widget Extension not running"
killall -9 NotificationCenter 2>/dev/null && echo "   ✓ Killed NotificationCenter" || true
killall -9 ControlCenter 2>/dev/null && echo "   ✓ Killed ControlCenter" || true

# Clear widget cache (if exists)
echo ""
echo "2️⃣  Clearing widget caches..."
WIDGET_CACHE="$HOME/Library/Caches/com.apple.WidgetKit"
if [ -d "$WIDGET_CACHE" ]; then
    rm -rf "$WIDGET_CACHE"
    echo "   ✓ Cleared WidgetKit cache"
else
    echo "   ℹ️  No WidgetKit cache found"
fi

# Clear widget data (if exists) - careful, this removes widget configurations
WIDGET_DATA="$HOME/Library/WidgetKit"
if [ -d "$WIDGET_DATA" ]; then
    echo "   ⚠️  Widget data directory exists: $WIDGET_DATA"
    echo "      (Not deleting to preserve widget configurations)"
fi

# Touch the app to update modification time
echo ""
echo "3️⃣  Updating app modification time..."
touch /Applications/ClaudeProjects.app

# Restart Dock (manages widget picker)
echo ""
echo "4️⃣  Restarting Dock..."
killall Dock

echo ""
echo "⏳ Waiting for Dock to restart (5 seconds)..."
sleep 5

echo ""
echo "✅ Widget cache reset complete!"
echo ""
echo "   Now try adding the widget:"
echo "   1. Click Desktop → Edit Widgets"
echo "   2. Look for 'Stoked Projects' in the left sidebar"
echo "   3. If you see it, drag it to your desktop"
echo ""
echo "   If 'Stoked Projects' still doesn't appear:"
echo "   - Run: ./fix-signing.sh (to fix code signature)"
echo "   - Or restart your Mac"
echo "   - Or check System Settings → Privacy & Security for blocked apps"
echo ""

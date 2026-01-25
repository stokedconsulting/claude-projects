#!/bin/bash
# Remove Old OrchestrationHUD Widgets
# This script removes the old OrchestrationHUD app and forces widget refresh

echo "🧹 Removing old OrchestrationHUD widgets..."

# Remove old app if it exists
if [ -d "/Applications/OrchestrationHUD.app" ]; then
    echo "   Removing /Applications/OrchestrationHUD.app"
    sudo rm -rf "/Applications/OrchestrationHUD.app"
    echo "   ✓ Removed old app"
else
    echo "   ℹ️  No OrchestrationHUD app found in /Applications"
fi

# Kill widget processes to force reload
echo ""
echo "🔄 Refreshing widget system..."
killall -9 WidgetKit-Extension 2>/dev/null && echo "   ✓ Killed WidgetKit-Extension" || echo "   ℹ️  WidgetKit-Extension not running"
killall -9 "Widget Extension" 2>/dev/null && echo "   ✓ Killed Widget Extension" || echo "   ℹ️  Widget Extension not running"

echo ""
echo "✅ Done!"
echo ""
echo "📋 To remove old widgets from your desktop:"
echo "   1. Right-click on any old 'OrchestrationHUD' widget"
echo "   2. Select 'Remove Widget'"
echo "   3. Repeat for all old widgets"
echo ""
echo "   The old widgets should now show as unavailable since the app was removed."
echo ""

#!/bin/bash
# Check Widget Installation Status
# Diagnoses widget installation issues

echo "🔍 Checking ClaudeProjects widget status..."
echo ""

BUILD_APP="/Users/stoked/work/claude-projects/apps/osx-desktop-widget/build/Build/Products/Release/ClaudeProjects.app"
INSTALL_PATH="/Applications/ClaudeProjects.app"

# Check build
echo "1️⃣  Build Directory:"
if [ -d "$BUILD_APP" ]; then
    echo "   ✅ Built app exists: $BUILD_APP"
    if [ -d "$BUILD_APP/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex" ]; then
        echo "   ✅ Widget extension found in build"
    else
        echo "   ❌ Widget extension MISSING in build"
        echo "      Run: ./rebuild-and-clean.sh"
    fi
else
    echo "   ❌ Built app not found"
    echo "      Run: ./rebuild-and-clean.sh"
fi

echo ""
echo "2️⃣  Installation:"
if [ -d "$INSTALL_PATH" ]; then
    echo "   ✅ App installed at: $INSTALL_PATH"
    if [ -d "$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex" ]; then
        echo "   ✅ Widget extension properly installed"

        # Check code signature
        codesign -dv "$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex" 2>&1 | grep -q "Signature=adhoc" && \
            echo "   ✅ Widget extension signed (adhoc)" || \
            echo "   ⚠️  Widget extension signature issue"
    else
        echo "   ❌ Widget extension MISSING from installed app"
        echo "      The app was copied incorrectly."
        echo "      Run: ./install-widget.sh"
    fi
else
    echo "   ❌ App not installed"
    echo "      Run: ./install-widget.sh"
fi

echo ""
echo "3️⃣  Old OrchestrationHUD:"
if [ -d "/Applications/OrchestrationHUD.app" ]; then
    echo "   ⚠️  Old app still exists"
    echo "      Run: ./remove-old-widgets.sh"
else
    echo "   ✅ Old app removed"
fi

echo ""
echo "4️⃣  Widget Processes:"
if pgrep -f "WidgetKit" > /dev/null; then
    echo "   ✅ WidgetKit-Extension running (PID: $(pgrep -f "WidgetKit"))"
else
    echo "   ℹ️  WidgetKit-Extension not running (will start when needed)"
fi

echo ""
echo "5️⃣  Bundle Identifiers:"
if [ -f "$INSTALL_PATH/Contents/Info.plist" ]; then
    APP_ID=$(defaults read "$INSTALL_PATH/Contents/Info.plist" CFBundleIdentifier 2>/dev/null)
    echo "   App Bundle ID: $APP_ID"
fi
if [ -f "$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex/Contents/Info.plist" ]; then
    WIDGET_ID=$(defaults read "$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex/Contents/Info.plist" CFBundleIdentifier 2>/dev/null)
    echo "   Widget Bundle ID: $WIDGET_ID"
fi

echo ""
echo "📋 Summary:"
if [ -d "$INSTALL_PATH/Contents/PlugIns/ClaudeProjectsWidgetExtension.appex" ]; then
    echo "   ✅ Widget should appear in widget gallery as 'Claude Projects'"
    echo ""
    echo "   If you don't see it:"
    echo "   1. Restart Dock: killall Dock"
    echo "   2. Or restart your Mac"
    echo "   3. Open widget picker (Desktop → Edit Widgets)"
else
    echo "   ❌ Widget will NOT appear - installation incomplete"
    echo ""
    echo "   Fix by running: ./install-widget.sh"
fi
echo ""

# Widget Update Guide: OrchestrationHUD → Stoked Projects

## What Happened?

The widget project was renamed from "OrchestrationHUD" to "ClaudeProjects", but two issues occurred:

1. **Old widgets still registered**: The old "OrchestrationHUD" app was still in /Applications
2. **Incomplete installation**: The build script's copy phase created an empty app directory at `/Applications/ClaudeProjects.app` without the actual app contents or widget extension

This is why you see:

- ❌ Old "OrchestrationHUD" widgets in the widget gallery
- ❌ No "Stoked Projects" widgets visible
- ❌ Empty app bundle at `/Applications/ClaudeProjects.app` (missing `Contents/PlugIns/`)
- ✅ Successful build at `apps/osx-desktop-widget/build/Build/Products/Release/ClaudeProjects.app` (with widget extension)

## Quick Fix (Recommended)

### Step 1: Check Current Status

First, see what's wrong:

```bash
cd apps/osx-desktop-widget
./check-widget-status.sh
```

### Step 2: Install the Widget

The build was successful but the app wasn't copied correctly. Run:

```bash
cd apps/osx-desktop-widget
./install-widget.sh
```

This will:
1. Copy the complete app bundle to `/Applications/ClaudeProjects.app`
2. Verify the widget extension is included
3. Kill widget processes to force refresh
4. Restart Dock

**Note:** You'll need to enter your password for `sudo`.

## Manual Steps (Alternative)

### Step 1: Remove Old Widgets

```bash
cd apps/osx-desktop-widget
./remove-old-widgets.sh
```

Then manually remove old widgets from your desktop:
1. Right-click each old "OrchestrationHUD" widget
2. Select "Remove Widget"

### Step 2: Build New Widget

```bash
cd apps/osx-desktop-widget
xcodebuild -project ClaudeProjects.xcodeproj \
    -scheme ClaudeProjects \
    -configuration Release \
    build
```

The Release build automatically copies to `/Applications/ClaudeProjects.app`.

### Step 3: Add New Widgets

1. Open **System Settings** → **Desktop & Dock** → **Widgets**
2. Or use widget picker: Click Desktop → **Edit Widgets**
3. Look for **"Stoked Projects"** (not OrchestrationHUD)
4. Add the widget to your desktop

## Widget Configuration

The new widget is configured as:

- **App Name**: Stoked Projects
- **Bundle ID**: `com.claudeprojects.app`
- **Widget Bundle ID**: `com.claudeprojects.app.widget`
- **Widget Kind**: `ClaudeProjectsWidget`
- **Display Name**: "Stoked Projects"
- **Description**: "Monitor your Claude LLM orchestration sessions."

## Troubleshooting

### Widget doesn't appear in gallery

1. Make sure the app is in `/Applications/ClaudeProjects.app`
2. Kill widget processes: `killall -9 WidgetKit-Extension`
3. Restart macOS (if needed)

### Old widgets still showing

1. Remove old app: `sudo rm -rf /Applications/OrchestrationHUD.app`
2. Remove widgets from desktop manually
3. Kill widget processes: `killall -9 WidgetKit-Extension`

### Widget shows "Unable to Load"

1. Check file permissions on widget data directory:
   ```bash
   ls -la ~/.claude-sessions/
   ```
2. Rebuild widget with: `./rebuild-and-clean.sh`

## File Locations

- **App**: `/Applications/ClaudeProjects.app`
- **Widget Data**: `~/.claude-sessions/widget-state.json`
- **Old App** (remove): `/Applications/OrchestrationHUD.app`

## Scripts

- `rebuild-and-clean.sh` - Complete rebuild and install (recommended)
- `remove-old-widgets.sh` - Just remove old OrchestrationHUD widgets

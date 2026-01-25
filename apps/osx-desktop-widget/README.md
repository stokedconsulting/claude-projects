# Orchestration HUD - macOS Desktop Widget

A native macOS widget that provides at-a-glance visibility and control over your autonomous LLM orchestration system.

## Features

- **Ticket Stats**: View created/closed tickets in the last 24 hours and 30 days
- **Project Stats**: Track created/closed projects by LLMs
- **Concurrency Control**: Visual indicator showing current LLM processes (0-20)
- **Recent Completions**: Last 5 completed tasks with timestamps
- **Full History**: Host app with complete history browser

## Requirements

- **macOS 14.0+** (Sonoma or later)
- **Xcode 15.2+** for building
- **Apple Developer account** (free account works for local development)

## Quick Start

### 1. Set Xcode as Active Developer Directory

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. Open in Xcode

```bash
open OrchestrationHUD.xcodeproj
```

### 3. Configure Signing

1. Select the **OrchestrationHUD** target
2. Go to **Signing & Capabilities**
3. Select your **Team** (personal or organization)
4. Repeat for **OrchestrationWidgetExtension** target

### 4. Build & Run

Press **⌘R** to build and run the app.

### 5. Add Widget to Desktop

1. Right-click on your desktop
2. Select **Edit Widgets...**
3. Search for "Orchestration HUD"
4. Drag the widget to your desktop

## Project Structure

```
OrchestrationHUD/
├── OrchestrationHUD/           # Main app
│   ├── OrchestrationHUDApp.swift   # App entry point
│   ├── ContentView.swift           # History browser UI
│   └── Assets.xcassets             # App icons & colors
├── Shared/                     # Shared code between app & widget
│   ├── OrchestrationModels.swift   # Data models
│   └── OrchestrationAPIClient.swift # API client
└── OrchestrationWidget/        # Widget extension
    ├── OrchestrationWidget.swift    # Widget configuration
    └── OrchestrationWidgetView.swift # Widget UI
```

## Configuration

### API Settings

Open the host app and go to **Settings** (⌘,) to configure:

- **API Base URL**: Your api endpoint (default: `http://localhost:3000`)
- **API Key**: Your API authentication key

### App Groups

The widget and host app share data via App Groups. The identifier is:
```
group.com.orchestration.hud
```

## Widget Design

The widget uses a modern glassmorphic design with:

- Dark mode optimized colors
- Gradient accents (cyan to purple)
- Semi-transparent cards with blur effects
- Live status indicator
- Color-coded concurrency bar (green → yellow → orange)

## API Integration

Currently using mock data. To connect to your api:

1. Update `OrchestrationAPIClient.swift` with real endpoints
2. The existing API structure supports:
   - `GET /sessions` - Active sessions
   - `GET /tasks` - Task history
   - `PUT /machines/:id` - Update concurrency settings

## Troubleshooting

### Widget Not Appearing

1. Ensure the host app has been run at least once
2. Check Console.app for widget crash logs
3. Try removing and re-adding the widget

### Build Errors

If you see "xcodebuild requires Xcode":
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### Signing Issues

For local development without paid developer account:
1. Use "Sign to Run Locally" option
2. Or disable App Sandbox temporarily in entitlements

## License

Part of the claude-projects monorepo.

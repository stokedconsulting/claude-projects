import SwiftUI

@main
struct ClaudeProjectsApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .defaultSize(width: 900, height: 650)
        .commands {
            CommandGroup(replacing: .newItem) { }
        }
        
        Settings {
            SettingsView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Ensure the app activates and shows its window
        NSApp.activate(ignoringOtherApps: true)
        
        // Make the first window key and front
        if let window = NSApp.windows.first {
            window.makeKeyAndOrderFront(nil)
        }
    }
    
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            // Show main window when dock icon is clicked
            for window in sender.windows {
                window.makeKeyAndOrderFront(self)
            }
        }
        return true
    }
}

struct SettingsView: View {
    @AppStorage("apiBaseURL") private var apiBaseURL = "http://localhost:3000"
    
    var body: some View {
        Form {
            TextField("API Base URL", text: $apiBaseURL)
        }
        .padding()
        .frame(width: 400)
    }
}

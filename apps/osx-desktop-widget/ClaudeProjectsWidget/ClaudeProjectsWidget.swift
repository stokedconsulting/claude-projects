import WidgetKit
import SwiftUI

struct ClaudeProjectsEntry: TimelineEntry {
    let date: Date
    let stats: ClaudeProjectsDataSource.WidgetStats
}

struct ClaudeProjectsTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> ClaudeProjectsEntry {
        ClaudeProjectsEntry(date: Date(), stats: ClaudeProjectsDataSource.shared.getWidgetStats())
    }
    
    func getSnapshot(in context: Context, completion: @escaping (ClaudeProjectsEntry) -> Void) {
        let stats = ClaudeProjectsDataSource.shared.getWidgetStats()
        completion(ClaudeProjectsEntry(date: Date(), stats: stats))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<ClaudeProjectsEntry>) -> Void) {
        let stats = ClaudeProjectsDataSource.shared.getWidgetStats()
        let entry = ClaudeProjectsEntry(date: Date(), stats: stats)
        
        // Refresh every 30 seconds to pick up file changes
        let nextUpdate = Calendar.current.date(byAdding: .second, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

@main
struct ClaudeProjectsWidget: Widget {
    let kind: String = "ClaudeProjectsWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClaudeProjectsTimelineProvider()) { entry in
            ClaudeProjectsWidgetView(entry: entry)
                // Use containerBackground for proper widget background (macOS 14+)
                .containerBackground(for: .widget) {
                    Color.clear // Transparent background between cards
                }
        }
        .configurationDisplayName("Claude Projects")
        .description("Monitor your Claude LLM orchestration sessions.")
        .supportedFamilies([.systemLarge, .systemExtraLarge])
        .contentMarginsDisabled()
    }
}

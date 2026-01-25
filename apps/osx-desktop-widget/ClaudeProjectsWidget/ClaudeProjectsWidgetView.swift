import SwiftUI
import WidgetKit
import AppIntents

struct ClaudeProjectsWidgetView: View {
    let entry: ClaudeProjectsEntry
    
    // Dark muted color palette - cards opaque, background transparent
    private let cardBg = Color(red: 0.15, green: 0.15, blue: 0.17)
    private let textPrimary = Color(white: 0.92)
    private let textSecondary = Color(white: 0.55)
    private let textMuted = Color(white: 0.38)
    private let greenAccent = Color(red: 0.25, green: 0.72, blue: 0.45)
    private let blueAccent = Color(red: 0.35, green: 0.55, blue: 0.9)
    private let orangeAccent = Color(red: 0.9, green: 0.6, blue: 0.2)
    
    var body: some View {
        VStack(spacing: 6) {
            // Row 1: Tasks (Issues)
            HStack(spacing: 6) {
                StatCard(
                    period: "24hr",
                    count: entry.stats.issues24hCreated,
                    label: "Tasks Created",
                    color: blueAccent,
                    cardBg: cardBg
                )
                
                StatCard(
                    period: "30 days",
                    count: entry.stats.issues30dCreated,
                    label: "Tasks Created",
                    color: blueAccent,
                    cardBg: cardBg
                )
                
                StatCard(
                    period: "24hr",
                    count: entry.stats.issues24hClosed,
                    label: "Tasks Closed",
                    color: blueAccent.opacity(0.8),
                    cardBg: cardBg
                )
                
                StatCard(
                    period: "30 days",
                    count: entry.stats.issues30dClosed,
                    label: "Tasks Closed",
                    color: blueAccent.opacity(0.8),
                    cardBg: cardBg
                )
            }
            
            // Row 2: Projects
            HStack(spacing: 6) {
                StatCard(
                    period: "24hr",
                    count: entry.stats.projects24hCreated,
                    label: "Projects Opened",
                    color: greenAccent,
                    cardBg: cardBg
                )
                
                StatCard(
                    period: "30 days",
                    count: entry.stats.projects30dCreated,
                    label: "Projects Opened",
                    color: greenAccent,
                    cardBg: cardBg
                )
                
                StatCard(
                    period: "24hr",
                    count: entry.stats.projects24hClosed,
                    label: "Projects Closed",
                    color: greenAccent.opacity(0.8),
                    cardBg: cardBg
                )
                
                StatCard(
                    period: "30 days",
                    count: entry.stats.projects30dClosed,
                    label: "Projects Closed",
                    color: greenAccent.opacity(0.8),
                    cardBg: cardBg
                )
            }
            
            // LLM Control Row
            HStack(spacing: 6) {
                // LLM Count Control
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("LLM Processes")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(textSecondary)
                        Spacer()
                        Text("\(entry.stats.llmCount)/\(entry.stats.maxLLMs)")
                            .font(.system(size: 11, weight: .semibold).monospacedDigit())
                            .foregroundColor(textPrimary)
                    }
                    
                    HStack(spacing: 4) {
                        Button(intent: DecrementLLMIntent()) {
                            Image(systemName: "minus.circle.fill")
                                .font(.system(size: 14))
                                .foregroundColor(textSecondary)
                        }
                        .buttonStyle(.plain)
                        
                        ForEach([4, 8, 12, 16, 20], id: \.self) { level in
                            let isActive = entry.stats.llmCount >= level
                            Button(intent: SetLLMCountIntent(count: level)) {
                                Text("\(level)")
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundColor(isActive ? .white : textMuted)
                                    .frame(width: 24, height: 16)
                                    .background(
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(isActive ? greenAccent : cardBg.opacity(0.5))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                        
                        Button(intent: IncrementLLMIntent()) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 14))
                                .foregroundColor(greenAccent)
                        }
                        .buttonStyle(.plain)
                        
                        Spacer()
                    }
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 6).fill(cardBg))
                
                // Active Sessions Count
                VStack(spacing: 2) {
                    Text("Active")
                        .font(.system(size: 9))
                        .foregroundColor(textSecondary)
                    Text("\(entry.stats.activeSessionCount)")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(blueAccent)
                    Text("Sessions")
                        .font(.system(size: 9))
                        .foregroundColor(textMuted)
                }
                .padding(8)
                .frame(width: 80)
                .background(RoundedRectangle(cornerRadius: 6).fill(cardBg))
            }
            
            // Active Sessions List
            VStack(alignment: .leading, spacing: 4) {
                Text("Active Sessions")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(textSecondary)
                
                if entry.stats.sessions.isEmpty {
                    Text("No active sessions")
                        .font(.system(size: 10))
                        .foregroundColor(textMuted)
                } else {
                    ForEach(Array(entry.stats.sessions.keys.prefix(4)), id: \.self) { sessionId in
                        if let session = entry.stats.sessions[sessionId] {
                            sessionRow(session: session)
                        }
                    }
                }
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 6).fill(cardBg))
            
            // Recent Tasks
            VStack(alignment: .leading, spacing: 4) {
                Text("Recent Tasks")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(textSecondary)
                
                if entry.stats.activeTasks.isEmpty && entry.stats.recentCompletions.isEmpty {
                    Text("No tasks yet")
                        .font(.system(size: 10))
                        .foregroundColor(textMuted)
                } else {
                    ForEach(entry.stats.activeTasks.prefix(3)) { task in
                        taskRow(task: task, isActive: true)
                    }
                    ForEach(entry.stats.recentCompletions.prefix(2)) { task in
                        taskRow(task: task, isActive: false)
                    }
                }
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 6).fill(cardBg))
        }
        .padding(6)
    }
    
    private func sessionRow(session: ClaudeProjectsDataSource.OrchestrationData.Session) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(greenAccent)
                .frame(width: 5, height: 5)
            
            VStack(alignment: .leading, spacing: 1) {
                Text(session.project)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(textPrimary)
                    .lineLimit(1)
                Text(session.status)
                    .font(.system(size: 9))
                    .foregroundColor(textMuted)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Text("PID: \(session.pid)")
                .font(.system(size: 8).monospacedDigit())
                .foregroundColor(textMuted)
        }
    }
    
    private func taskRow(task: ClaudeProjectsDataSource.TasksData.LLMTask, isActive: Bool) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(isActive ? orangeAccent : greenAccent.opacity(0.6))
                .frame(width: 4, height: 4)
            
            Text(task.project)
                .font(.system(size: 10))
                .foregroundColor(isActive ? textPrimary : textSecondary)
                .lineLimit(1)
            
            Spacer()
            
            Text(task.timeAgo)
                .font(.system(size: 9))
                .foregroundColor(textMuted)
        }
    }
}

// Updated Stat Card for single metric
struct StatCard: View {
    let period: String
    let count: Int
    let label: String
    let color: Color
    let cardBg: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(period)
                .font(.system(size: 8, weight: .medium))
                .foregroundColor(Color(white: 0.5))
            
            Text("\(count)")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(color)
            
            Text(label)
                .font(.system(size: 8))
                .foregroundColor(Color(white: 0.6))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(6)
        .background(RoundedRectangle(cornerRadius: 6).fill(cardBg))
    }
}

import Foundation

// MARK: - Orchestration Stats

struct OrchestrationStats: Codable {
    var tickets24hCreated: Int
    var tickets24hClosed: Int
    var tickets30dCreated: Int
    var tickets30dClosed: Int
    var projects24hCreated: Int
    var projects24hClosed: Int
    var projects30dCreated: Int
    var projects30dClosed: Int
    var concurrentLLMs: Int
    var maxConcurrentLLMs: Int
    
    static var mock: OrchestrationStats {
        OrchestrationStats(
            tickets24hCreated: 12,
            tickets24hClosed: 8,
            tickets30dCreated: 245,
            tickets30dClosed: 189,
            projects24hCreated: 2,
            projects24hClosed: 0,
            projects30dCreated: 15,
            projects30dClosed: 12,
            concurrentLLMs: 12,
            maxConcurrentLLMs: 20
        )
    }
}

// MARK: - Completion

struct Completion: Identifiable, Codable {
    let id: String
    let title: String
    let project: String
    let completedAt: Date
    
    var timeAgo: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: completedAt, relativeTo: Date())
    }
    
    static var mockList: [Completion] {
        let now = Date()
        return [
            Completion(id: "1", title: "Fix auth token refresh logic", project: "Project Alpha", completedAt: now.addingTimeInterval(-120)),
            Completion(id: "2", title: "Add user profile avatar upload", project: "Project Alpha", completedAt: now.addingTimeInterval(-900)),
            Completion(id: "3", title: "Refactor payment flow for Stripe v3", project: "Project Beta", completedAt: now.addingTimeInterval(-3600)),
            Completion(id: "4", title: "Update API documentation", project: "Project Gamma", completedAt: now.addingTimeInterval(-7200)),
            Completion(id: "5", title: "Create API rate limiting middleware", project: "Project Alpha", completedAt: now.addingTimeInterval(-10800)),
            Completion(id: "6", title: "Implement dark mode toggle", project: "Project Beta", completedAt: now.addingTimeInterval(-14400)),
            Completion(id: "7", title: "Add unit tests for auth module", project: "Project Alpha", completedAt: now.addingTimeInterval(-18000)),
            Completion(id: "8", title: "Fix memory leak in WebSocket handler", project: "Project Gamma", completedAt: now.addingTimeInterval(-21600))
        ]
    }
}

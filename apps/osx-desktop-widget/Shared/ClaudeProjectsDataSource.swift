import Foundation

/// Data source that reads from ~/.stoked-projects/ JSON files
class ClaudeProjectsDataSource {
    static let shared = ClaudeProjectsDataSource()
    
    private let baseDir: URL
    private let orchestrationFile: URL
    private let tasksFile: URL
    
    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        baseDir = home.appendingPathComponent(".stoked-projects")
        orchestrationFile = baseDir.appendingPathComponent("orchestration.json")
        tasksFile = baseDir.appendingPathComponent("llmTasks.json")
        
        // Ensure directory exists
        try? FileManager.default.createDirectory(at: baseDir, withIntermediateDirectories: true)
    }
    
    // MARK: - Orchestration Data
    
    struct OrchestrationData: Codable {
        var llmCount: Int
        var maxLLMs: Int
        var activeSessions: [String: Session]
        
        // Metrics
        var issues24hCreated: Int?
        var issues24hClosed: Int?
        var issues30dCreated: Int?
        var issues30dClosed: Int?
        var projects24hCreated: Int?
        var projects24hClosed: Int?
        var projects30dCreated: Int?
        var projects30dClosed: Int?
        
        struct Session: Codable {
            let project: String
            let pid: String
            let status: String
            let startedAt: String
            let subAgents: [String: String]
        }
        
        static var empty: OrchestrationData {
            OrchestrationData(
                llmCount: 0,
                maxLLMs: 20,
                activeSessions: [:],
                issues24hCreated: 0,
                issues24hClosed: 0,
                issues30dCreated: 0,
                issues30dClosed: 0,
                projects24hCreated: 0,
                projects24hClosed: 0,
                projects30dCreated: 0,
                projects30dClosed: 0
            )
        }
    }
    
    func readOrchestration() -> OrchestrationData {
        guard FileManager.default.fileExists(atPath: orchestrationFile.path) else {
            return .empty
        }
        
        do {
            let data = try Data(contentsOf: orchestrationFile)
            let decoded = try JSONDecoder().decode(OrchestrationData.self, from: data)
            return decoded
        } catch {
            print("Error reading orchestration.json: \(error)")
            return .empty
        }
    }
    
    func updateLLMCount(_ count: Int) {
        var data = readOrchestration()
        data.llmCount = max(0, min(count, data.maxLLMs))
        saveOrchestration(data)
    }
    
    func incrementLLMCount() {
        var data = readOrchestration()
        data.llmCount = min(data.llmCount + 1, data.maxLLMs)
        saveOrchestration(data)
    }
    
    func decrementLLMCount() {
        var data = readOrchestration()
        data.llmCount = max(0, data.llmCount - 1)
        saveOrchestration(data)
    }
    
    private func saveOrchestration(_ data: OrchestrationData) {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let jsonData = try encoder.encode(data)
            try jsonData.write(to: orchestrationFile)
        } catch {
            print("Error saving orchestration.json: \(error)")
        }
    }
    
    // MARK: - Tasks Data
    
    struct TasksData: Codable {
        var tasks: [LLMTask]
        
        struct LLMTask: Codable, Identifiable {
            let id: String
            let sessionId: String
            let command: String
            let pid: String
            let project: String
            let issuedAt: String
            var lastStatus: String
            var phase: Int
            var completedAt: String?
            
            var isActive: Bool { completedAt == nil }
            
            var timeAgo: String {
                let formatter = ISO8601DateFormatter()
                guard let date = formatter.date(from: issuedAt) else { return "" }
                let diff = Date().timeIntervalSince(date)
                
                if diff < 60 { return "just now" }
                if diff < 3600 { return "\(Int(diff/60))m ago" }
                if diff < 86400 { return "\(Int(diff/3600))h ago" }
                return "\(Int(diff/86400))d ago"
            }
        }
        
        static var empty: TasksData { TasksData(tasks: []) }
    }
    
    func readTasks() -> TasksData {
        guard FileManager.default.fileExists(atPath: tasksFile.path) else {
            return .empty
        }
        
        do {
            let data = try Data(contentsOf: tasksFile)
            let decoded = try JSONDecoder().decode(TasksData.self, from: data)
            return decoded
        } catch {
            print("Error reading llmTasks.json: \(error)")
            return .empty
        }
    }
    
    func getActiveTasks() -> [TasksData.LLMTask] {
        readTasks().tasks.filter { $0.isActive }
    }
    
    func getRecentTasks(limit: Int = 10) -> [TasksData.LLMTask] {
        Array(readTasks().tasks.sorted { $0.issuedAt > $1.issuedAt }.prefix(limit))
    }
    
    func getCompletedTasks(limit: Int = 5) -> [TasksData.LLMTask] {
        Array(readTasks().tasks.filter { !$0.isActive }.sorted { $0.completedAt ?? "" > $1.completedAt ?? "" }.prefix(limit))
    }
    
    // MARK: - Widget Stats
    
    struct WidgetStats {
        let llmCount: Int
        let maxLLMs: Int
        let activeSessionCount: Int
        let activeTasks: [TasksData.LLMTask]
        let recentCompletions: [TasksData.LLMTask]
        let sessions: [String: OrchestrationData.Session]
        
        // Metrics
        let issues24hCreated: Int
        let issues24hClosed: Int
        let issues30dCreated: Int
        let issues30dClosed: Int
        let projects24hCreated: Int
        let projects24hClosed: Int
        let projects30dCreated: Int
        let projects30dClosed: Int
    }
    
    func getWidgetStats() -> WidgetStats {
        let orch = readOrchestration()
        let tasks = readTasks()
        
        return WidgetStats(
            llmCount: orch.llmCount,
            maxLLMs: orch.maxLLMs,
            activeSessionCount: orch.activeSessions.count,
            activeTasks: tasks.tasks.filter { $0.isActive },
            recentCompletions: Array(tasks.tasks.filter { !$0.isActive }.prefix(5)),
            sessions: orch.activeSessions,
            issues24hCreated: orch.issues24hCreated ?? 0,
            issues24hClosed: orch.issues24hClosed ?? 0,
            issues30dCreated: orch.issues30dCreated ?? 0,
            issues30dClosed: orch.issues30dClosed ?? 0,
            projects24hCreated: orch.projects24hCreated ?? 0,
            projects24hClosed: orch.projects24hClosed ?? 0,
            projects30dCreated: orch.projects30dCreated ?? 0,
            projects30dClosed: orch.projects30dClosed ?? 0
        )
    }
}

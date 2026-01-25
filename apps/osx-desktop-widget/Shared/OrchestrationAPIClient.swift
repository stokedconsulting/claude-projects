import Foundation

/// API client for communicating with the api
class OrchestrationAPIClient {
    
    static let shared = OrchestrationAPIClient()
    
    private var baseURL: String {
        UserDefaults(suiteName: "group.com.claudeprojects.app")?.string(forKey: "apiBaseUrl") ?? "http://localhost:3000"
    }
    
    private var apiKey: String {
        UserDefaults(suiteName: "group.com.claudeprojects.app")?.string(forKey: "apiKey") ?? ""
    }
    
    private init() {}
    
    func fetchStats() async throws -> OrchestrationStats {
        try await Task.sleep(nanoseconds: 500_000_000)
        var stats = OrchestrationStats.mock
        stats.tickets24hCreated = Int.random(in: 8...15)
        stats.tickets24hClosed = Int.random(in: 5...12)
        return stats
    }
    
    func fetchRecentCompletions(limit: Int = 5) async throws -> [Completion] {
        try await Task.sleep(nanoseconds: 300_000_000)
        return Array(Completion.mockList.prefix(limit))
    }
    
    func updateConcurrencyLimit(_ limit: Int) async throws {
        guard limit >= 0 && limit <= 20 else {
            throw APIError.invalidParameter("Concurrency limit must be between 0 and 20")
        }
        try await Task.sleep(nanoseconds: 200_000_000)
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case invalidParameter(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid API URL"
        case .invalidResponse: return "Invalid response from server"
        case .httpError(let code): return "HTTP error: \(code)"
        case .invalidParameter(let msg): return msg
        }
    }
}

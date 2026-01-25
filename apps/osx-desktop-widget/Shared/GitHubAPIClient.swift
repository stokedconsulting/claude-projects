import Foundation

/// GitHub API client for fetching data
class GitHubAPIClient: ObservableObject {
    static let shared = GitHubAPIClient()
    
    private var token: String? {
        GitHubAuthManager.shared.getTokenFromKeychain()
    }
    
    private func makeRequest(url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200..<300 ~= httpResponse.statusCode else {
            throw APIError.requestFailed
        }
        
        return data
    }
    
    enum APIError: Error {
        case requestFailed
        case noToken
    }
    
    // MARK: - Organizations
    
    func fetchOrganizations() async throws -> [GHOrganization] {
        guard let url = URL(string: "https://api.github.com/user/orgs") else {
            throw APIError.requestFailed
        }
        
        var request = URLRequest(url: url)
        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("GitHub orgs API status: \(httpResponse.statusCode)")
            if httpResponse.statusCode != 200 {
                if let json = String(data: data, encoding: .utf8) {
                    print("GitHub orgs API response: \(json)")
                }
                throw APIError.requestFailed
            }
        }
        
        let orgs = try JSONDecoder().decode([GHOrganization].self, from: data)
        print("Fetched \(orgs.count) organizations: \(orgs.map { $0.login })")
        return orgs
    }
    
    // MARK: - Repositories
    
    func fetchUserRepositories() async throws -> [GHRepository] {
        guard let url = URL(string: "https://api.github.com/user/repos?per_page=100&sort=updated") else {
            throw APIError.requestFailed
        }
        
        let data = try await makeRequest(url: url)
        return try JSONDecoder().decode([GHRepository].self, from: data)
    }
    
    func fetchOrgRepositories(org: String) async throws -> [GHRepository] {
        guard let url = URL(string: "https://api.github.com/orgs/\(org)/repos?per_page=100&sort=updated") else {
            throw APIError.requestFailed
        }
        
        let data = try await makeRequest(url: url)
        return try JSONDecoder().decode([GHRepository].self, from: data)
    }
    
    // MARK: - Issues & PRs
    
    func fetchIssues(repo: String, state: String = "all", since: Date? = nil) async throws -> [GHIssue] {
        var urlString = "https://api.github.com/repos/\(repo)/issues?state=\(state)&per_page=100"
        
        if let since = since {
            let formatter = ISO8601DateFormatter()
            urlString += "&since=\(formatter.string(from: since))"
        }
        
        guard let url = URL(string: urlString) else {
            throw APIError.requestFailed
        }
        
        let data = try await makeRequest(url: url)
        return try JSONDecoder().decode([GHIssue].self, from: data)
    }
    
    func fetchPullRequests(repo: String, state: String = "all") async throws -> [GHPR] {
        guard let url = URL(string: "https://api.github.com/repos/\(repo)/pulls?state=\(state)&per_page=100") else {
            throw APIError.requestFailed
        }
        
        let data = try await makeRequest(url: url)
        return try JSONDecoder().decode([GHPR].self, from: data)
    }
    
    // MARK: - Aggregated Stats
    
    func fetchStats(for repos: [String]) async -> GHStats {
        var stats = GHStats()
        let now = Date()
        let oneDayAgo = Calendar.current.date(byAdding: .day, value: -1, to: now)!
        let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: now)!
        
        for repo in repos {
            do {
                let issues = try await fetchIssues(repo: repo, since: thirtyDaysAgo)
                
                for issue in issues {
                    guard issue.pull_request == nil else { continue } // Skip PRs
                    
                    let createdAt = ISO8601DateFormatter().date(from: issue.created_at) ?? now
                    let closedAt = issue.closed_at.flatMap { ISO8601DateFormatter().date(from: $0) }
                    
                    // 24h stats
                    if createdAt >= oneDayAgo {
                        stats.issues24hCreated += 1
                    }
                    if let closed = closedAt, closed >= oneDayAgo {
                        stats.issues24hClosed += 1
                    }
                    
                    // 30d stats
                    if createdAt >= thirtyDaysAgo {
                        stats.issues30dCreated += 1
                    }
                    if let closed = closedAt, closed >= thirtyDaysAgo {
                        stats.issues30dClosed += 1
                    }
                }
            } catch {
                print("Failed to fetch issues for \(repo): \(error)")
            }
        }
        
        return stats
    }
}

// MARK: - API Models (prefixed with GH to avoid conflicts)

struct GHOrganization: Codable, Hashable {
    let id: Int
    let login: String
}

struct GHRepository: Codable {
    let id: Int
    let name: String
    let full_name: String
    let description: String?
}

struct GHIssue: Codable {
    let id: Int
    let number: Int
    let title: String
    let state: String
    let created_at: String
    let closed_at: String?
    let pull_request: PRRef?
    
    struct PRRef: Codable {}
}

struct GHPR: Codable {
    let id: Int
    let number: Int
    let title: String
    let state: String
    let created_at: String
    let merged_at: String?
    let closed_at: String?
}

struct GHStats {
    var issues24hCreated = 0
    var issues24hClosed = 0
    var issues30dCreated = 0
    var issues30dClosed = 0
    var projects24hCreated = 0
    var projects24hClosed = 0
    var projects30dCreated = 0
    var projects30dClosed = 0
}

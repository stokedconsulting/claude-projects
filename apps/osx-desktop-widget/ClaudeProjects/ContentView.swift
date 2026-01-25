import SwiftUI
import AppKit

struct ContentView: View {
    @StateObject private var viewModel = HistoryViewModel()
    @StateObject private var authManager = GitHubAuthManager.shared
    @State private var showingGitHubSettings = false
    
    private let bgColor = Color(red: 0.11, green: 0.11, blue: 0.12)
    private let cardBg = Color(red: 0.15, green: 0.15, blue: 0.16)
    private let textPrimary = Color(white: 0.9)
    private let textSecondary = Color(white: 0.55)
    private let greenAccent = Color(red: 0.2, green: 0.7, blue: 0.4)
    
    var body: some View {
        NavigationSplitView {
            // Sidebar
            List {
                Section("Overview") {
                    NavigationLink {
                        dashboardView
                    } label: {
                        Label("Dashboard", systemImage: "square.grid.2x2")
                    }
                    
                    NavigationLink {
                        historyView
                    } label: {
                        Label("History", systemImage: "clock.arrow.circlepath")
                    }
                }
                
                Section("Integrations") {
                    NavigationLink {
                        GitHubSettingsView()
                    } label: {
                        HStack {
                            Label("GitHub", systemImage: "link")
                            Spacer()
                            if authManager.isAuthenticated {
                                Circle()
                                    .fill(greenAccent)
                                    .frame(width: 8, height: 8)
                            }
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .frame(minWidth: 180)
        } detail: {
            dashboardView
        }
        .background(bgColor)
        .onAppear { viewModel.loadData() }
    }
    
    // MARK: - Dashboard View
    
    private var dashboardView: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Dashboard")
                            .font(.title.weight(.semibold))
                            .foregroundColor(textPrimary)
                        Text("Monitor your LLM orchestration sessions")
                            .font(.callout)
                            .foregroundColor(textSecondary)
                    }
                    Spacer()
                    Button(action: { viewModel.refresh() }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(textSecondary)
                }
                .padding(.horizontal)
                
                // Stats Grid
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    StatCard(title: "24 hrs", value: "\(viewModel.stats.tickets24hCreated)", subtitle: "Tasks Created", color: .blue)
                    StatCard(title: "Completed", value: "\(viewModel.stats.tickets24hClosed)", subtitle: "Today", color: greenAccent)
                    StatCard(title: "Open Issues", value: "\(viewModel.stats.tickets30dCreated - viewModel.stats.tickets30dClosed)", subtitle: "Total", color: .orange)
                    StatCard(title: "LLM Slots", value: "\(viewModel.stats.concurrentLLMs)/\(viewModel.stats.maxConcurrentLLMs)", subtitle: "In Use", color: .purple)
                }
                .padding(.horizontal)
                
                // GitHub Integration Status
                if authManager.isAuthenticated {
                    gitHubStatusCard
                } else {
                    gitHubConnectCard
                }
                
                // Recent Repositories (if connected to GitHub)
                if authManager.isAuthenticated {
                    recentReposCard
                }
                
                // Recent Activity
                VStack(alignment: .leading, spacing: 12) {
                    Text("Recent Activity")
                        .font(.headline)
                        .foregroundColor(textPrimary)
                    
                    ForEach(viewModel.completions.prefix(5)) { completion in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(greenAccent)
                                .frame(width: 6, height: 6)
                            Text(completion.title)
                                .font(.callout)
                                .foregroundColor(textPrimary)
                                .lineLimit(1)
                            Spacer()
                            Text(completion.timeAgo)
                                .font(.caption)
                                .foregroundColor(textSecondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 12).fill(cardBg))
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(bgColor)
    }
    
    private var gitHubStatusCard: some View {
        HStack {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(greenAccent)
            VStack(alignment: .leading) {
                Text("GitHub Connected")
                    .font(.callout.weight(.medium))
                    .foregroundColor(textPrimary)
                Text("@\(authManager.currentUser?.login ?? "unknown")")
                    .font(.caption)
                    .foregroundColor(textSecondary)
            }
            Spacer()
            NavigationLink {
                GitHubSettingsView()
            } label: {
                Text("Settings")
                    .font(.caption)
                    .foregroundColor(greenAccent)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(cardBg))
        .padding(.horizontal)
    }
    
    private var gitHubConnectCard: some View {
        NavigationLink {
            GitHubSettingsView()
        } label: {
            HStack {
                Image(systemName: "link.badge.plus")
                    .foregroundColor(textSecondary)
                VStack(alignment: .leading) {
                    Text("Connect GitHub")
                        .font(.callout.weight(.medium))
                        .foregroundColor(textPrimary)
                    Text("Pull issues and PRs from your repos")
                        .font(.caption)
                        .foregroundColor(textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(textSecondary)
            }
            .padding()
            .background(RoundedRectangle(cornerRadius: 12).fill(cardBg))
            .padding(.horizontal)
        }
        .buttonStyle(.plain)
    }
    
    private var recentReposCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Tracked Repositories")
                    .font(.headline)
                    .foregroundColor(textPrimary)
                Spacer()
                NavigationLink {
                    GitHubSettingsView()
                } label: {
                    Text("Edit")
                        .font(.caption)
                        .foregroundColor(greenAccent)
                }
                .buttonStyle(.plain)
            }
            
            if let selection = RepoSelection.load(), !selection.repositories.isEmpty {
                ForEach(selection.repositories.prefix(8), id: \.self) { repoFullName in
                    Button {
                        if let url = URL(string: "https://github.com/\(repoFullName)") {
                            NSWorkspace.shared.open(url)
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "folder.fill")
                                .foregroundColor(textSecondary)
                                .font(.caption)
                            
                            Text(repoFullName)
                                .font(.callout)
                                .foregroundColor(textPrimary)
                                .lineLimit(1)
                            
                            Spacer()
                            
                            Image(systemName: "arrow.up.right")
                                .foregroundColor(textSecondary)
                                .font(.caption2)
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Text("No repositories selected")
                    .font(.callout)
                    .foregroundColor(textSecondary)
                NavigationLink {
                    GitHubSettingsView()
                } label: {
                    Text("Select repositories →")
                        .font(.caption)
                        .foregroundColor(greenAccent)
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(cardBg))
        .padding(.horizontal)
    }
    
    // MARK: - History View
    
    private var historyView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(viewModel.completions) { completion in
                    CompletionRow(completion: completion)
                }
            }
            .padding()
        }
        .background(bgColor)
        .navigationTitle("History")
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    
    private let cardBg = Color(red: 0.15, green: 0.15, blue: 0.16)
    private let textPrimary = Color(white: 0.9)
    private let textSecondary = Color(white: 0.5)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundColor(textSecondary)
            Text(value)
                .font(.title.weight(.semibold))
                .foregroundColor(color)
            Text(subtitle)
                .font(.caption2)
                .foregroundColor(textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RoundedRectangle(cornerRadius: 12).fill(cardBg))
    }
}

struct CompletionRow: View {
    let completion: Completion
    
    private let cardBg = Color(red: 0.15, green: 0.15, blue: 0.16)
    private let textPrimary = Color(white: 0.9)
    private let textSecondary = Color(white: 0.5)
    private let greenAccent = Color(red: 0.2, green: 0.7, blue: 0.4)
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(greenAccent)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(completion.title)
                    .font(.body.weight(.medium))
                    .foregroundColor(textPrimary)
                    .lineLimit(1)
                
                Text(completion.project)
                    .font(.caption)
                    .foregroundColor(textSecondary)
            }
            
            Spacer()
            
            Text(completion.timeAgo)
                .font(.caption)
                .foregroundColor(textSecondary)
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 10).fill(cardBg))
    }
}

// MARK: - View Model

@MainActor
class HistoryViewModel: ObservableObject {
    @Published var stats = OrchestrationStats.mock
    @Published var completions: [Completion] = Completion.mockList
    
    func loadData() {
        // TODO: Load from API
    }
    
    func refresh() {
        // TODO: Refresh from API
    }
}

#Preview {
    ContentView()
        .frame(width: 800, height: 600)
}

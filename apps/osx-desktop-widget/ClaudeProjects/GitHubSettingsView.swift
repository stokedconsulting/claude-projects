import SwiftUI
import AppKit

struct GitHubSettingsView: View {
    @StateObject private var authManager = GitHubAuthManager.shared
    @StateObject private var apiClient = GitHubAPIClient.shared
    
    @State private var organizations: [GHOrganization] = []
    @State private var selectedOrgs: Set<Int> = [] // Multi-select org IDs
    @State private var includePersonal = true
    @State private var repositories: [GHRepository] = []
    @State private var selectedRepos: Set<String> = []
    @State private var isLoadingOrgs = false
    @State private var isLoadingRepos = false
    @State private var errorMessage: String?
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                Text("GitHub Integration")
                    .font(.title2.bold())
                    .foregroundColor(.primary)
                
                // Authentication Section
                GroupBox {
                    VStack(alignment: .leading, spacing: 16) {
                        if authManager.isAuthenticated {
                            connectedUserView
                        } else if authManager.isAuthenticating {
                            deviceFlowView
                        } else {
                            signInView
                        }
                    }
                    .padding(.vertical, 8)
                } label: {
                    Label("Authentication", systemImage: "person.badge.key")
                }
                
                if authManager.isAuthenticated {
                    // Organizations Multi-Select
                    GroupBox {
                        VStack(alignment: .leading, spacing: 12) {
                            if isLoadingOrgs {
                                ProgressView("Loading organizations...")
                            } else if let error = errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundColor(.red)
                                Button("Retry") {
                                    Task { await loadOrganizations() }
                                }
                                .buttonStyle(.bordered)
                            } else {
                                Text("Select sources to track:")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                // Personal repos toggle
                                Toggle(isOn: $includePersonal) {
                                    HStack {
                                        Image(systemName: "person.fill")
                                            .foregroundColor(.blue)
                                        Text("Personal Repositories")
                                    }
                                }
                                .toggleStyle(.checkbox)
                                .onChange(of: includePersonal) { _ in
                                    Task { await loadRepositories() }
                                }
                                
                                Divider()
                                
                                // Organizations list
                                if organizations.isEmpty {
                                    Text("No organizations found")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                } else {
                                    ForEach(organizations, id: \.id) { org in
                                        Toggle(isOn: Binding(
                                            get: { selectedOrgs.contains(org.id) },
                                            set: { isSelected in
                                                if isSelected {
                                                    selectedOrgs.insert(org.id)
                                                } else {
                                                    selectedOrgs.remove(org.id)
                                                }
                                                Task { await loadRepositories() }
                                            }
                                        )) {
                                            HStack {
                                                Image(systemName: "building.2.fill")
                                                    .foregroundColor(.orange)
                                                Text(org.login)
                                            }
                                        }
                                        .toggleStyle(.checkbox)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    } label: {
                        Label("Organizations", systemImage: "building.2")
                    }
                    
                    // Repository Selection
                    GroupBox {
                        VStack(alignment: .leading, spacing: 12) {
                            if isLoadingRepos {
                                ProgressView("Loading repositories...")
                            } else if repositories.isEmpty {
                                Text("Select organizations above to load repositories")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            } else {
                                HStack {
                                    Text("\(repositories.count) repositories found")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Button("Select All") {
                                        selectedRepos = Set(repositories.map { $0.full_name })
                                    }
                                    .buttonStyle(.borderless)
                                    Button("Clear") {
                                        selectedRepos.removeAll()
                                    }
                                    .buttonStyle(.borderless)
                                }
                                
                                Divider()
                                
                                LazyVStack(alignment: .leading, spacing: 8) {
                                    ForEach(repositories.prefix(50), id: \.id) { repo in
                                        HStack {
                                            Toggle(isOn: Binding(
                                                get: { selectedRepos.contains(repo.full_name) },
                                                set: { isSelected in
                                                    if isSelected {
                                                        selectedRepos.insert(repo.full_name)
                                                    } else {
                                                        selectedRepos.remove(repo.full_name)
                                                    }
                                                }
                                            )) {
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(repo.name)
                                                        .font(.body)
                                                    if let description = repo.description {
                                                        Text(description)
                                                            .font(.caption)
                                                            .foregroundColor(.secondary)
                                                            .lineLimit(1)
                                                    }
                                                }
                                            }
                                            .toggleStyle(.checkbox)
                                            
                                            Spacer()
                                            
                                            Button {
                                                if let url = URL(string: "https://github.com/\(repo.full_name)") {
                                                    NSWorkspace.shared.open(url)
                                                }
                                            } label: {
                                                Image(systemName: "arrow.up.right.square")
                                                    .foregroundColor(.secondary)
                                            }
                                            .buttonStyle(.borderless)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    } label: {
                        Label("Repositories (\(selectedRepos.count) selected)", systemImage: "folder")
                    }
                    
                    // Save Button
                    HStack {
                        Spacer()
                        Button("Save Selection") {
                            saveSelection()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(selectedRepos.isEmpty)
                    }
                }
                
                Spacer()
            }
            .padding()
        }
        .onAppear {
            if authManager.isAuthenticated {
                loadSavedSelection()
                Task {
                    await loadOrganizations()
                    await loadRepositories()
                }
            }
        }
    }
    
    // MARK: - View Components
    
    private var signInView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sign in to GitHub to track issues and projects from your repositories.")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            if let error = authManager.authError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }
            
            Button {
                Task {
                    await authManager.startDeviceFlow()
                }
            } label: {
                HStack {
                    Image(systemName: "arrow.up.forward.app")
                    Text("Sign in with GitHub")
                }
            }
            .buttonStyle(.borderedProminent)
        }
    }
    
    private var deviceFlowView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                ProgressView()
                    .scaleEffect(0.8)
                Text("Waiting for authorization...")
                    .foregroundColor(.secondary)
            }
            
            if let deviceCode = authManager.deviceCode {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Enter this code on GitHub:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    HStack {
                        Text(deviceCode.user_code)
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundColor(.primary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.1)))
                        
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(deviceCode.user_code, forType: .string)
                        } label: {
                            Image(systemName: "doc.on.doc")
                        }
                        .buttonStyle(.borderless)
                    }
                    
                    Button("Open GitHub") {
                        if let url = URL(string: deviceCode.verification_uri) {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.link)
                }
            }
            
            Button("Cancel") {
                authManager.cancelAuth()
            }
            .buttonStyle(.bordered)
        }
    }
    
    private var connectedUserView: some View {
        HStack(spacing: 12) {
            if let avatarUrl = authManager.currentUser?.avatar_url,
               let url = URL(string: avatarUrl) {
                AsyncImage(url: url) { image in
                    image.resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle().fill(Color.secondary.opacity(0.3))
                }
                .frame(width: 48, height: 48)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.secondary.opacity(0.3))
                    .frame(width: 48, height: 48)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                if let user = authManager.currentUser {
                    Text(user.name ?? user.login)
                        .font(.headline)
                    Text("@\(user.login)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Button("Sign Out") {
                authManager.signOut()
                organizations = []
                repositories = []
                selectedRepos = []
                selectedOrgs = []
            }
            .buttonStyle(.bordered)
        }
    }
    
    // MARK: - Data Loading
    
    private func loadOrganizations() async {
        await MainActor.run { isLoadingOrgs = true; errorMessage = nil }
        defer { Task { @MainActor in isLoadingOrgs = false } }
        
        do {
            let orgs = try await apiClient.fetchOrganizations()
            await MainActor.run { organizations = orgs }
        } catch {
            await MainActor.run { errorMessage = "Failed to load organizations: \(error.localizedDescription)" }
        }
    }
    
    private func loadRepositories() async {
        await MainActor.run { isLoadingRepos = true }
        defer { Task { @MainActor in isLoadingRepos = false } }
        
        var allRepos: [GHRepository] = []
        
        // Fetch personal repos if selected
        if includePersonal {
            do {
                let repos = try await apiClient.fetchUserRepositories()
                allRepos.append(contentsOf: repos)
            } catch {
                print("Failed to load personal repos: \(error)")
            }
        }
        
        // Fetch repos from selected orgs
        for org in organizations where selectedOrgs.contains(org.id) {
            do {
                let repos = try await apiClient.fetchOrgRepositories(org: org.login)
                allRepos.append(contentsOf: repos)
            } catch {
                print("Failed to load repos for \(org.login): \(error)")
            }
        }
        
        await MainActor.run {
            repositories = allRepos.sorted { $0.name.lowercased() < $1.name.lowercased() }
        }
    }
    
    private func saveSelection() {
        let orgLogins = organizations.filter { selectedOrgs.contains($0.id) }.map { $0.login }
        let selection = RepoSelection(
            organizations: orgLogins,
            includePersonal: includePersonal,
            repositories: Array(selectedRepos)
        )
        RepoSelection.save(selection)
    }
    
    private func loadSavedSelection() {
        if let selection = RepoSelection.load() {
            includePersonal = selection.includePersonal
            selectedRepos = Set(selection.repositories)
            // Org IDs will be matched after orgs are loaded
        }
    }
}

struct RepoSelection: Codable {
    let organizations: [String]
    let includePersonal: Bool
    let repositories: [String]
    
    static func save(_ selection: RepoSelection) {
        if let data = try? JSONEncoder().encode(selection) {
            UserDefaults(suiteName: "group.com.claudeprojects.app")?.set(data, forKey: "repoSelection")
        }
    }
    
    static func load() -> RepoSelection? {
        guard let data = UserDefaults(suiteName: "group.com.claudeprojects.app")?.data(forKey: "repoSelection"),
              let selection = try? JSONDecoder().decode(RepoSelection.self, from: data) else {
            return nil
        }
        return selection
    }
}

import Foundation
import Security
import AppKit

/// GitHub authentication manager using Device Flow (browser-based OAuth)
class GitHubAuthManager: ObservableObject {
    static let shared = GitHubAuthManager()
    
    // GitHub OAuth App Client ID - Using GitHub CLI's public client ID for device flow
    // This is the same approach used by gh CLI
    private let clientId = "Iv1.b507a08c87ecfe98" // GitHub CLI's client ID (public)
    private let scope = "repo,read:org,read:user"
    
    @Published var isAuthenticated = false
    @Published var currentUser: GitHubUser?
    @Published var isAuthenticating = false
    @Published var deviceCode: DeviceCodeResponse?
    @Published var authError: String?
    
    private let keychainService = "com.claudeprojects.github"
    private let keychainAccount = "access_token"
    private var pollingTimer: Timer?
    
    struct DeviceCodeResponse: Codable {
        let device_code: String
        let user_code: String
        let verification_uri: String
        let expires_in: Int
        let interval: Int
    }
    
    struct TokenResponse: Codable {
        let access_token: String?
        let token_type: String?
        let scope: String?
        let error: String?
        let error_description: String?
    }
    
    struct GitHubUser: Codable {
        let login: String
        let name: String?
        let avatar_url: String?
        let email: String?
    }
    
    init() {
        loadStoredToken()
    }
    
    // MARK: - Device Flow Authentication
    
    /// Start the device flow authentication
    func startDeviceFlow() async {
        await MainActor.run {
            isAuthenticating = true
            authError = nil
        }
        
        // Step 1: Request device and user codes
        guard let url = URL(string: "https://github.com/login/device/code") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        let body = "client_id=\(clientId)&scope=\(scope)"
        request.httpBody = body.data(using: .utf8)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(DeviceCodeResponse.self, from: data)
            
            await MainActor.run {
                self.deviceCode = response
            }
            
            // Open browser for user to enter code
            if let verifyUrl = URL(string: response.verification_uri) {
                await MainActor.run {
                    NSWorkspace.shared.open(verifyUrl)
                }
            }
            
            // Start polling for authorization
            await pollForToken(deviceCode: response.device_code, interval: response.interval)
            
        } catch {
            await MainActor.run {
                self.authError = "Failed to start authentication: \(error.localizedDescription)"
                self.isAuthenticating = false
            }
        }
    }
    
    /// Poll GitHub for the access token
    private func pollForToken(deviceCode: String, interval: Int) async {
        let pollInterval = max(interval, 5) // Minimum 5 seconds as per GitHub docs
        
        for _ in 0..<60 { // Poll for up to 5 minutes
            try? await Task.sleep(nanoseconds: UInt64(pollInterval) * 1_000_000_000)
            
            guard let url = URL(string: "https://github.com/login/oauth/access_token") else { continue }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            
            let body = "client_id=\(clientId)&device_code=\(deviceCode)&grant_type=urn:ietf:params:oauth:grant-type:device_code"
            request.httpBody = body.data(using: .utf8)
            
            do {
                let (data, _) = try await URLSession.shared.data(for: request)
                let response = try JSONDecoder().decode(TokenResponse.self, from: data)
                
                if let token = response.access_token {
                    // Success! Save token and fetch user
                    saveToken(token)
                    await fetchCurrentUser()
                    
                    await MainActor.run {
                        self.isAuthenticated = true
                        self.isAuthenticating = false
                        self.deviceCode = nil
                    }
                    return
                    
                } else if let error = response.error {
                    if error == "authorization_pending" {
                        // User hasn't completed auth yet, keep polling
                        continue
                    } else if error == "slow_down" {
                        // Need to slow down polling
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        continue
                    } else if error == "expired_token" {
                        await MainActor.run {
                            self.authError = "Authentication expired. Please try again."
                            self.isAuthenticating = false
                            self.deviceCode = nil
                        }
                        return
                    } else if error == "access_denied" {
                        await MainActor.run {
                            self.authError = "Access denied. Please try again."
                            self.isAuthenticating = false
                            self.deviceCode = nil
                        }
                        return
                    }
                }
            } catch {
                // Network error, keep trying
                continue
            }
        }
        
        // Timeout
        await MainActor.run {
            self.authError = "Authentication timed out. Please try again."
            self.isAuthenticating = false
            self.deviceCode = nil
        }
    }
    
    /// Cancel the ongoing authentication
    func cancelAuth() {
        isAuthenticating = false
        deviceCode = nil
        authError = nil
    }
    
    // MARK: - Token Management
    
    private func loadStoredToken() {
        if let token = getTokenFromKeychain() {
            Task {
                await fetchCurrentUser()
                await MainActor.run {
                    self.isAuthenticated = self.currentUser != nil
                }
            }
        }
    }
    
    func signOut() {
        deleteTokenFromKeychain()
        isAuthenticated = false
        currentUser = nil
        deviceCode = nil
    }
    
    private func saveToken(_ token: String) {
        let data = token.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
        ]
        
        SecItemDelete(query as CFDictionary)
        
        var newItem = query
        newItem[kSecValueData as String] = data
        
        SecItemAdd(newItem as CFDictionary, nil)
    }
    
    func getTokenFromKeychain() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    private func deleteTokenFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
        ]
        SecItemDelete(query as CFDictionary)
    }
    
    // MARK: - User Info
    
    func fetchCurrentUser() async {
        guard let token = getTokenFromKeychain(),
              let url = URL(string: "https://api.github.com/user") else { return }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let user = try JSONDecoder().decode(GitHubUser.self, from: data)
            
            await MainActor.run {
                self.currentUser = user
            }
        } catch {
            print("Failed to fetch user: \(error)")
        }
    }
}

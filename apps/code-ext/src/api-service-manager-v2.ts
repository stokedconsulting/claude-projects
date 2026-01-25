import * as vscode from 'vscode';
import * as path from 'path';
import { ApiKeyManager } from './api-key-manager';
import { createServiceInstaller, ServiceConfig } from './service-installers';
import { detectPlatform, getServicePaths } from './platform-utils';

/**
 * Manages the Claude Projects API service installation and lifecycle
 *
 * This manager handles:
 * - Cross-platform service installation (macOS, Linux, Windows)
 * - Automatic API key generation and configuration
 * - Service health monitoring
 * - Configuration updates and service restarts
 */
export class ApiServiceManager {
    private readonly serviceName = 'claude-projects-api';
    private readonly serviceDisplayName = 'Claude Projects API';
    private readonly serviceDescription = 'State tracking and notification API for Claude Projects VSCode extension';

    private apiKeyManager: ApiKeyManager;
    private platformInfo = detectPlatform();
    private servicePaths = getServicePaths(this.serviceName);

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        this.apiKeyManager = new ApiKeyManager(context);
    }

    /**
     * Initialize service - ensures it's installed and running
     */
    async initialize(): Promise<boolean> {
        try {
            this.log('Initializing Claude Projects API service...');
            this.log(`Platform: ${this.platformInfo.platform}`);

            // Check if platform is supported
            if (!this.platformInfo.isSupported) {
                this.logError(`Unsupported platform: ${this.platformInfo.platform}`);
                vscode.window.showErrorMessage(
                    `Claude Projects: Platform ${this.platformInfo.platform} is not currently supported for service installation.`
                );
                return false;
            }

            // Generate or get API key
            const apiKey = await this.apiKeyManager.getOrGenerateApiKey();
            this.log('API key configured');

            // Get configuration
            const config = await this.getServiceConfig(apiKey);

            // Create service installer for platform
            const installer = createServiceInstaller(config, this.outputChannel);

            // Check if service is installed
            const installed = await installer.isInstalled();

            if (!installed) {
                this.log('Service not installed, installing...');
                const installSuccess = await installer.install();
                if (!installSuccess) {
                    this.logError('Failed to install service');
                    return false;
                }
            } else {
                this.log('Service already installed');
            }

            // Check if service is running
            const running = await installer.isRunning();

            if (!running) {
                // Check if auto-start is enabled
                const autoStart = vscode.workspace.getConfiguration('claudeProjects.service').get<boolean>('autoStart', true);
                if (autoStart) {
                    this.log('Auto-start enabled, starting service...');
                    const startSuccess = await installer.start();
                    if (!startSuccess) {
                        this.logError('Failed to start service');
                        return false;
                    }
                } else {
                    this.log('Auto-start disabled, service not started');
                    return false;
                }
            } else {
                this.log('Service is running');

                // Check if service is responding
                const status = await installer.getStatus();
                if (!status.responding) {
                    this.log('Service not responding, restarting...');
                    await installer.restart();
                }
            }

            this.log('Service initialization complete');
            return true;
        } catch (error) {
            this.logError('Failed to initialize service', error);
            return false;
        }
    }

    /**
     * Stop the service
     */
    async stop(): Promise<boolean> {
        try {
            const apiKey = this.apiKeyManager.getCurrentApiKey();
            if (!apiKey) {
                this.logError('No API key found');
                return false;
            }

            const config = await this.getServiceConfig(apiKey);
            const installer = createServiceInstaller(config, this.outputChannel);

            return await installer.stop();
        } catch (error) {
            this.logError('Failed to stop service', error);
            return false;
        }
    }

    /**
     * Restart the service
     */
    async restart(): Promise<boolean> {
        try {
            const apiKey = this.apiKeyManager.getCurrentApiKey();
            if (!apiKey) {
                this.logError('No API key found');
                return false;
            }

            const config = await this.getServiceConfig(apiKey);
            const installer = createServiceInstaller(config, this.outputChannel);

            return await installer.restart();
        } catch (error) {
            this.logError('Failed to restart service', error);
            return false;
        }
    }

    /**
     * Uninstall the service
     */
    async uninstall(): Promise<boolean> {
        try {
            const apiKey = this.apiKeyManager.getCurrentApiKey();
            if (!apiKey) {
                this.logError('No API key found');
                return false;
            }

            const config = await this.getServiceConfig(apiKey);
            const installer = createServiceInstaller(config, this.outputChannel);

            return await installer.uninstall();
        } catch (error) {
            this.logError('Failed to uninstall service', error);
            return false;
        }
    }

    /**
     * Get service status
     */
    async getStatus(): Promise<{
        installed: boolean;
        running: boolean;
        responding: boolean;
        port: number;
        apiKey: string | undefined;
    }> {
        try {
            const apiKey = this.apiKeyManager.getCurrentApiKey();
            const config = await this.getServiceConfig(apiKey || 'none');
            const installer = createServiceInstaller(config, this.outputChannel);

            const status = await installer.getStatus();

            return {
                ...status,
                port: config.port,
                apiKey: apiKey
            };
        } catch (error) {
            this.logError('Failed to get service status', error);
            return {
                installed: false,
                running: false,
                responding: false,
                port: 8167,
                apiKey: undefined
            };
        }
    }

    /**
     * Get API base URL
     */
    getApiUrl(): string {
        const port = vscode.workspace.getConfiguration('claudeProjects.service').get<number>('port', 8167);
        return `http://localhost:${port}`;
    }

    /**
     * Get current API key
     */
    getCurrentApiKey(): string | undefined {
        return this.apiKeyManager.getCurrentApiKey();
    }

    /**
     * Build service configuration from extension settings
     */
    private async getServiceConfig(apiKey: string): Promise<ServiceConfig> {
        // Get port from settings
        const port = vscode.workspace.getConfiguration('claudeProjects.service').get<number>('port', 8167);

        // Get MongoDB configuration
        const mongodbUri = this.buildMongoDbUri();

        // Find node executable
        const nodeExecutable = await this.findNodeExecutable();

        // Get API main script path from bundled extension
        // The API will be bundled into the extension's dist folder
        const apiMainScript = path.join(this.context.extensionPath, 'dist', 'api', 'main.js');
        const apiWorkingDirectory = path.join(this.context.extensionPath, 'dist', 'api');

        return {
            serviceName: this.serviceName,
            displayName: this.serviceDisplayName,
            description: this.serviceDescription,
            port,
            nodeExecutable,
            apiMainScript,
            apiWorkingDirectory,
            mongodbUri,
            apiKey,
            logDirectory: this.servicePaths.logPath
        };
    }

    /**
     * Build MongoDB URI from configuration
     */
    private buildMongoDbUri(): string {
        const mongoConfig = vscode.workspace.getConfiguration('claudeProjects.mongodb');
        const mode = mongoConfig.get<string>('mode', 'local');

        switch (mode) {
            case 'local':
                return 'mongodb://localhost:27017/claude-projects';

            case 'atlas': {
                const username = mongoConfig.get<string>('atlas.username', '');
                const password = mongoConfig.get<string>('atlas.password', '');
                const cluster = mongoConfig.get<string>('atlas.cluster', '');

                if (username && password && cluster) {
                    return `mongodb+srv://${username}:${encodeURIComponent(password)}@${cluster}.mongodb.net/claude-projects?retryWrites=true&w=majority`;
                } else {
                    this.log('WARNING: Atlas mode selected but credentials not configured, falling back to local');
                    return 'mongodb://localhost:27017/claude-projects';
                }
            }

            case 'custom':
                return mongoConfig.get<string>('customUri', 'mongodb://localhost:27017/claude-projects');

            default:
                return 'mongodb://localhost:27017/claude-projects';
        }
    }

    /**
     * Find node executable path
     */
    private async findNodeExecutable(): Promise<string> {
        const { execAsync } = require('./service-installers/base-service-installer');

        try {
            if (this.platformInfo.platform === 'win32') {
                const { stdout } = await execAsync('where node');
                return stdout.split('\n')[0].trim();
            } else {
                const { stdout } = await execAsync('which node');
                return stdout.trim();
            }
        } catch (error) {
            this.logError('Failed to find node executable, using default "node"', error);
            return 'node';
        }
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[API Service] ${message}`);
    }

    private logError(message: string, error?: any): void {
        this.outputChannel.appendLine(`[API Service] ERROR: ${message}`);
        if (error) {
            this.outputChannel.appendLine(`[API Service] ${error}`);
        }
    }
}

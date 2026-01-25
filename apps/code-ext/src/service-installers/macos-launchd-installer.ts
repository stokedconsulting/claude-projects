import * as fs from 'fs';
import * as path from 'path';
import { BaseServiceInstaller, ServiceConfig, execAsync } from './base-service-installer';
import * as vscode from 'vscode';

/**
 * macOS launchd service installer
 */
export class MacOSLaunchdInstaller extends BaseServiceInstaller {
    private get plistPath(): string {
        const homeDir = require('os').homedir();
        return path.join(homeDir, 'Library', 'LaunchAgents', `${this.config.serviceName}.plist`);
    }

    async isInstalled(): Promise<boolean> {
        return fs.existsSync(this.plistPath);
    }

    async install(): Promise<boolean> {
        try {
            const homeDir = require('os').homedir();
            const launchAgentsDir = path.join(homeDir, 'Library', 'LaunchAgents');

            // Create directories if needed
            if (!fs.existsSync(launchAgentsDir)) {
                fs.mkdirSync(launchAgentsDir, { recursive: true });
            }
            if (!fs.existsSync(this.config.logDirectory)) {
                fs.mkdirSync(this.config.logDirectory, { recursive: true });
            }

            // Create plist content
            const plistContent = this.generatePlist();
            fs.writeFileSync(this.plistPath, plistContent);

            this.log(`Service installed at ${this.plistPath}`);
            return true;
        } catch (error) {
            this.logError('Failed to install service', error);
            return false;
        }
    }

    async uninstall(): Promise<boolean> {
        try {
            // Stop service first if running
            await this.stop();

            // Remove plist file
            if (fs.existsSync(this.plistPath)) {
                fs.unlinkSync(this.plistPath);
                this.log('Service uninstalled');
            }

            return true;
        } catch (error) {
            this.logError('Failed to uninstall service', error);
            return false;
        }
    }

    async isRunning(): Promise<boolean> {
        try {
            const { stdout } = await execAsync(`launchctl list | grep ${this.config.serviceName}`);
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    async start(): Promise<boolean> {
        try {
            // Check if already running
            const running = await this.isRunning();
            if (running) {
                this.log('Service already running');
                return true;
            }

            this.log('Starting service...');
            await execAsync(`launchctl load "${this.plistPath}"`);

            // Wait for service to be ready
            const ready = await this.waitForService(10000);
            if (ready) {
                this.log(`Service started successfully on port ${this.config.port}`);
                return true;
            } else {
                this.logError('Service failed to start (health check timeout)');
                return false;
            }
        } catch (error) {
            this.logError('Failed to start service', error);
            return false;
        }
    }

    async stop(): Promise<boolean> {
        try {
            const running = await this.isRunning();
            if (!running) {
                this.log('Service is not running');
                return true;
            }

            this.log('Stopping service...');
            await execAsync(`launchctl unload "${this.plistPath}"`);
            this.log('Service stopped');
            return true;
        } catch (error) {
            this.logError('Failed to stop service', error);
            return false;
        }
    }

    /**
     * Generate launchd plist file content
     */
    private generatePlist(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${this.config.serviceName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${this.config.nodeExecutable}</string>
        <string>${this.config.apiMainScript}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${this.config.apiWorkingDirectory}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>${this.config.port}</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>MONGODB_URI</key>
        <string>${this.config.mongodbUri}</string>
        <key>API_KEYS</key>
        <string>${this.config.apiKey}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${this.config.logDirectory}/api.log</string>
    <key>StandardErrorPath</key>
    <string>${this.config.logDirectory}/api.error.log</string>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>`;
    }
}

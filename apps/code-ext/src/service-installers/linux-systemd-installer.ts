import * as fs from 'fs';
import * as path from 'path';
import { BaseServiceInstaller, ServiceConfig, execAsync } from './base-service-installer';
import * as vscode from 'vscode';

/**
 * Linux systemd service installer (user service)
 */
export class LinuxSystemdInstaller extends BaseServiceInstaller {
    private get serviceFilePath(): string {
        const homeDir = require('os').homedir();
        return path.join(homeDir, '.config', 'systemd', 'user', `${this.config.serviceName}.service`);
    }

    async isInstalled(): Promise<boolean> {
        return fs.existsSync(this.serviceFilePath);
    }

    async install(): Promise<boolean> {
        try {
            const homeDir = require('os').homedir();
            const systemdDir = path.join(homeDir, '.config', 'systemd', 'user');

            // Create directories if needed
            if (!fs.existsSync(systemdDir)) {
                fs.mkdirSync(systemdDir, { recursive: true });
            }
            if (!fs.existsSync(this.config.logDirectory)) {
                fs.mkdirSync(this.config.logDirectory, { recursive: true });
            }

            // Create service file content
            const serviceContent = this.generateServiceFile();
            fs.writeFileSync(this.serviceFilePath, serviceContent);

            // Reload systemd to pick up new service file
            await execAsync('systemctl --user daemon-reload');

            this.log(`Service installed at ${this.serviceFilePath}`);
            return true;
        } catch (error) {
            this.logError('Failed to install service', error);
            return false;
        }
    }

    async uninstall(): Promise<boolean> {
        try {
            // Stop and disable service first
            await this.stop();

            try {
                await execAsync(`systemctl --user disable ${this.config.serviceName}`);
            } catch {
                // Ignore error if service wasn't enabled
            }

            // Remove service file
            if (fs.existsSync(this.serviceFilePath)) {
                fs.unlinkSync(this.serviceFilePath);
                await execAsync('systemctl --user daemon-reload');
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
            const { stdout } = await execAsync(`systemctl --user is-active ${this.config.serviceName}`);
            return stdout.trim() === 'active';
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

            // Enable service to start on login
            await execAsync(`systemctl --user enable ${this.config.serviceName}`);

            // Start service now
            await execAsync(`systemctl --user start ${this.config.serviceName}`);

            // Wait for service to be ready
            const ready = await this.waitForService(10000);
            if (ready) {
                this.log(`Service started successfully on port ${this.config.port}`);
                return true;
            } else {
                this.logError('Service failed to start (health check timeout)');

                // Get service status for debugging
                try {
                    const { stdout } = await execAsync(`systemctl --user status ${this.config.serviceName}`);
                    this.log(`Service status:\n${stdout}`);
                } catch {}

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
            await execAsync(`systemctl --user stop ${this.config.serviceName}`);
            this.log('Service stopped');
            return true;
        } catch (error) {
            this.logError('Failed to stop service', error);
            return false;
        }
    }

    /**
     * Generate systemd service file content
     */
    private generateServiceFile(): string {
        const logFile = path.join(this.config.logDirectory, 'api.log');
        const errorLogFile = path.join(this.config.logDirectory, 'api.error.log');

        return `[Unit]
Description=${this.config.description}
After=network.target

[Service]
Type=simple
ExecStart=${this.config.nodeExecutable} ${this.config.apiMainScript}
WorkingDirectory=${this.config.apiWorkingDirectory}
Restart=always
RestartSec=10
Environment="PORT=${this.config.port}"
Environment="NODE_ENV=production"
Environment="MONGODB_URI=${this.config.mongodbUri}"
Environment="API_KEYS=${this.config.apiKey}"
StandardOutput=append:${logFile}
StandardError=append:${errorLogFile}

[Install]
WantedBy=default.target
`;
    }
}

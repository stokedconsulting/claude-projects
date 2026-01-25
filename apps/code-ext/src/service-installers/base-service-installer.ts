import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

/**
 * Service configuration
 */
export interface ServiceConfig {
    serviceName: string;
    displayName: string;
    description: string;
    port: number;
    nodeExecutable: string;
    apiMainScript: string;
    apiWorkingDirectory: string;
    mongodbUri: string;
    apiKey: string;
    logDirectory: string;
}

/**
 * Service status information
 */
export interface ServiceStatus {
    installed: boolean;
    running: boolean;
    responding: boolean;
}

/**
 * Base interface for platform-specific service installers
 */
export abstract class BaseServiceInstaller {
    constructor(
        protected config: ServiceConfig,
        protected outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Check if service is installed
     */
    abstract isInstalled(): Promise<boolean>;

    /**
     * Install the service
     */
    abstract install(): Promise<boolean>;

    /**
     * Uninstall the service
     */
    abstract uninstall(): Promise<boolean>;

    /**
     * Check if service is running
     */
    abstract isRunning(): Promise<boolean>;

    /**
     * Start the service
     */
    abstract start(): Promise<boolean>;

    /**
     * Stop the service
     */
    abstract stop(): Promise<boolean>;

    /**
     * Restart the service
     */
    async restart(): Promise<boolean> {
        const stopped = await this.stop();
        if (!stopped) {
            return false;
        }

        // Wait a moment before starting
        await new Promise(resolve => setTimeout(resolve, 1000));

        return await this.start();
    }

    /**
     * Get service status
     */
    async getStatus(): Promise<ServiceStatus> {
        return {
            installed: await this.isInstalled(),
            running: await this.isRunning(),
            responding: await this.isResponding()
        };
    }

    /**
     * Check if service is responding to HTTP requests
     */
    protected async isResponding(): Promise<boolean> {
        const http = require('http');

        return new Promise((resolve) => {
            const req = http.request(
                {
                    hostname: 'localhost',
                    port: this.config.port,
                    path: '/health',
                    method: 'GET',
                    timeout: 2000
                },
                (res: any) => {
                    resolve(res.statusCode === 200);
                }
            );

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    /**
     * Wait for service to become ready
     */
    protected async waitForService(timeoutMs: number): Promise<boolean> {
        const startTime = Date.now();
        const checkInterval = 500;

        while (Date.now() - startTime < timeoutMs) {
            const responding = await this.isResponding();
            if (responding) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        return false;
    }

    /**
     * Log message to output channel
     */
    protected log(message: string): void {
        this.outputChannel.appendLine(`[Service] ${message}`);
    }

    /**
     * Log error to output channel
     */
    protected logError(message: string, error?: any): void {
        this.outputChannel.appendLine(`[Service] ERROR: ${message}`);
        if (error) {
            this.outputChannel.appendLine(`[Service] ${error}`);
        }
    }
}

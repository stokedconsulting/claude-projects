"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseServiceInstaller = exports.execAsync = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
exports.execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Base interface for platform-specific service installers
 */
class BaseServiceInstaller {
    config;
    outputChannel;
    constructor(config, outputChannel) {
        this.config = config;
        this.outputChannel = outputChannel;
    }
    /**
     * Restart the service
     */
    async restart() {
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
    async getStatus() {
        return {
            installed: await this.isInstalled(),
            running: await this.isRunning(),
            responding: await this.isResponding()
        };
    }
    /**
     * Check if service is responding to HTTP requests
     */
    async isResponding() {
        const http = require('http');
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: this.config.port,
                path: '/health',
                method: 'GET',
                timeout: 2000
            }, (res) => {
                resolve(res.statusCode === 200);
            });
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
    async waitForService(timeoutMs) {
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
    log(message) {
        this.outputChannel.appendLine(`[Service] ${message}`);
    }
    /**
     * Log error to output channel
     */
    logError(message, error) {
        this.outputChannel.appendLine(`[Service] ERROR: ${message}`);
        if (error) {
            this.outputChannel.appendLine(`[Service] ${error}`);
        }
    }
}
exports.BaseServiceInstaller = BaseServiceInstaller;
//# sourceMappingURL=base-service-installer.js.map
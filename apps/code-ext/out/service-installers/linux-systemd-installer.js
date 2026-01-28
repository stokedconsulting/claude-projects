"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinuxSystemdInstaller = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const base_service_installer_1 = require("./base-service-installer");
/**
 * Linux systemd service installer (user service)
 */
class LinuxSystemdInstaller extends base_service_installer_1.BaseServiceInstaller {
    get serviceFilePath() {
        const homeDir = require('os').homedir();
        return path.join(homeDir, '.config', 'systemd', 'user', `${this.config.serviceName}.service`);
    }
    async isInstalled() {
        return fs.existsSync(this.serviceFilePath);
    }
    async install() {
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
            await (0, base_service_installer_1.execAsync)('systemctl --user daemon-reload');
            this.log(`Service installed at ${this.serviceFilePath}`);
            return true;
        }
        catch (error) {
            this.logError('Failed to install service', error);
            return false;
        }
    }
    async uninstall() {
        try {
            // Stop and disable service first
            await this.stop();
            try {
                await (0, base_service_installer_1.execAsync)(`systemctl --user disable ${this.config.serviceName}`);
            }
            catch {
                // Ignore error if service wasn't enabled
            }
            // Remove service file
            if (fs.existsSync(this.serviceFilePath)) {
                fs.unlinkSync(this.serviceFilePath);
                await (0, base_service_installer_1.execAsync)('systemctl --user daemon-reload');
                this.log('Service uninstalled');
            }
            return true;
        }
        catch (error) {
            this.logError('Failed to uninstall service', error);
            return false;
        }
    }
    async isRunning() {
        try {
            const { stdout } = await (0, base_service_installer_1.execAsync)(`systemctl --user is-active ${this.config.serviceName}`);
            return stdout.trim() === 'active';
        }
        catch {
            return false;
        }
    }
    async start() {
        try {
            // Check if already running
            const running = await this.isRunning();
            if (running) {
                this.log('Service already running');
                return true;
            }
            this.log('Starting service...');
            // Enable service to start on login
            await (0, base_service_installer_1.execAsync)(`systemctl --user enable ${this.config.serviceName}`);
            // Start service now
            await (0, base_service_installer_1.execAsync)(`systemctl --user start ${this.config.serviceName}`);
            // Wait for service to be ready
            const ready = await this.waitForService(10000);
            if (ready) {
                this.log(`Service started successfully on port ${this.config.port}`);
                return true;
            }
            else {
                this.logError('Service failed to start (health check timeout)');
                // Get service status for debugging
                try {
                    const { stdout } = await (0, base_service_installer_1.execAsync)(`systemctl --user status ${this.config.serviceName}`);
                    this.log(`Service status:\n${stdout}`);
                }
                catch { }
                return false;
            }
        }
        catch (error) {
            this.logError('Failed to start service', error);
            return false;
        }
    }
    async stop() {
        try {
            const running = await this.isRunning();
            if (!running) {
                this.log('Service is not running');
                return true;
            }
            this.log('Stopping service...');
            await (0, base_service_installer_1.execAsync)(`systemctl --user stop ${this.config.serviceName}`);
            this.log('Service stopped');
            return true;
        }
        catch (error) {
            this.logError('Failed to stop service', error);
            return false;
        }
    }
    /**
     * Generate systemd service file content
     */
    generateServiceFile() {
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
exports.LinuxSystemdInstaller = LinuxSystemdInstaller;
//# sourceMappingURL=linux-systemd-installer.js.map
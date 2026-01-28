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
exports.MacOSLaunchdInstaller = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const base_service_installer_1 = require("./base-service-installer");
/**
 * macOS launchd service installer
 */
class MacOSLaunchdInstaller extends base_service_installer_1.BaseServiceInstaller {
    get plistPath() {
        const homeDir = require('os').homedir();
        return path.join(homeDir, 'Library', 'LaunchAgents', `${this.config.serviceName}.plist`);
    }
    async isInstalled() {
        return fs.existsSync(this.plistPath);
    }
    async install() {
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
        }
        catch (error) {
            this.logError('Failed to install service', error);
            return false;
        }
    }
    async uninstall() {
        try {
            // Stop service first if running
            await this.stop();
            // Remove plist file
            if (fs.existsSync(this.plistPath)) {
                fs.unlinkSync(this.plistPath);
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
            const { stdout } = await (0, base_service_installer_1.execAsync)(`launchctl list | grep ${this.config.serviceName}`);
            return stdout.trim().length > 0;
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
            await (0, base_service_installer_1.execAsync)(`launchctl load "${this.plistPath}"`);
            // Wait for service to be ready
            const ready = await this.waitForService(10000);
            if (ready) {
                this.log(`Service started successfully on port ${this.config.port}`);
                return true;
            }
            else {
                this.logError('Service failed to start (health check timeout)');
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
            await (0, base_service_installer_1.execAsync)(`launchctl unload "${this.plistPath}"`);
            this.log('Service stopped');
            return true;
        }
        catch (error) {
            this.logError('Failed to stop service', error);
            return false;
        }
    }
    /**
     * Generate launchd plist file content
     */
    generatePlist() {
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
exports.MacOSLaunchdInstaller = MacOSLaunchdInstaller;
//# sourceMappingURL=macos-launchd-installer.js.map
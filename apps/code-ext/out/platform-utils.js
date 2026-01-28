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
exports.ServiceManager = exports.Platform = void 0;
exports.detectPlatform = detectPlatform;
exports.getServicePaths = getServicePaths;
exports.getServiceCommands = getServiceCommands;
const os = __importStar(require("os"));
/**
 * Supported platforms for service management
 */
var Platform;
(function (Platform) {
    Platform["MACOS"] = "darwin";
    Platform["LINUX"] = "linux";
    Platform["WINDOWS"] = "win32";
    Platform["UNSUPPORTED"] = "unsupported";
})(Platform || (exports.Platform = Platform = {}));
/**
 * Service manager type for each platform
 */
var ServiceManager;
(function (ServiceManager) {
    ServiceManager["LAUNCHD"] = "launchd";
    ServiceManager["SYSTEMD"] = "systemd";
    ServiceManager["WINDOWS_SERVICE"] = "windows-service";
    ServiceManager["UNSUPPORTED"] = "unsupported";
})(ServiceManager || (exports.ServiceManager = ServiceManager = {}));
/**
 * Detect current platform and service manager
 */
function detectPlatform() {
    const platform = os.platform();
    const homeDir = os.homedir();
    const tempDir = os.tmpdir();
    let serviceManager;
    let isSupported;
    switch (platform) {
        case Platform.MACOS:
            serviceManager = ServiceManager.LAUNCHD;
            isSupported = true;
            break;
        case Platform.LINUX:
            serviceManager = ServiceManager.SYSTEMD;
            isSupported = true;
            break;
        case Platform.WINDOWS:
            serviceManager = ServiceManager.WINDOWS_SERVICE;
            isSupported = true;
            break;
        default:
            serviceManager = ServiceManager.UNSUPPORTED;
            isSupported = false;
    }
    return {
        platform,
        serviceManager,
        isSupported,
        homeDir,
        tempDir
    };
}
/**
 * Get platform-specific paths for service configuration
 */
function getServicePaths(serviceName) {
    const platformInfo = detectPlatform();
    const { homeDir, platform } = platformInfo;
    switch (platform) {
        case Platform.MACOS:
            return {
                configPath: `${homeDir}/Library/LaunchAgents/${serviceName}.plist`,
                logPath: `${homeDir}/Library/Logs/${serviceName}`
            };
        case Platform.LINUX:
            return {
                configPath: `${homeDir}/.config/systemd/user/${serviceName}.service`,
                logPath: `${homeDir}/.local/share/${serviceName}/logs`,
                pidPath: `${homeDir}/.local/share/${serviceName}/${serviceName}.pid`
            };
        case Platform.WINDOWS:
            // Windows service config is in registry, but we'll use a config directory
            const appData = process.env.APPDATA || `${homeDir}/AppData/Roaming`;
            return {
                configPath: `${appData}/${serviceName}/service-config.xml`,
                logPath: `${appData}/${serviceName}/logs`
            };
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
/**
 * Get platform-specific service commands
 */
function getServiceCommands(serviceName, platformInfo) {
    const info = platformInfo || detectPlatform();
    const paths = getServicePaths(serviceName);
    switch (info.platform) {
        case Platform.MACOS:
            return {
                install: `launchctl load -w "${paths.configPath}"`,
                uninstall: `launchctl unload -w "${paths.configPath}"`,
                start: `launchctl start ${serviceName}`,
                stop: `launchctl stop ${serviceName}`,
                status: `launchctl list | grep ${serviceName}`,
                restart: `launchctl stop ${serviceName} && launchctl start ${serviceName}`
            };
        case Platform.LINUX:
            return {
                install: `systemctl --user enable ${serviceName}`,
                uninstall: `systemctl --user disable ${serviceName}`,
                start: `systemctl --user start ${serviceName}`,
                stop: `systemctl --user stop ${serviceName}`,
                status: `systemctl --user status ${serviceName}`,
                restart: `systemctl --user restart ${serviceName}`
            };
        case Platform.WINDOWS:
            // Using NSSM (Non-Sucking Service Manager) for Windows
            return {
                install: `nssm install ${serviceName}`,
                uninstall: `nssm remove ${serviceName} confirm`,
                start: `nssm start ${serviceName}`,
                stop: `nssm stop ${serviceName}`,
                status: `nssm status ${serviceName}`,
                restart: `nssm restart ${serviceName}`
            };
        default:
            throw new Error(`Unsupported platform: ${info.platform}`);
    }
}
//# sourceMappingURL=platform-utils.js.map
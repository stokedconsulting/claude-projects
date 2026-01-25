import * as os from 'os';

/**
 * Supported platforms for service management
 */
export enum Platform {
    MACOS = 'darwin',
    LINUX = 'linux',
    WINDOWS = 'win32',
    UNSUPPORTED = 'unsupported'
}

/**
 * Service manager type for each platform
 */
export enum ServiceManager {
    LAUNCHD = 'launchd',      // macOS
    SYSTEMD = 'systemd',      // Linux
    WINDOWS_SERVICE = 'windows-service',  // Windows
    UNSUPPORTED = 'unsupported'
}

/**
 * Platform information
 */
export interface PlatformInfo {
    platform: Platform;
    serviceManager: ServiceManager;
    isSupported: boolean;
    homeDir: string;
    tempDir: string;
}

/**
 * Detect current platform and service manager
 */
export function detectPlatform(): PlatformInfo {
    const platform = os.platform() as Platform;
    const homeDir = os.homedir();
    const tempDir = os.tmpdir();

    let serviceManager: ServiceManager;
    let isSupported: boolean;

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
export function getServicePaths(serviceName: string): {
    configPath: string;
    logPath: string;
    pidPath?: string;
} {
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
export function getServiceCommands(serviceName: string, platformInfo?: PlatformInfo): {
    install: string;
    uninstall: string;
    start: string;
    stop: string;
    status: string;
    restart: string;
} {
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

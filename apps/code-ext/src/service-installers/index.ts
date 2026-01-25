import * as vscode from 'vscode';
import { BaseServiceInstaller, ServiceConfig } from './base-service-installer';
import { MacOSLaunchdInstaller } from './macos-launchd-installer';
import { LinuxSystemdInstaller } from './linux-systemd-installer';
import { WindowsServiceInstaller } from './windows-service-installer';
import { detectPlatform, Platform } from '../platform-utils';

export * from './base-service-installer';
export * from './macos-launchd-installer';
export * from './linux-systemd-installer';
export * from './windows-service-installer';

/**
 * Create appropriate service installer for the current platform
 */
export function createServiceInstaller(
    config: ServiceConfig,
    outputChannel: vscode.OutputChannel
): BaseServiceInstaller {
    const platformInfo = detectPlatform();

    switch (platformInfo.platform) {
        case Platform.MACOS:
            return new MacOSLaunchdInstaller(config, outputChannel);

        case Platform.LINUX:
            return new LinuxSystemdInstaller(config, outputChannel);

        case Platform.WINDOWS:
            return new WindowsServiceInstaller(config, outputChannel);

        default:
            throw new Error(`Unsupported platform: ${platformInfo.platform}`);
    }
}

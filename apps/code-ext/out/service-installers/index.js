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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceInstaller = createServiceInstaller;
const macos_launchd_installer_1 = require("./macos-launchd-installer");
const linux_systemd_installer_1 = require("./linux-systemd-installer");
const windows_service_installer_1 = require("./windows-service-installer");
const platform_utils_1 = require("../platform-utils");
__exportStar(require("./base-service-installer"), exports);
__exportStar(require("./macos-launchd-installer"), exports);
__exportStar(require("./linux-systemd-installer"), exports);
__exportStar(require("./windows-service-installer"), exports);
/**
 * Create appropriate service installer for the current platform
 */
function createServiceInstaller(config, outputChannel) {
    const platformInfo = (0, platform_utils_1.detectPlatform)();
    switch (platformInfo.platform) {
        case platform_utils_1.Platform.MACOS:
            return new macos_launchd_installer_1.MacOSLaunchdInstaller(config, outputChannel);
        case platform_utils_1.Platform.LINUX:
            return new linux_systemd_installer_1.LinuxSystemdInstaller(config, outputChannel);
        case platform_utils_1.Platform.WINDOWS:
            return new windows_service_installer_1.WindowsServiceInstaller(config, outputChannel);
        default:
            throw new Error(`Unsupported platform: ${platformInfo.platform}`);
    }
}
//# sourceMappingURL=index.js.map
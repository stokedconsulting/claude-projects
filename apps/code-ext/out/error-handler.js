"use strict";
/**
 * Error Handler for VSCode Extension
 *
 * Provides consistent error handling with standardized error codes,
 * user-friendly messages, and remediation steps.
 */
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
exports.ExtensionErrorHandler = exports.ExtensionError = exports.ErrorCode = void 0;
exports.executeWithErrorHandling = executeWithErrorHandling;
exports.createError = createError;
const vscode = __importStar(require("vscode"));
/**
 * Standardized error codes for VSCode extension
 */
var ErrorCode;
(function (ErrorCode) {
    // Authentication errors
    ErrorCode["AUTH_CRITICAL_MISSING_KEY"] = "AUTH_CRITICAL_MISSING_KEY";
    ErrorCode["AUTH_ERROR_INVALID_CREDENTIALS"] = "AUTH_ERROR_INVALID_CREDENTIALS";
    ErrorCode["AUTH_ERROR_INSUFFICIENT_SCOPES"] = "AUTH_ERROR_INSUFFICIENT_SCOPES";
    ErrorCode["AUTH_ERROR_GITHUB_OAUTH_RESTRICTION"] = "AUTH_ERROR_GITHUB_OAUTH_RESTRICTION";
    // Network errors
    ErrorCode["NET_ERROR_TIMEOUT"] = "NET_ERROR_TIMEOUT";
    ErrorCode["NET_ERROR_CONNECTION_FAILED"] = "NET_ERROR_CONNECTION_FAILED";
    ErrorCode["NET_ERROR_DNS_RESOLUTION"] = "NET_ERROR_DNS_RESOLUTION";
    // GitHub API errors
    ErrorCode["GH_ERROR_RATE_LIMIT"] = "GH_ERROR_RATE_LIMIT";
    ErrorCode["GH_ERROR_NOT_FOUND"] = "GH_ERROR_NOT_FOUND";
    ErrorCode["GH_ERROR_INVALID_QUERY"] = "GH_ERROR_INVALID_QUERY";
    ErrorCode["GH_ERROR_GRAPHQL_ERROR"] = "GH_ERROR_GRAPHQL_ERROR";
    ErrorCode["GH_ERROR_MUTATION_FAILED"] = "GH_ERROR_MUTATION_FAILED";
    // Validation errors
    ErrorCode["VAL_ERROR_MISSING_FIELD"] = "VAL_ERROR_MISSING_FIELD";
    ErrorCode["VAL_ERROR_INVALID_FORMAT"] = "VAL_ERROR_INVALID_FORMAT";
    ErrorCode["VAL_ERROR_INVALID_ENUM"] = "VAL_ERROR_INVALID_ENUM";
    // State management errors
    ErrorCode["STATE_ERROR_NO_SESSION"] = "STATE_ERROR_NO_SESSION";
    ErrorCode["STATE_ERROR_SESSION_EXPIRED"] = "STATE_ERROR_SESSION_EXPIRED";
    ErrorCode["STATE_ERROR_INVALID_STATE"] = "STATE_ERROR_INVALID_STATE";
    // VSCode extension specific errors
    ErrorCode["VSC_ERROR_NO_WORKSPACE"] = "VSC_ERROR_NO_WORKSPACE";
    ErrorCode["VSC_ERROR_GIT_EXTENSION_NOT_FOUND"] = "VSC_ERROR_GIT_EXTENSION_NOT_FOUND";
    ErrorCode["VSC_ERROR_NO_GIT_REPO"] = "VSC_ERROR_NO_GIT_REPO";
    ErrorCode["VSC_ERROR_NO_REMOTE"] = "VSC_ERROR_NO_REMOTE";
    ErrorCode["VSC_ERROR_INVALID_GH_URL"] = "VSC_ERROR_INVALID_GH_URL";
    ErrorCode["VSC_ERROR_REPOSITORY_NOT_FOUND"] = "VSC_ERROR_REPOSITORY_NOT_FOUND";
    ErrorCode["VSC_ERROR_STATUS_FIELD_NOT_FOUND"] = "VSC_ERROR_STATUS_FIELD_NOT_FOUND";
    ErrorCode["VSC_ERROR_INVALID_PROJECT"] = "VSC_ERROR_INVALID_PROJECT";
    ErrorCode["VSC_ERROR_LINK_FAILED"] = "VSC_ERROR_LINK_FAILED";
    ErrorCode["VSC_ERROR_UNLINK_FAILED"] = "VSC_ERROR_UNLINK_FAILED";
    // Generic errors
    ErrorCode["ERROR_UNKNOWN"] = "ERROR_UNKNOWN";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Custom error class for extension errors
 */
class ExtensionError extends Error {
    errorCode;
    remediation;
    details;
    originalError;
    constructor(errorCode, message, remediation, details, originalError) {
        super(message);
        this.name = 'ExtensionError';
        this.errorCode = errorCode;
        this.remediation = remediation;
        this.details = details;
        this.originalError = originalError;
        // Maintain prototype chain for instanceof checks
        Object.setPrototypeOf(this, ExtensionError.prototype);
    }
    /**
     * Get full error message with code, message, and remediation
     */
    getFullMessage() {
        let msg = `[${this.errorCode}] ${this.message}`;
        if (this.details) {
            msg += `\n\nDetails: ${this.details}`;
        }
        if (this.remediation) {
            msg += `\n\nFix: ${this.remediation}`;
        }
        return msg;
    }
    /**
     * Convert to JSON for logging
     */
    toJSON() {
        return {
            errorCode: this.errorCode,
            message: this.message,
            remediation: this.remediation,
            details: this.details,
        };
    }
}
exports.ExtensionError = ExtensionError;
/**
 * Error handler service for VSCode extension
 */
class ExtensionErrorHandler {
    outputChannel;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Handle error and show to user
     * @param error - Error to handle
     * @param showModal - Show as modal dialog instead of toast
     */
    async handleError(error, showModal = false) {
        const errorDetails = this.parseError(error);
        await this.logError(errorDetails);
        await this.showErrorToUser(errorDetails, showModal);
    }
    /**
     * Parse error into structured ErrorDetails
     */
    parseError(error) {
        if (error instanceof ExtensionError) {
            return error.toJSON();
        }
        if (error instanceof Error) {
            // Try to detect error type from message
            const message = error.message;
            if (message.includes('No workspace folder')) {
                return {
                    errorCode: ErrorCode.VSC_ERROR_NO_WORKSPACE,
                    message: 'No workspace folder is open',
                    remediation: 'Open a folder containing a Git repository',
                    originalError: error,
                };
            }
            if (message.includes('Git extension')) {
                return {
                    errorCode: ErrorCode.VSC_ERROR_GIT_EXTENSION_NOT_FOUND,
                    message: 'Git extension not found',
                    remediation: 'Ensure VS Code has Git support installed',
                    originalError: error,
                };
            }
            if (message.includes('No git repository')) {
                return {
                    errorCode: ErrorCode.VSC_ERROR_NO_GIT_REPO,
                    message: 'No git repository found',
                    remediation: 'Initialize a git repository with "git init"',
                    originalError: error,
                };
            }
            if (message.includes('No remote')) {
                return {
                    errorCode: ErrorCode.VSC_ERROR_NO_REMOTE,
                    message: 'No remote found in current repository',
                    remediation: 'Add a remote with "git remote add origin <url>"',
                    originalError: error,
                };
            }
            if (message.includes('Parse GitHub URL')) {
                return {
                    errorCode: ErrorCode.VSC_ERROR_INVALID_GH_URL,
                    message: 'Could not parse GitHub URL from remote',
                    remediation: 'Verify remote is a valid GitHub URL',
                    originalError: error,
                };
            }
            if (message.includes('GitHub API') && message.includes('rate limit')) {
                return {
                    errorCode: ErrorCode.GH_ERROR_RATE_LIMIT,
                    message: 'GitHub API rate limit exceeded',
                    remediation: 'Wait a few minutes and try again, or upgrade your GitHub account',
                    originalError: error,
                };
            }
            if (message.includes('authentication') || message.includes('GitHub')) {
                return {
                    errorCode: ErrorCode.AUTH_ERROR_INVALID_CREDENTIALS,
                    message: 'GitHub authentication failed',
                    remediation: 'Run "gh auth login" to re-authenticate',
                    originalError: error,
                };
            }
            if (message.includes('not found')) {
                return {
                    errorCode: ErrorCode.GH_ERROR_NOT_FOUND,
                    message: error.message,
                    remediation: 'Verify the repository exists and you have access',
                    originalError: error,
                };
            }
            // Generic error
            return {
                errorCode: ErrorCode.ERROR_UNKNOWN,
                message: error.message,
                details: error.stack,
                originalError: error,
            };
        }
        // Unknown error type
        return {
            errorCode: ErrorCode.ERROR_UNKNOWN,
            message: 'An unknown error occurred',
            details: String(error),
        };
    }
    /**
     * Log error to output channel
     */
    async logError(errorDetails) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${errorDetails.errorCode}: ${errorDetails.message}`;
        this.outputChannel.appendLine(logEntry);
        if (errorDetails.details) {
            this.outputChannel.appendLine(`Details: ${errorDetails.details}`);
        }
        if (errorDetails.remediation) {
            this.outputChannel.appendLine(`Remediation: ${errorDetails.remediation}`);
        }
        this.outputChannel.appendLine('---');
    }
    /**
     * Show error to user via toast or modal
     */
    async showErrorToUser(errorDetails, showModal = false) {
        const title = `[${errorDetails.errorCode}] ${errorDetails.message}`;
        const message = errorDetails.remediation
            ? `${errorDetails.message}\n\n${errorDetails.remediation}`
            : errorDetails.message;
        if (showModal) {
            await vscode.window.showErrorMessage(message, { modal: true }, 'Open Output Channel');
            // Note: In actual implementation, would handle action response
        }
        else {
            vscode.window.showErrorMessage(message);
        }
    }
    /**
     * Show warning to user
     */
    async showWarning(message, remediation) {
        const fullMessage = remediation ? `${message}\n\n${remediation}` : message;
        vscode.window.showWarningMessage(fullMessage);
    }
    /**
     * Show info to user
     */
    async showInfo(message) {
        vscode.window.showInformationMessage(message);
    }
}
exports.ExtensionErrorHandler = ExtensionErrorHandler;
/**
 * Helper function to safely execute async operations with error handling
 */
async function executeWithErrorHandling(operation, errorHandler, operationName = 'Operation') {
    try {
        return await operation();
    }
    catch (error) {
        console.error(`${operationName} failed:`, error);
        await errorHandler.handleError(error);
        return null;
    }
}
/**
 * Helper to create error with consistent format
 */
function createError(code, message, remediation, details) {
    return new ExtensionError(code, message, remediation, details);
}
//# sourceMappingURL=error-handler.js.map
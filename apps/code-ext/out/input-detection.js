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
exports.detectFilePath = detectFilePath;
exports.getTypeaheadResults = getTypeaheadResults;
exports.detectMarkup = detectMarkup;
exports.detectInputType = detectInputType;
exports.extractInput = extractInput;
exports.renderMarkdownPreview = renderMarkdownPreview;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
/**
 * Preferred file extensions in priority order
 */
const PREFERRED_EXTENSIONS = ['.md', '.txt', '.pdf', '.doc', '.docx', '.rtf'];
/**
 * Detect if input looks like a file path
 */
function detectFilePath(input, cwd) {
    const trimmed = input.trim();
    // Check if input looks like a path
    const pathPattern = /^[~./]|[/\\]/;
    if (!pathPattern.test(trimmed)) {
        return { isFilePath: false };
    }
    try {
        // Resolve path (handle ~, relative, absolute)
        let resolvedPath = trimmed;
        // Handle tilde expansion
        if (resolvedPath.startsWith('~')) {
            resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
        }
        // Resolve relative to CWD
        if (!path.isAbsolute(resolvedPath)) {
            resolvedPath = path.resolve(cwd, resolvedPath);
        }
        // Check if exists
        const exists = fs.existsSync(resolvedPath);
        const extension = path.extname(resolvedPath);
        return {
            isFilePath: true,
            resolvedPath,
            exists,
            extension: extension || undefined
        };
    }
    catch (error) {
        return { isFilePath: false };
    }
}
/**
 * Generate typeahead results for file paths
 */
function getTypeaheadResults(input, cwd) {
    const detection = detectFilePath(input, cwd);
    if (!detection.isFilePath || !detection.resolvedPath) {
        return [];
    }
    const results = [];
    try {
        // Get directory to search
        const dirPath = detection.exists && fs.statSync(detection.resolvedPath).isDirectory()
            ? detection.resolvedPath
            : path.dirname(detection.resolvedPath);
        const baseNamePattern = path.basename(detection.resolvedPath).toLowerCase();
        // Read directory
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const ext = path.extname(entry.name);
            // Skip hidden files
            if (entry.name.startsWith('.')) {
                continue;
            }
            // Check if name matches pattern
            const nameMatches = entry.name.toLowerCase().includes(baseNamePattern);
            if (!nameMatches && baseNamePattern.length > 0) {
                continue;
            }
            // Calculate score based on extension preference
            let score = 0;
            if (entry.isFile()) {
                const extIndex = PREFERRED_EXTENSIONS.indexOf(ext);
                score = extIndex >= 0 ? (PREFERRED_EXTENSIONS.length - extIndex) : 1;
            }
            else {
                score = 0.5; // Directories get lower priority
            }
            results.push({
                path: fullPath,
                type: entry.isDirectory() ? 'directory' : 'file',
                extension: ext || undefined,
                score
            });
        }
        // Sort by score (descending), then by name
        results.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.path.localeCompare(b.path);
        });
        // Limit to top 10
        return results.slice(0, 10);
    }
    catch (error) {
        console.error('Typeahead error:', error);
        return [];
    }
}
/**
 * Detect if input contains markup
 */
function detectMarkup(input) {
    const trimmed = input.trim();
    // Check for markdown syntax
    const markdownPatterns = [
        /^#{1,6}\s/m, // Headers
        /\*\*.*?\*\*/, // Bold
        /_.*?_/, // Italic
        /\[.*?\]\(.*?\)/, // Links
        /^[-*+]\s/m, // Lists
        /^```/m, // Code blocks
        /^>\s/m // Blockquotes
    ];
    // Check for HTML tags
    const htmlPattern = /<[a-z][\s\S]*>/i;
    // Must have multiple lines and formatting to be considered markup
    const hasMultipleLines = trimmed.split('\n').length > 1;
    return hasMultipleLines && (markdownPatterns.some(pattern => pattern.test(trimmed)) ||
        htmlPattern.test(trimmed));
}
/**
 * Determine input type
 */
function detectInputType(input, cwd) {
    const detection = detectFilePath(input, cwd);
    if (detection.isFilePath && detection.exists) {
        return 'file';
    }
    if (detectMarkup(input)) {
        return 'markup';
    }
    return 'text';
}
/**
 * Extract and read input content
 */
async function extractInput(input, cwd) {
    const type = detectInputType(input, cwd);
    if (type === 'file') {
        const detection = detectFilePath(input, cwd);
        if (detection.resolvedPath && detection.exists) {
            try {
                const content = await fs.promises.readFile(detection.resolvedPath, 'utf-8');
                return {
                    type: 'file',
                    content,
                    metadata: {
                        filePath: detection.resolvedPath,
                        fileType: detection.extension
                    }
                };
            }
            catch (error) {
                // Fall back to text if read fails
                return {
                    type: 'text',
                    content: input
                };
            }
        }
    }
    return {
        type,
        content: input
    };
}
/**
 * Render markdown preview (simple implementation)
 */
function renderMarkdownPreview(markdown) {
    // Basic markdown to HTML conversion (simplified)
    let html = markdown;
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Lists
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
}
//# sourceMappingURL=input-detection.js.map
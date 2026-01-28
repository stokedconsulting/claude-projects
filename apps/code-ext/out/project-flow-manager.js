"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectFlowManager = void 0;
/**
 * Generate a simple UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * Manages the state and orchestration of the project creation flow
 */
class ProjectFlowManager {
    context;
    currentSession;
    preferences;
    constructor(context) {
        this.context = context;
        // Load preferences from extension storage
        this.preferences = context.globalState.get('projectFlowPreferences') || {
            skipProductReview: false,
            defaultVisibility: 'private'
        };
    }
    /**
     * Start a new project flow session
     */
    startSession() {
        const sessionId = generateUUID();
        this.currentSession = {
            sessionId,
            startedAt: new Date(),
            currentPhase: 'input',
            input: { type: 'text', content: '' },
            designIterations: {
                iterations: [],
                currentResult: '',
                userPreferences: {
                    skipProductReview: this.preferences.skipProductReview
                }
            }
        };
        return sessionId;
    }
    /**
     * Get current session
     */
    getCurrentSession() {
        return this.currentSession;
    }
    /**
     * Update current phase
     */
    setPhase(phase) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.currentPhase = phase;
    }
    /**
     * Store extracted input
     */
    setInput(input) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.input = input;
    }
    /**
     * Add design iteration
     */
    addDesignIteration(prompt, result) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.designIterations.iterations.push({
            prompt,
            result,
            timestamp: new Date()
        });
        this.currentSession.designIterations.currentResult = result;
    }
    /**
     * Set skip product review preference
     */
    setSkipProductReview(skip) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.designIterations.userPreferences.skipProductReview = skip;
        // Save to global preferences
        this.preferences.skipProductReview = skip;
        this.context.globalState.update('projectFlowPreferences', this.preferences);
    }
    /**
     * Set project creation configuration
     */
    setFinalConfig(config) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }
        this.currentSession.finalConfig = config;
    }
    /**
     * Get preferences
     */
    getPreferences() {
        return this.preferences;
    }
    /**
     * Update last used repo
     */
    updateLastUsedRepo(owner, name) {
        this.preferences.lastUsedRepo = { owner, name };
        this.context.globalState.update('projectFlowPreferences', this.preferences);
    }
    /**
     * Clear current session
     */
    clearSession() {
        this.currentSession = undefined;
    }
    /**
     * Get session state for persistence
     */
    getSessionState() {
        return this.currentSession;
    }
    /**
     * Restore session from state
     */
    restoreSession(state) {
        this.currentSession = state;
    }
}
exports.ProjectFlowManager = ProjectFlowManager;
//# sourceMappingURL=project-flow-manager.js.map
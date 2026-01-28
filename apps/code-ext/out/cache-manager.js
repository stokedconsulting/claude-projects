"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
class CacheManager {
    context;
    static CACHE_VERSION = 1;
    static CACHE_KEY_PREFIX = 'ghProjects.cache';
    static CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    static METRICS_KEY_PREFIX = 'ghProjects.metrics';
    metrics = new Map();
    constructor(context) {
        this.context = context;
        // Load cached metrics from storage
        this.loadMetrics();
    }
    /**
     * Get cache key for a specific owner/repo combination
     */
    getCacheKey(owner, repo) {
        return `${CacheManager.CACHE_KEY_PREFIX}.${owner}.${repo}`;
    }
    /**
     * Load cached data for a specific repository
     */
    async loadCache(owner, repo) {
        const key = this.getCacheKey(owner, repo);
        const cached = this.context.workspaceState.get(key);
        if (!cached) {
            this.recordCacheMiss(owner, repo);
            return null;
        }
        // Validate cache version
        if (cached.version !== CacheManager.CACHE_VERSION) {
            console.log('Cache version mismatch, invalidating cache');
            await this.clearCache(owner, repo, 'version-mismatch');
            return null;
        }
        // Validate owner/repo match
        if (cached.owner !== owner || cached.repo !== repo) {
            console.log('Cache owner/repo mismatch, invalidating cache');
            await this.clearCache(owner, repo, 'owner-repo-mismatch');
            return null;
        }
        // Check if cache is stale
        if (this.isCacheStale(cached)) {
            this.recordCacheMiss(owner, repo);
            return null;
        }
        // Cache hit
        this.recordCacheHit(owner, repo);
        return cached;
    }
    /**
     * Save data to cache
     */
    async saveCache(owner, repo, repoProjects, orgProjects, statusOptions) {
        const key = this.getCacheKey(owner, repo);
        const data = {
            version: CacheManager.CACHE_VERSION,
            timestamp: Date.now(),
            owner,
            repo,
            repoProjects,
            orgProjects,
            statusOptions,
        };
        await this.context.workspaceState.update(key, data);
        console.log(`[CacheManager] Cache saved for ${owner}/${repo} (${JSON.stringify({
            repoProjects: repoProjects.length,
            orgProjects: orgProjects.length,
            statusOptions: statusOptions.length,
        })}`);
    }
    /**
     * Clear cache for a specific repository
     */
    async clearCache(owner, repo, reason = 'manual') {
        const key = this.getCacheKey(owner, repo);
        await this.context.workspaceState.update(key, undefined);
        this.recordInvalidation(owner, repo, reason);
        console.log(`[CacheManager] Cache cleared for ${owner}/${repo} (reason: ${reason})`);
    }
    /**
     * Check if cached data is stale
     */
    isCacheStale(cached) {
        const age = Date.now() - cached.timestamp;
        return age > CacheManager.CACHE_EXPIRY_MS;
    }
    /**
     * Get cache age in seconds
     */
    getCacheAge(cached) {
        return Math.floor((Date.now() - cached.timestamp) / 1000);
    }
    /**
     * Clear all caches (useful for debugging or settings)
     */
    async clearAllCaches() {
        const keys = this.context.workspaceState.keys();
        const cacheKeys = keys.filter(key => key.startsWith(CacheManager.CACHE_KEY_PREFIX));
        for (const key of cacheKeys) {
            await this.context.workspaceState.update(key, undefined);
        }
        console.log(`[CacheManager] Cleared all caches (${cacheKeys.length} entries)`);
    }
    /**
     * Get cache metrics for all cached repositories
     */
    getMetrics() {
        return this.metrics;
    }
    /**
     * Get cache hit rate as percentage
     */
    getHitRate() {
        let totalHits = 0;
        let totalRequests = 0;
        for (const metrics of this.metrics.values()) {
            totalHits += metrics.hits;
            totalRequests += metrics.hits + metrics.misses;
        }
        if (totalRequests === 0) {
            return 0;
        }
        return Math.round((totalHits / totalRequests) * 100);
    }
    // Private helper methods
    getMetricsKey(owner, repo) {
        return `${CacheManager.METRICS_KEY_PREFIX}.${owner}.${repo}`;
    }
    recordCacheHit(owner, repo) {
        const key = `${owner}/${repo}`;
        const metrics = this.metrics.get(key) || { hits: 0, misses: 0, invalidations: 0 };
        metrics.hits++;
        this.metrics.set(key, metrics);
        this.saveMetrics();
    }
    recordCacheMiss(owner, repo) {
        const key = `${owner}/${repo}`;
        const metrics = this.metrics.get(key) || { hits: 0, misses: 0, invalidations: 0 };
        metrics.misses++;
        this.metrics.set(key, metrics);
        this.saveMetrics();
    }
    recordInvalidation(owner, repo, reason) {
        const key = `${owner}/${repo}`;
        const metrics = this.metrics.get(key) || { hits: 0, misses: 0, invalidations: 0 };
        metrics.invalidations++;
        metrics.lastInvalidationReason = reason;
        this.metrics.set(key, metrics);
        this.saveMetrics();
    }
    loadMetrics() {
        try {
            const keys = this.context.workspaceState.keys();
            const metricsKeys = keys.filter(key => key.startsWith(CacheManager.METRICS_KEY_PREFIX));
            for (const key of metricsKeys) {
                const metrics = this.context.workspaceState.get(key);
                if (metrics) {
                    const repoKey = key.replace(CacheManager.METRICS_KEY_PREFIX + '.', '');
                    this.metrics.set(repoKey, metrics);
                }
            }
        }
        catch (error) {
            console.warn('[CacheManager] Failed to load metrics:', error);
        }
    }
    saveMetrics() {
        try {
            for (const [key, metrics] of this.metrics.entries()) {
                const metricsKey = `${CacheManager.METRICS_KEY_PREFIX}.${key}`;
                this.context.workspaceState.update(metricsKey, metrics);
            }
        }
        catch (error) {
            console.warn('[CacheManager] Failed to save metrics:', error);
        }
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=cache-manager.js.map
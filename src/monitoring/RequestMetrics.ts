/**
 * Request metrics tracking for performance monitoring.
 * Tracks request counts, latencies, and cache hit rates.
 */

interface RequestTiming {
  endpoint: string;
  method: string;
  duration: number;
  cacheHit: boolean;
  timestamp: Date;
  status: 'success' | 'error';
}

interface EndpointStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Metrics collector for request performance tracking.
 * Uses in-memory storage suitable for edge functions.
 */
export class RequestMetrics {
  private static instance: RequestMetrics;
  private metrics: Map<string, EndpointStats> = new Map();
  private recentRequests: RequestTiming[] = [];
  private maxRecentRequests = 100;
  private startTime: Date = new Date();

  private constructor() {}

  static getInstance(): RequestMetrics {
    if (!RequestMetrics.instance) {
      RequestMetrics.instance = new RequestMetrics();
    }
    return RequestMetrics.instance;
  }

  /**
   * Record a request timing
   */
  record(timing: RequestTiming): void {
    const key = `${timing.method}:${timing.endpoint}`;

    // Update endpoint stats
    const stats = this.metrics.get(key) || {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
    };

    stats.totalRequests++;
    stats.totalDuration += timing.duration;
    stats.minDuration = Math.min(stats.minDuration, timing.duration);
    stats.maxDuration = Math.max(stats.maxDuration, timing.duration);

    if (timing.status === 'success') {
      stats.successCount++;
    } else {
      stats.errorCount++;
    }

    if (timing.cacheHit) {
      stats.cacheHits++;
    } else {
      stats.cacheMisses++;
    }

    this.metrics.set(key, stats);

    // Track recent requests (rolling window)
    this.recentRequests.push(timing);
    if (this.recentRequests.length > this.maxRecentRequests) {
      this.recentRequests.shift();
    }
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointStats(method: string, endpoint: string): EndpointStats | undefined {
    return this.metrics.get(`${method}:${endpoint}`);
  }

  /**
   * Get all metrics summary
   */
  getSummary(): {
    uptime: number;
    totalRequests: number;
    totalErrors: number;
    cacheHitRate: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    endpoints: Record<string, {
      requests: number;
      errors: number;
      avgLatency: number;
      cacheHitRate: number;
    }>;
  } {
    const uptime = Date.now() - this.startTime.getTime();
    let totalRequests = 0;
    let totalErrors = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;
    let totalDuration = 0;

    const endpoints: Record<string, {
      requests: number;
      errors: number;
      avgLatency: number;
      cacheHitRate: number;
    }> = {};

    for (const [key, stats] of this.metrics.entries()) {
      totalRequests += stats.totalRequests;
      totalErrors += stats.errorCount;
      totalCacheHits += stats.cacheHits;
      totalCacheMisses += stats.cacheMisses;
      totalDuration += stats.totalDuration;

      const cacheTotal = stats.cacheHits + stats.cacheMisses;
      endpoints[key] = {
        requests: stats.totalRequests,
        errors: stats.errorCount,
        avgLatency: stats.totalRequests > 0 ? Math.round(stats.totalDuration / stats.totalRequests) : 0,
        cacheHitRate: cacheTotal > 0 ? Math.round((stats.cacheHits / cacheTotal) * 100) : 0,
      };
    }

    // Calculate percentiles from recent requests
    const latencies = this.recentRequests.map(r => r.duration).sort((a, b) => a - b);
    const p50 = this.percentile(latencies, 50);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);

    const totalCache = totalCacheHits + totalCacheMisses;

    return {
      uptime,
      totalRequests,
      totalErrors,
      cacheHitRate: totalCache > 0 ? Math.round((totalCacheHits / totalCache) * 100) : 0,
      avgLatency: totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      endpoints,
    };
  }

  /**
   * Get recent request history
   */
  getRecentRequests(): RequestTiming[] {
    return [...this.recentRequests];
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.recentRequests = [];
    this.startTime = new Date();
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }
}

/**
 * Timer utility for measuring request duration
 */
export class RequestTimer {
  private startTime: number;
  private endpoint: string;
  private method: string;
  private cacheHit: boolean = false;

  constructor(endpoint: string, method: string) {
    this.startTime = Date.now();
    this.endpoint = endpoint;
    this.method = method;
  }

  setCacheHit(hit: boolean): void {
    this.cacheHit = hit;
  }

  finish(status: 'success' | 'error' = 'success'): number {
    const duration = Date.now() - this.startTime;

    RequestMetrics.getInstance().record({
      endpoint: this.endpoint,
      method: this.method,
      duration,
      cacheHit: this.cacheHit,
      timestamp: new Date(),
      status,
    });

    return duration;
  }
}

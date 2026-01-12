/**
 * Logger utility module
 * Provides structured logging for gateway operations
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  private formatEntry(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `[${entry.timestamp}] ${entry.level}: ${entry.message}${dataStr}`;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log an incoming HTTP request
   */
  logRequest(
    method: string,
    path: string,
    query?: Record<string, string>,
    headers?: Record<string, string>
  ): void {
    const data: Record<string, unknown> = {
      method,
      path,
      timestamp: new Date().toISOString(),
    };

    if (query && Object.keys(query).length > 0) {
      data.query = query;
    }

    if (headers?.['authorization']) {
      data.hasAuth = true;
    }

    if (headers?.['user-agent']) {
      data.userAgent = headers['user-agent'];
    }

    this.info('Incoming request', data);
  }

  /**
   * Log an HTTP response
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    size?: number
  ): void {
    const data: Record<string, unknown> = {
      method,
      path,
      status: statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    if (size) {
      data.size = size;
    }

    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, 'Response sent', data);
  }

  /**
   * Log backend communication
   */
  logBackendCall(
    method: string,
    endpoint: string,
    serverId: string,
    durationMs: number,
    statusCode?: number,
    error?: string
  ): void {
    const data: Record<string, unknown> = {
      method,
      endpoint,
      serverId,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    if (statusCode) {
      data.status = statusCode;
    }

    if (error) {
      data.error = error;
      this.error('Backend call failed', data);
    } else {
      this.info('Backend call completed', data);
    }
  }

  /**
   * Log session events
   */
  logSession(
    action: 'created' | 'deleted' | 'accessed' | 'expired',
    sessionId: string,
    serverId?: string
  ): void {
    const data: Record<string, unknown> = {
      action,
      sessionId,
      timestamp: new Date().toISOString(),
    };

    if (serverId) {
      data.serverId = serverId;
    }

    this.info('Session event', data);
  }

  /**
   * Log circuit breaker state changes
   */
  logCircuitBreaker(
    serverId: string,
    state: 'open' | 'closed' | 'half-open',
    failureCount?: number
  ): void {
    const data: Record<string, unknown> = {
      serverId,
      state,
      timestamp: new Date().toISOString(),
    };

    if (failureCount !== undefined) {
      data.failureCount = failureCount;
    }

    this.warn('Circuit breaker state change', data);
  }

  /**
   * Log MCP method calls
   */
  logMcpMethod(method: string, params?: unknown, serverId?: string): void {
    const data: Record<string, unknown> = {
      method,
      timestamp: new Date().toISOString(),
    };

    if (serverId) {
      data.serverId = serverId;
    }

    if (params) {
      data.paramsType = typeof params;
    }

    this.debug('MCP method call', data);
  }

  /**
   * Log cache operations
   */
  logCache(
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    key: string,
    ttl?: number
  ): void {
    const data: Record<string, unknown> = {
      operation,
      key,
      timestamp: new Date().toISOString(),
    };

    if (ttl) {
      data.ttl = ttl;
    }

    this.debug('Cache operation', data);
  }
}

export const logger = new Logger();

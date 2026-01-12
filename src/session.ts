/**
 * Session management module
 * Handles SSE session lifecycle and metrics
 */

export interface Session {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  createdAt: number;
}

export interface Metrics {
  startTime: number;
  totalRequests: number;
  totalErrors: number;
  toolCalls: number;
  sessionsCreated: number;
}

export const sessions = new Map<string, Session>();

export const metrics: Metrics = {
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  toolCalls: 0,
  sessionsCreated: 0,
};

/**
 * Send SSE message to a session
 */
export function sendSSE(
  sessionId: string,
  event: string,
  data: unknown
): boolean {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      session.controller.enqueue(session.encoder.encode(message));
      return true;
    } catch {
      sessions.delete(sessionId);
      return false;
    }
  }
  return false;
}

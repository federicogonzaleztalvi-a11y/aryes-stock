/**
 * _log.js — Structured logging helper for Vercel serverless functions.
 *
 * Outputs JSON lines so Vercel log filters can query by field.
 * Format: { ts, level, service, msg, ...extra }
 *
 * Usage:
 *   import { log } from './_log.js';
 *   log.info('pedido', 'order created', { orderId, clienteNombre });
 *   log.error('historial', 'DB error', { status: r.status, body: err });
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

function emit(level, service, msg, extra = {}) {
  const entry = {
    ts:      new Date().toISOString(),
    level,
    service,
    msg,
    ...extra,
  };
  // Vercel captures stdout/stderr — error/fatal go to stderr for log level filtering
  const output = JSON.stringify(entry);
  if (LEVELS[level] >= LEVELS.error) {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const log = {
  debug: (service, msg, extra) => emit('debug', service, msg, extra),
  info:  (service, msg, extra) => emit('info',  service, msg, extra),
  warn:  (service, msg, extra) => emit('warn',  service, msg, extra),
  error: (service, msg, extra) => emit('error', service, msg, extra),
  fatal: (service, msg, extra) => emit('fatal', service, msg, extra),
};

/**
 * withObservability — wraps a handler with automatic request/response logging.
 * Usage: export default withObservability('pedido', handler);
 */
export function withObservability(service, handler) {
  return async function observedHandler(req, res) {
    const start = Date.now();
    const { method, url } = req;

    // Wrap res.status().json() to capture response code
    let statusCode = 200;
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    res.status = (code) => {
      statusCode = code;
      return originalStatus(code);
    };
    res.json = (body) => {
      const ms = Date.now() - start;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      emit(level, service, `${method} ${statusCode}`, { ms, statusCode, url });
      return originalJson(body);
    };

    try {
      return await handler(req, res);
    } catch (err) {
      const ms = Date.now() - start;
      emit('fatal', service, 'unhandled exception', {
        ms, error: err.message, stack: err.stack?.split('\n')[1]?.trim()
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

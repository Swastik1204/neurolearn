/**
 * Centralized Logger for NeuroLearn
 *
 * Features:
 *  - Log levels: DEBUG, INFO, WARN, ERROR
 *  - Module-prefixed messages with timestamps
 *  - Circular in-memory buffer (last 200 entries) for DebugPanel
 *  - Silent in production builds
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 }

const MAX_HISTORY = 200

const isDev = import.meta.env.DEV

// In-memory circular buffer
const history = []

function timestamp() {
  return new Date().toISOString().slice(11, 23) // HH:mm:ss.SSS
}

function push(entry) {
  history.push(entry)
  if (history.length > MAX_HISTORY) history.shift()

  // Notify listeners (used by DebugPanel)
  listeners.forEach((fn) => {
    try {
      fn(entry, history)
    } catch {
      // Listener errors must never break app logic
    }
  })
}

const listeners = new Set()

function createLogger(module = 'app') {
  const minLevel = isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.SILENT

  function log(level, levelName, consoleFn, args) {
    if (level < minLevel) return

    const prefix = `[${timestamp()}] [${module}]`
    const entry = {
      ts: Date.now(),
      level: levelName,
      module,
      message: args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
    }

    push(entry)
    consoleFn(`${prefix}`, ...args)
  }

  return {
    debug: (...args) => log(LOG_LEVELS.DEBUG, 'DEBUG', console.debug, args),
    info: (...args) => log(LOG_LEVELS.INFO, 'INFO', console.info, args),
    warn: (...args) => log(LOG_LEVELS.WARN, 'WARN', console.warn, args),
    error: (...args) => log(LOG_LEVELS.ERROR, 'ERROR', console.error, args),
  }
}

/** Subscribe to new log entries. Returns unsubscribe function. */
function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Return a shallow copy of the current log history. */
function getHistory() {
  return [...history]
}

/** Create a sub-logger for a specific module. */
function create(module) {
  return createLogger(module)
}

// Default root logger
const logger = {
  ...createLogger('app'),
  create,
  getHistory,
  subscribe,
}

export default logger

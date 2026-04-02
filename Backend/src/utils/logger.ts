import fs from 'fs';
import path from 'path';
import { sanitize } from './sanitizer.js';

/**
 * Log levels with priority
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    SUCCESS = 2,
    WARN = 3,
    ERROR = 4,
    FATAL = 5,
}

/**
 * Log configuration
 */
interface LogConfig {
    consoleLevel: LogLevel;
    fileLevel: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    enableJson: boolean;
    maxFileSize: number; // in bytes
}

/**
 * Structured log entry
 */
interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: Record<string, any>;
    stack?: string;
}

/**
 * ANSI color codes for console output
 */
const colors = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[34m', // Blue
    success: '\x1b[32m', // Green
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    fatal: '\x1b[35m', // Magenta
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
} as const;

/**
 * Professional Logger Class
 */
class Logger {
    private config: LogConfig;
    private logDir: string;
    private appLogStream: fs.WriteStream | null = null;
    private errorLogStream: fs.WriteStream | null = null;
    private jsonLogStream: fs.WriteStream | null = null;

    constructor(config?: Partial<LogConfig>) {
        this.config = {
            consoleLevel: LogLevel.INFO,
            fileLevel: LogLevel.DEBUG,
            enableConsole: true,
            enableFile: true,
            enableJson: false,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            ...config,
        };

        this.logDir = path.join(process.cwd(), 'logs');
        this.initializeLogStreams();
    }

    /**
     * Initializes log directory and file streams
     */
    private initializeLogStreams(): void {
        if (!this.config.enableFile) return;

        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        this.appLogStream = fs.createWriteStream(path.join(this.logDir, 'app.log'), {
            flags: 'a',
        });
        this.errorLogStream = fs.createWriteStream(path.join(this.logDir, 'error.log'), {
            flags: 'a',
        });

        if (this.config.enableJson) {
            this.jsonLogStream = fs.createWriteStream(path.join(this.logDir, 'app.json.log'), {
                flags: 'a',
            });
        }

        // Rotate logs if they exceed max size
        this.rotateLogs();
    }

    /**
     * Rotates log files if they exceed max size
     */
    private rotateLogs(): void {
        const logFiles = ['app.log', 'error.log', 'app.json.log'];

        logFiles.forEach((file) => {
            const filePath = path.join(this.logDir, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > this.config.maxFileSize) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const archivePath = path.join(this.logDir, `${file}.${timestamp}.archive`);
                    fs.renameSync(filePath, archivePath);
                }
            }
        });
    }

    /**
     * Gets current timestamp in ISO format
     */
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Formats log message for console output (inline format)
     */
    private formatConsoleMessage(
        level: string,
        message: string,
        context?: Record<string, any>,
    ): string {
        const timestamp = this.getTimestamp();
        const color = colors[level.toLowerCase() as keyof typeof colors] || colors.reset;

        let output = `${colors.dim}[${timestamp}]${colors.reset} ${color}${colors.bold}[${level.toUpperCase()}]${colors.reset} ${message}`;

        if (context && Object.keys(context).length > 0) {
            // Inline format: compact JSON on same line
            output += ` ${colors.dim}${JSON.stringify(context)}${colors.reset}`;
        }

        return output;
    }

    /**
     * Formats log message for file output
     */
    private formatFileMessage(
        level: string,
        message: string,
        context?: Record<string, any>,
    ): string {
        const timestamp = this.getTimestamp();
        let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

        if (context && Object.keys(context).length > 0) {
            output += ` | Context: ${JSON.stringify(context)}`;
        }

        return output;
    }

    /**
     * Creates structured log entry for JSON output
     */
    private createLogEntry(
        level: string,
        message: string,
        context?: Record<string, any>,
        error?: Error,
    ): LogEntry {
        const entry: LogEntry = {
            timestamp: this.getTimestamp(),
            level: level.toUpperCase(),
            message,
        };

        if (context) {
            entry.context = context;
        }

        if (error && error.stack) {
            entry.stack = error.stack;
        }

        return entry;
    }

    /**
     * Core logging method
     */
    private log(
        level: LogLevel,
        levelName: string,
        message: string,
        context?: Record<string, any>,
        error?: Error,
    ): void {
        // Sanitize context to prevent sensitive data leakage
        const sanitizedContext = context ? sanitize(context) : undefined;

        // Console output
        if (this.config.enableConsole && level >= this.config.consoleLevel) {
            const consoleMsg = this.formatConsoleMessage(levelName, message, sanitizedContext);
            if (level >= LogLevel.ERROR) {
                console.error(consoleMsg);
            } else {
                console.log(consoleMsg);
            }
        }

        // File output
        if (this.config.enableFile && level >= this.config.fileLevel) {
            const fileMsg = this.formatFileMessage(levelName, message, sanitizedContext);

            // Write to app.log
            if (this.appLogStream) {
                this.appLogStream.write(fileMsg + '\n');
            }

            // Write errors to error.log
            if (level >= LogLevel.ERROR && this.errorLogStream) {
                this.errorLogStream.write(fileMsg + '\n');
                if (error && error.stack) {
                    this.errorLogStream.write(`Stack: ${error.stack}\n`);
                }
            }

            // Write to JSON log
            if (this.config.enableJson && this.jsonLogStream) {
                const logEntry = this.createLogEntry(levelName, message, sanitizedContext, error);
                this.jsonLogStream.write(JSON.stringify(logEntry) + '\n');
            }
        }
    }

    /**
     * Debug level logging
     */
    debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, 'debug', message, context);
    }

    /**
     * Info level logging
     */
    info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, 'info', message, context);
    }

    /**
     * Success level logging
     */
    success(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.SUCCESS, 'success', message, context);
    }

    /**
     * Warning level logging
     */
    warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, 'warn', message, context);
    }

    /**
     * Error level logging
     */
    error(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, 'error', message, context, error);
    }

    /**
     * Fatal level logging (critical errors that require immediate attention)
     */
    fatal(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.FATAL, 'fatal', message, context, error);
    }

    /**
     * HTTP request logging
     */
    http(
        method: string,
        url: string,
        status: number,
        duration: number,
        context?: Record<string, any>,
    ): void {
        const message = `${method} ${url} - ${status} (${duration}ms)`;
        const level =
            status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO;
        const levelName = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        this.log(level, levelName, message, {
            ...context,
            method,
            url,
            status,
            duration,
        });
    }

    /**
     * Définit le niveau minimum pour la console
     */
    setConsoleLevel(level: LogLevel): void {
        this.config.consoleLevel = level;
    }

    /**
     * Définit le niveau minimum pour les fichiers
     */
    setFileLevel(level: LogLevel): void {
        this.config.fileLevel = level;
    }

    /**
     * Closes all log streams
     */
    close(): void {
        if (this.appLogStream) {
            this.appLogStream.end();
        }
        if (this.errorLogStream) {
            this.errorLogStream.end();
        }
        if (this.jsonLogStream) {
            this.jsonLogStream.end();
        }
    }
}

// Create and export singleton instance
const logger = new Logger({
    consoleLevel: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
    fileLevel: process.env.FILE_LOG_LEVEL ? parseInt(process.env.FILE_LOG_LEVEL) : LogLevel.DEBUG,
    enableConsole: process.env.NODE_ENV !== 'test',
    enableFile: process.env.NODE_ENV !== 'test',
    enableJson: process.env.LOG_JSON === 'true',
});

// Graceful shutdown
process.on('beforeExit', () => {
    logger.close();
});

export default logger;
export { Logger };

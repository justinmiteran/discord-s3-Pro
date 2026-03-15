const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m',
} as const;

const getTimestamp = (): string => new Date().toISOString();

const logger = {
    info: (...args: string[]): void =>
        console.log(`[${getTimestamp()}] [${colors.info}INFO${colors.reset}]`, ...args),

    success: (...args: string[]): void =>
        console.log(`[${getTimestamp()}] [${colors.success}OK${colors.reset}]`, ...args),

    error: (...args: string[]): void =>
        console.error(`[${getTimestamp()}] [${colors.error}ERROR${colors.reset}]`, ...args),

    warn: (...args: string[]): void =>
        console.warn(`[${getTimestamp()}] [${colors.warn}WARN${colors.reset}]`, ...args),

    http: (method: string, url: string, status: number, duration: number): void => {
        const color = status >= 400 ? colors.error : colors.success;
        console.log(
            `[${getTimestamp()}] [${colors.info}NETWORK${colors.reset}] ${method} ${url} - ${color}${status}${colors.reset} (${duration}ms)`,
        );
    },
};

export default logger;

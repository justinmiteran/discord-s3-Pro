const colors = {
    info: '\x1b[34m', // Blue
    success: '\x1b[32m', // Green
    error: '\x1b[31m', // Red
    warn: '\x1b[33m', // Yellow
    reset: '\x1b[0m',
};

const getTimestamp = () => new Date().toISOString();

module.exports = {
    info: (...args) =>
        console.log(`[${getTimestamp()}] [${colors.info}INFO${colors.reset}]`, ...args),
    success: (...args) =>
        console.log(`[${getTimestamp()}] [${colors.success}OK${colors.reset}]`, ...args),
    error: (...args) =>
        console.error(`[${getTimestamp()}] [${colors.error}ERROR${colors.reset}]`, ...args),
    warn: (...args) =>
        console.warn(`[${getTimestamp()}] [${colors.warn}WARN${colors.reset}]`, ...args),
    http: (method, url, status, duration) => {
        const color = status >= 400 ? colors.error : colors.success;
        console.log(
            `[${getTimestamp()}] [${colors.info}NETWORK${colors.reset}] ${method} ${url} - ${color}${status}${colors.reset} (${duration}ms)`,
        );
    },
};

export const logger = {
    info: (message: string, ...args: any[]) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    error: (message: string, error?: any, context?: any) => {
        console.error(`[ERROR] ${message}`, error ? error : '', context ? JSON.stringify(context) : '');
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
        console.debug(`[DEBUG] ${message}`, ...args);
    }
};

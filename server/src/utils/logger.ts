type LogArg = string | Record<string, unknown>;

function formatArgs(msgOrObj: LogArg, msgOrUndefined?: string, ...rest: unknown[]): [string, ...unknown[]] {
  if (typeof msgOrObj === 'string') {
    return [msgOrObj, msgOrUndefined, ...rest].filter((a) => a !== undefined) as [string, ...unknown[]];
  }
  const msg = msgOrUndefined ?? '';
  return [msg, msgOrObj, ...rest];
}

export const logger = {
  info: (msgOrObj: LogArg, msg?: string, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.log(`[INFO] ${message}`, ...extra);
  },
  error: (msgOrObj: LogArg, msg?: string, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.error(`[ERROR] ${message}`, ...extra);
  },
  warn: (msgOrObj: LogArg, msg?: string, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.warn(`[WARN] ${message}`, ...extra);
  },
  debug: (msgOrObj: LogArg, msg?: string, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.debug(`[DEBUG] ${message}`, ...extra);
  },
};

type LogArg = string | Record<string, unknown>;
type SecondArg = string | unknown;

function formatArgs(
  msgOrObj: LogArg,
  msgOrUndefined?: SecondArg,
  ...rest: unknown[]
): [string, ...unknown[]] {
  if (typeof msgOrObj === 'string') {
    return [msgOrObj, msgOrUndefined, ...rest].filter((a) => a !== undefined) as [
      string,
      ...unknown[],
    ];
  }
  const msg = typeof msgOrUndefined === 'string' ? msgOrUndefined : '';
  return msgOrUndefined !== undefined && typeof msgOrUndefined !== 'string'
    ? [msg, msgOrObj, msgOrUndefined, ...rest]
    : [msg, msgOrObj, ...rest];
}

export const logger = {
  info: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.log(`[INFO] ${message}`, ...extra);
  },
  error: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.error(`[ERROR] ${message}`, ...extra);
  },
  warn: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.warn(`[WARN] ${message}`, ...extra);
  },
  debug: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
    const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
    console.debug(`[DEBUG] ${message}`, ...extra);
  },
};

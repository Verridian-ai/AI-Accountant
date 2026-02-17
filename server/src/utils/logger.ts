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

type Logger = {
  info: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => void;
  error: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => void;
  warn: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => void;
  debug: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function createLogger(prefix: string, bindings?: Record<string, unknown>): Logger {
  const bindingsStr = bindings ? ` ${JSON.stringify(bindings)}` : '';
  return {
    info: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
      const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
      console.log(`${prefix}[INFO]${bindingsStr} ${message}`, ...extra);
    },
    error: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
      const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
      console.error(`${prefix}[ERROR]${bindingsStr} ${message}`, ...extra);
    },
    warn: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
      const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
      console.warn(`${prefix}[WARN]${bindingsStr} ${message}`, ...extra);
    },
    debug: (msgOrObj: LogArg, msg?: SecondArg, ...args: unknown[]) => {
      const [message, ...extra] = formatArgs(msgOrObj, msg, ...args);
      console.debug(`${prefix}[DEBUG]${bindingsStr} ${message}`, ...extra);
    },
    child: (childBindings: Record<string, unknown>) =>
      createLogger(prefix, { ...bindings, ...childBindings }),
  };
}

export const logger: Logger = createLogger('');

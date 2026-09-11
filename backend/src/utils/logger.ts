/* eslint-disable no-console */
type LogFields = Record<string, unknown>;

function line(level: string, msg: string, fields?: LogFields): void {
  const ts = new Date().toISOString();
  if (fields && Object.keys(fields).length > 0) {
    console.log(`[${ts}] ${level.toUpperCase()} ${msg}`, fields);
  } else {
    console.log(`[${ts}] ${level.toUpperCase()} ${msg}`);
  }
}

export const logger = {
  info: (msg: string, fields?: LogFields) => line("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => line("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => line("error", msg, fields),
};

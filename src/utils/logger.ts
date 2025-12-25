export class Logger {
  private context: string;
  private isWorkers: boolean;

  constructor(context: string = "MCP") {
    this.context = context;
    this.isWorkers =
      typeof globalThis !== "undefined" &&
      "Request" in globalThis &&
      typeof fetch !== "undefined" &&
      !("process" in globalThis);
  }

  private formatLog(
    level: string,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  info(message: string, data?: Record<string, unknown>): void {
    const log = this.formatLog("info", message, data);
    this.isWorkers
      ? console.log(log)
      : console.log(`[INFO] ${this.context}: ${message}`, data || "");
  }

  debug(message: string, data?: Record<string, unknown>): void {
    const log = this.formatLog("debug", message, data);
    this.isWorkers
      ? console.log(log)
      : console.debug(`[DEBUG] ${this.context}: ${message}`, data || "");
  }

  warn(message: string, data?: Record<string, unknown>): void {
    const log = this.formatLog("warn", message, data);
    this.isWorkers
      ? console.warn(log)
      : console.warn(`[WARN] ${this.context}: ${message}`, data || "");
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const log = this.formatLog("error", message, data, error);
    this.isWorkers
      ? console.error(log)
      : console.error(
          `[ERROR] ${this.context}: ${message}`,
          error || "",
          data || ""
        );
  }

  logRequest(
    method: string,
    path: string,
    params?: Record<string, unknown>
  ): void {
    this.info("Request received", { method, path, params });
  }

  logResponse(
    status: number,
    duration?: number,
    data?: Record<string, unknown>
  ): void {
    this.info("Response sent", {
      status,
      duration: duration ? `${duration}ms` : undefined,
      ...data,
    });
  }

  logApiCall(
    word: string,
    num: number,
    duration?: number,
    success?: boolean
  ): void {
    this.info("API call", {
      word,
      num,
      duration: duration ? `${duration}ms` : undefined,
      success,
    });
  }
}

export const logger = new Logger("MalsaemMCP");

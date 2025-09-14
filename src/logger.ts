import * as fs from 'fs';
import * as path from 'path';
import { LogLevel } from './types/report.type';

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

export interface LoggerConfig {
  readonly level: LogLevel;
  readonly outputFile?: string;
  readonly enableConsole: boolean;
  readonly enableFile: boolean;
  readonly maxFileSize: number; // in bytes
  readonly maxFiles: number;
}

export class Logger {
  private readonly config: LoggerConfig;
  private readonly logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      outputFile: path.join(process.cwd(), 'logs', 'migration.log'),
      ...config
    };

    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (this.config.outputFile) {
      const logDir = path.dirname(this.config.outputFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.level];
  }

  private formatLogEntry(entry: LogEntry): string {
    const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
    const errorStr = entry.error ? ` [ERROR: ${entry.error.name}: ${entry.error.message}]` : '';
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${metaStr}${errorStr}`;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.config.enableFile || !this.config.outputFile) return;

    try {
      const logLine = this.formatLogEntry(entry) + '\n';
      
      // Check file size and rotate if necessary
      if (fs.existsSync(this.config.outputFile)) {
        const stats = fs.statSync(this.config.outputFile);
        if (stats.size > this.config.maxFileSize) {
          this.rotateLogFile();
        }
      }

      fs.appendFileSync(this.config.outputFile, logLine);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }
  }

  private rotateLogFile(): void {
    if (!this.config.outputFile) return;

    const baseFileName = this.config.outputFile;
    const extension = path.extname(baseFileName);
    const baseName = baseFileName.slice(0, -extension.length);

    // Shift existing log files
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldFile = `${baseName}.${i}${extension}`;
      const newFile = `${baseName}.${i + 1}${extension}`;
      if (fs.existsSync(oldFile)) {
        if (i === this.config.maxFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest file
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current log to .1
    if (fs.existsSync(baseFileName)) {
      fs.renameSync(baseFileName, `${baseName}.1${extension}`);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const formatted = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && { meta }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: error.stack })
        }
      })
    };

    this.writeToConsole(entry);
    this.writeToFile(entry);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  public error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.log('error', message, meta, error);
  }

  public createProgressLogger(total: number, itemName: string = 'items'): ProgressLogger {
    return new ProgressLogger(this, total, itemName);
  }
}

export class ProgressLogger {
  private current: number = 0;
  private lastLogTime: number = 0;
  private readonly logInterval: number = 1000; // Log every second

  constructor(
    private readonly logger: Logger,
    private readonly total: number,
    private readonly itemName: string
  ) {}

  public increment(count: number = 1): void {
    this.current += count;
    const now = Date.now();
    
    if (now - this.lastLogTime >= this.logInterval || this.current >= this.total) {
      const percentage = Math.round((this.current / this.total) * 100);
      this.logger.info(`Progress: ${this.current}/${this.total} ${this.itemName} (${percentage}%)`);
      this.lastLogTime = now;
    }
  }

  public complete(): void {
    this.logger.info(`✅ Completed: ${this.total} ${this.itemName} processed`);
  }

  public setTotal(newTotal: number): void {
    (this as any).total = newTotal;
  }
}

export class MetricsCollector {
  private readonly timers: Map<string, number> = new Map();
  private readonly counters: Map<string, number> = new Map();
  private readonly values: Map<string, number[]> = new Map();

  public startTimer(name: string): () => void {
    const startTime = Date.now();
    this.timers.set(name, startTime);
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordValue(`${name}_duration`, duration);
    };
  }

  public incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  public recordValue(name: string, value: number): void {
    const values = this.values.get(name) || [];
    values.push(value);
    this.values.set(name, values);
  }

  public getMetrics(): Record<string, unknown> {
    const metrics: Record<string, unknown> = {};

    // Add counters
    for (const [name, value] of this.counters) {
      metrics[name] = value;
    }

    // Add aggregated values
    for (const [name, values] of this.values) {
      if (values.length > 0) {
        metrics[`${name}_count`] = values.length;
        metrics[`${name}_sum`] = values.reduce((a, b) => a + b, 0);
        metrics[`${name}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
        metrics[`${name}_min`] = Math.min(...values);
        metrics[`${name}_max`] = Math.max(...values);
      }
    }

    return metrics;
  }

  public reset(): void {
    this.timers.clear();
    this.counters.clear();
    this.values.clear();
  }
}
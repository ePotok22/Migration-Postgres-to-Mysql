// Enhanced type definitions with strict typing

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly ssl: boolean | { rejectUnauthorized: boolean };
}

export interface MigrationConfig {
  readonly batchSize: number;
  readonly maxRetries: number;
  readonly retryDelay: number;
  readonly logLevel: LogLevel;
  readonly parallelTables: number;
  readonly timeout: number;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TableStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';

export type ValidationStatus = 'ok' | 'missing' | 'column_missing' | 'data_mismatch' | 'error';

export interface PostgresTableStructure {
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly is_nullable: string;
  readonly column_default: string | null;
  readonly character_maximum_length: number | null;
  readonly numeric_precision: number | null;
  readonly numeric_scale: number | null;
}

export interface PostgresColumn {
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly is_nullable: string;
}

export interface MySQLColumn {
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly is_nullable: string;
}

export interface DatabaseRow {
  readonly [key: string]: unknown;
  readonly id: number;
}

export interface TableCountResult {
  readonly table: string;
  readonly postgresCount: number | string;
  readonly mysqlCount: number | string;
  readonly match: boolean;
  readonly error?: string;
}

export interface SchemaValidationResult {
  readonly table: string;
  readonly status: ValidationStatus;
  readonly issue?: string;
}

export interface MigrationValidationResult {
  readonly table: string;
  readonly postgresCount: number | string;
  readonly mysqlCount: number | string;
  readonly isValid: boolean;
  readonly error?: string;
}

export interface MigrationTableReport {
  readonly table: string;
  readonly status: TableStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly recordsCount: number;
  readonly recordsMigrated: number;
  readonly errors: readonly string[];
  readonly performance: {
    readonly recordsPerSecond?: number;
    readonly memoryUsed?: string;
  };
}

export interface MigrationReport {
  readonly migrationDate: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly totalTables: number;
  readonly successfulTables: number;
  readonly failedTables: number;
  readonly skippedTables: number;
  readonly totalRecords: number;
  readonly performance: {
    readonly recordsPerSecond: number;
    readonly tablesPerMinute: number;
    readonly peakMemoryUsage: string;
    readonly averageMemoryUsage: string;
  };
  readonly tables: readonly MigrationTableReport[];
  readonly validation: {
    readonly countValidation: readonly TableCountResult[];
    readonly schemaValidation: readonly SchemaValidationResult[];
    readonly sampleDataValidation: readonly SampleValidationResult[];
  };
}

export interface SampleValidationResult {
  readonly table: string;
  readonly sampleSize: number;
  readonly validatedRecords: number;
  readonly mismatches: readonly DataMismatch[];
  readonly status: 'passed' | 'failed';
}

export interface DataMismatch {
  readonly recordId: number;
  readonly column: string;
  readonly postgresValue: unknown;
  readonly mysqlValue: unknown;
  readonly type: 'missing' | 'different' | 'type_mismatch';
}

export interface TableStructureGroup {
  readonly [tableName: string]: readonly PostgresTableStructure[];
}

// Runtime validation schemas
export interface ValidationSchema<T> {
  validate(data: unknown): ValidationResult<T>;
}

export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: readonly string[];
}

// Migration context for dependency injection
export interface MigrationContext {
  readonly config: {
    readonly postgres: DatabaseConfig;
    readonly mysql: DatabaseConfig;
    readonly migration: MigrationConfig;
  };
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

export interface MetricsCollector {
  startTimer(name: string): () => void;
  incrementCounter(name: string, value?: number): void;
  recordValue(name: string, value: number): void;
  getMetrics(): Record<string, unknown>;
}

// Function types for better composition
export type MigrationStep<T> = (context: MigrationContext) => Promise<T>;
export type ValidationStep<T> = (context: MigrationContext) => Promise<T>;
export type DatabaseOperation<T> = (pools: import('../performance').DatabasePools) => Promise<T>;

// Error types for better error handling
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly table?: string,
    public readonly operation?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly table?: string,
    public readonly validationType?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public readonly configKey?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// Utility types
export type NonEmptyArray<T> = readonly [T, ...T[]];
export type Awaitable<T> = T | Promise<T>;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
// In production/compiled code, __dirname points to dist/src, so we need to go up two levels
// In development, we might be running from src, so we need to handle both cases
const envPath = process.env['NODE_ENV'] === 'production' || __dirname.includes('dist') 
  ? path.resolve(__dirname, '../../.env')
  : path.resolve(__dirname, '../.env');

const result = dotenv.config({ path: envPath });

// Debug environment loading
if (result.error) {
  console.warn(`Warning: Could not load .env file from ${envPath}:`, result.error.message);
} else {
  console.log(`✓ Environment variables loaded from: ${envPath}`);
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface MigrationConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface AppConfig {
  nodeEnv: string;
  postgres: DatabaseConfig;
  mysql: DatabaseConfig;
  migration: MigrationConfig;
}

class ConfigManager {
  private readonly config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): AppConfig {
    return {
      nodeEnv: process.env['NODE_ENV'] || 'development',
      postgres: {
        host: process.env['POSTGRES_HOST'] || 'localhost',
        port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
        user: process.env['POSTGRES_USER'] || '',
        password: process.env['POSTGRES_PASSWORD'] || '',
        database: process.env['POSTGRES_DATABASE'] || '',
        ssl: (process.env['POSTGRES_SSL'] || 'false').toLowerCase() === 'true'
      },
      mysql: {
        host: process.env['MYSQL_HOST'] || 'localhost',
        port: parseInt(process.env['MYSQL_PORT'] || '3306', 10),
        user: process.env['MYSQL_USER'] || '',
        password: process.env['MYSQL_PASSWORD'] || '',
        database: process.env['MYSQL_DATABASE'] || '',
        ssl: (process.env['MYSQL_SSL'] || 'false').toLowerCase() === 'true'
      },
      migration: {
        batchSize: parseInt(process.env['BATCH_SIZE'] || '1000', 10),
        maxRetries: parseInt(process.env['MAX_RETRIES'] || '3', 10),
        retryDelay: parseInt(process.env['RETRY_DELAY'] || '1000', 10),
        logLevel: (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') || 'info'
      }
    };
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // Validate PostgreSQL config
    if (!this.config.postgres.user) {
      errors.push('POSTGRES_USER is required');
    }
    if (!this.config.postgres.password) {
      errors.push('POSTGRES_PASSWORD is required');
    }
    if (!this.config.postgres.database) {
      errors.push('POSTGRES_DATABASE is required');
    }

    // Validate MySQL config
    if (!this.config.mysql.user) {
      errors.push('MYSQL_USER is required');
    }
    if (!this.config.mysql.password) {
      errors.push('MYSQL_PASSWORD is required');
    }
    if (!this.config.mysql.database) {
      errors.push('MYSQL_DATABASE is required');
    }

    // Validate migration config
    if (this.config.migration.batchSize <= 0) {
      errors.push('BATCH_SIZE must be greater than 0');
    }
    if (this.config.migration.maxRetries < 0) {
      errors.push('MAX_RETRIES must be 0 or greater');
    }
    if (this.config.migration.retryDelay < 0) {
      errors.push('RETRY_DELAY must be 0 or greater');
    }

    // Validate log level
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(this.config.migration.logLevel)) {
      errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getPostgresConfig(): DatabaseConfig {
    return this.config.postgres;
  }

  public getMysqlConfig(): DatabaseConfig {
    return this.config.mysql;
  }

  public getMigrationConfig(): MigrationConfig {
    return this.config.migration;
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }
}

// Export singleton instance
export const config = new ConfigManager();
export default config;
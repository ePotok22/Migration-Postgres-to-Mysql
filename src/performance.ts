import { Pool } from 'pg';
import mysql from 'mysql2/promise';
import config from './config';

export interface DatabasePools {
  pgPool: Pool;
  mysqlPool: mysql.Pool;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  recordsProcessed: number;
  tablesProcessed: number;
  errorsCount: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export class DatabasePoolManager {
  private static instance: DatabasePoolManager;
  private pgPool: Pool | null = null;
  private mysqlPool: mysql.Pool | null = null;
  private readonly metrics: PerformanceMetrics;

  private constructor() {
    this.metrics = {
      startTime: Date.now(),
      recordsProcessed: 0,
      tablesProcessed: 0,
      errorsCount: 0
    };
  }

  public static getInstance(): DatabasePoolManager {
    if (!DatabasePoolManager.instance) {
      DatabasePoolManager.instance = new DatabasePoolManager();
    }
    return DatabasePoolManager.instance;
  }

  public async createPools(): Promise<DatabasePools> {
    const pgConfig = config.getPostgresConfig();
    const mysqlConfig = config.getMysqlConfig();

    // Create PostgreSQL connection pool
    this.pgPool = new Pool({
      host: pgConfig.host,
      port: pgConfig.port,
      user: pgConfig.user,
      password: pgConfig.password,
      database: pgConfig.database,
      ssl: pgConfig.ssl ? { rejectUnauthorized: false } : false,
      max: 10, // Maximum number of clients in the pool
      min: 2,  // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
      maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
    });

    // Create MySQL connection pool
    this.mysqlPool = mysql.createPool({
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('✅ Database pools created successfully');
    return { pgPool: this.pgPool, mysqlPool: this.mysqlPool };
  }

  public async closePools(): Promise<void> {
    try {
      if (this.pgPool) {
        await this.pgPool.end();
        console.log('✅ PostgreSQL pool closed');
      }
      if (this.mysqlPool) {
        await this.mysqlPool.end();
        console.log('✅ MySQL pool closed');
      }
    } catch (error) {
      console.error('❌ Error closing pools:', (error as Error).message);
    }
  }

  public updateMetrics(update: Partial<PerformanceMetrics>): void {
    Object.assign(this.metrics, update);
  }

  public getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      endTime: Date.now(),
      duration: Date.now() - this.metrics.startTime,
      memoryUsage: process.memoryUsage()
    };
  }

  public incrementRecords(count: number = 1): void {
    this.metrics.recordsProcessed += count;
  }

  public incrementTables(count: number = 1): void {
    this.metrics.tablesProcessed += count;
  }

  public incrementErrors(count: number = 1): void {
    this.metrics.errorsCount += count;
  }
}

export async function executeWithPools<T>(
  fn: (pools: DatabasePools) => Promise<T>
): Promise<T> {
  const poolManager = DatabasePoolManager.getInstance();
  const pools = await poolManager.createPools();
  
  try {
    return await fn(pools);
  } finally {
    await poolManager.closePools();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
import { Client } from 'pg';
import mysql from 'mysql2/promise';
import config from './config';

export interface DatabaseConnections {
  pgClient: Client;
  mysqlConnection: mysql.Connection;
}

export async function createConnections(): Promise<DatabaseConnections> {
  console.log('Connecting to databases...');
  
  const pgConfig = config.getPostgresConfig();
  const mysqlConfig = config.getMysqlConfig();

  // Create PostgreSQL connection
  const pgClient = new Client({
    host: pgConfig.host,
    port: pgConfig.port,
    user: pgConfig.user,
    password: pgConfig.password,
    database: pgConfig.database,
    ssl: pgConfig.ssl
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await pgClient.connect();
    console.log('✅ PostgreSQL connected');

    console.log('Connecting to MySQL...');
    const mysqlConnection = await mysql.createConnection({
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database
    });
    console.log('✅ MySQL connected');

    return { pgClient, mysqlConnection };
  } catch (error) {
    // Clean up PostgreSQL connection if MySQL connection fails
    try {
      await pgClient.end();
    } catch (cleanupError) {
      console.warn('Failed to cleanup PostgreSQL connection:', (cleanupError as Error).message);
    }
    console.error('❌ Connection failed:', (error as Error).message);
    throw error;
  }
}

export async function closeConnections(connections: DatabaseConnections): Promise<void> {
  try {
    if (connections.pgClient) {
      await connections.pgClient.end();
      console.log('✅ PostgreSQL disconnected');
    }
    if (connections.mysqlConnection) {
      await connections.mysqlConnection.end();
      console.log('✅ MySQL disconnected');
    }
  } catch (error) {
    console.error('❌ Disconnect failed:', (error as Error).message);
  }
}

export async function executeWithConnections<T>(
  fn: (connections: DatabaseConnections) => Promise<T>
): Promise<T> {
  const connections = await createConnections();
  try {
    return await fn(connections);
  } finally {
    await closeConnections(connections);
  }
}
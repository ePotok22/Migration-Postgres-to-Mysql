import { Client } from 'pg';
import mysql from 'mysql2/promise';
import config from './config';
import { createConnections, closeConnections, DatabaseConnections } from './database';
import {
  TableCountResult,
  SchemaValidationResult,
  PostgresColumn,
  MySQLColumn,
  DatabaseRow
} from './types/validate.type';

export async function validateTableCounts(connections: DatabaseConnections): Promise<TableCountResult[]> {
  console.log('🔍 Validating table row counts...');

  // Get list of tables from PostgreSQL
  const pgTablesResult = await connections.pgClient.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'strapi_%'
    ORDER BY table_name;
  `);

  const tables = pgTablesResult.rows.map((row: { table_name: string }) => row.table_name);
  const results: TableCountResult[] = [];

  for (const tableName of tables) {
    try {
      // Count in PostgreSQL
      const pgCountResult = await connections.pgClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const pgCount = parseInt((pgCountResult.rows[0] as { count: string }).count);

      // Count in MySQL
      const [mysqlCountResult] = await connections.mysqlConnection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      const mysqlCount = (mysqlCountResult as any[])[0].count as number;

      const match = pgCount === mysqlCount;
      results.push({
        table: tableName,
        postgresCount: pgCount,
        mysqlCount: mysqlCount,
        match: match
      });

      console.log(`${match ? '✅' : '❌'} ${tableName.padEnd(25)} | PG: ${pgCount.toString().padStart(6)} | MySQL: ${mysqlCount.toString().padStart(6)}`);

    } catch (error) {
      console.error(`❌ Error validating ${tableName}:`, (error as Error).message);
      results.push({
        table: tableName,
        postgresCount: 'ERROR',
        mysqlCount: 'ERROR',
        match: false,
        error: (error as Error).message
      });
    }
  }

  return results;
}

export async function getSampleData(
  pgClient: Client, 
  tableName: string, 
  sampleSize: number
): Promise<DatabaseRow[]> {
  const pgResult = await pgClient.query(`SELECT * FROM "${tableName}" ORDER BY id LIMIT ${sampleSize}`);
  return pgResult.rows as DatabaseRow[];
}

export async function getCorrespondingMySQLData(
  mysqlConnection: mysql.Connection, 
  tableName: string, 
  ids: number[]
): Promise<DatabaseRow[]> {
  const placeholders = ids.map(() => '?').join(',');
  const [mysqlResult] = await mysqlConnection.execute(
    `SELECT * FROM \`${tableName}\` WHERE id IN (${placeholders}) ORDER BY id`,
    ids
  );
  return mysqlResult as DatabaseRow[];
}

export function normalizeValue(value: any, referenceValue: any): any {
  // Handle null/undefined values
  if (value == null || referenceValue == null) {
    return value;
  }

  // Handle boolean conversions
  if (typeof referenceValue === 'boolean') {
    return value === 1 || value === true;
  }

  // Handle date/timestamp conversions
  if (referenceValue instanceof Date) {
    if (typeof value === 'string') {
      return new Date(value);
    }
    return value;
  }

  // Handle JSON objects (stored as strings in MySQL vs objects in PostgreSQL)
  if (typeof referenceValue === 'object' && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Handle string vs object comparison for JSON
  if (typeof referenceValue === 'string' && typeof value === 'object') {
    try {
      return JSON.parse(referenceValue);
    } catch {
      return referenceValue;
    }
  }

  return value;
}

export function areDatesEqual(value1: any, value2: any): boolean {
  if (!(value1 instanceof Date && value2 instanceof Date)) {
    return false;
  }
  
  // Allow up to 24 hours difference for timezone issues
  const timeDiff = Math.abs(value1.getTime() - value2.getTime());
  return timeDiff <= 86400000; // 24 hours in milliseconds
}

export function areObjectsEqual(value1: any, value2: any): boolean {
  if (typeof value1 !== 'object' || typeof value2 !== 'object' || value1 === null || value2 === null) {
    return false;
  }

  try {
    return JSON.stringify(value1) === JSON.stringify(value2);
  } catch {
    return false;
  }
}

export function areTimestampStringsEqual(value1: any, value2: any, columnName: string): boolean {
  if (typeof value1 !== 'string' || typeof value2 !== 'string') {
    return false;
  }

  // Only check timestamp columns
  if (!columnName.includes('_at') && !columnName.includes('date')) {
    return false;
  }

  try {
    const date1 = new Date(value1);
    const date2 = new Date(value2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return false;
    }
    
    const timeDiff = Math.abs(date1.getTime() - date2.getTime());
    return timeDiff <= 86400000; // 24 hour tolerance
  } catch {
    return false;
  }
}

export function areValuesEqual(value1: any, value2: any, columnName: string): boolean {
  // Exact equality
  if (value1 === value2) {
    return true;
  }

  // Both null/undefined
  if (value1 == null && value2 == null) {
    return true;
  }

  // Delegate to specific comparison methods
  if (areDatesEqual(value1, value2)) {
    return true;
  }

  if (areObjectsEqual(value1, value2)) {
    return true;
  }

  if (areTimestampStringsEqual(value1, value2, columnName)) {
    return true;
  }

  return false;
}

export function formatValueForDisplay(value: any): string {
  if (value == null) {
    return 'null';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function compareRowData(pgRow: DatabaseRow, mysqlRow: DatabaseRow, tableName: string): boolean {
  for (const [key, pgValue] of Object.entries(pgRow)) {
    const mysqlValue = mysqlRow[key];
    const normalizedMysqlValue = normalizeValue(mysqlValue, pgValue);

    // Handle special cases for comparison
    if (areValuesEqual(pgValue, normalizedMysqlValue, key)) {
      continue;
    }

    console.log(`❌ Data mismatch in ${tableName}.${key} for id ${pgRow.id}:`);
    console.log(`   PG: ${formatValueForDisplay(pgValue)} (${typeof pgValue})`);
    console.log(`   MySQL: ${formatValueForDisplay(normalizedMysqlValue)} (${typeof normalizedMysqlValue})`);
    return false;
  }
  return true;
}

export async function sampleDataValidation(
  connections: DatabaseConnections,
  tableName: string, 
  sampleSize: number = 5
): Promise<boolean> {
  console.log(`🔎 Validating sample data for table: ${tableName}`);

  try {
    // Get sample data from PostgreSQL
    const pgRows = await getSampleData(connections.pgClient, tableName, sampleSize);

    if (pgRows.length === 0) {
      console.log(`📭 No data in ${tableName} to validate`);
      return true;
    }

    // Get corresponding data from MySQL
    const ids = pgRows.map(row => row.id);
    const mysqlRows = await getCorrespondingMySQLData(connections.mysqlConnection, tableName, ids);

    // Compare data
    for (let i = 0; i < pgRows.length; i++) {
      const pgRow = pgRows[i]!;
      const mysqlRow = mysqlRows[i];

      if (!mysqlRow) {
        console.log(`❌ Missing row with id ${pgRow.id} in MySQL`);
        return false;
      }

      if (!compareRowData(pgRow, mysqlRow, tableName)) {
        return false;
      }
    }

    console.log(`✅ Sample data validation passed for ${tableName}`);
    return true;

  } catch (error) {
    console.error(`❌ Sample data validation failed for ${tableName}:`, (error as Error).message);
    return false;
  }
}

export async function getPostgresTableList(pgClient: Client): Promise<{ table_name: string }[]> {
  const pgTablesResult = await pgClient.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'strapi_%'
    ORDER BY table_name;
  `);

  console.log(`🔍 Found ${pgTablesResult.rows.length} PostgreSQL tables`);
  return pgTablesResult.rows as { table_name: string }[];
}

export async function getMysqlTableList(mysqlConnection: mysql.Connection): Promise<{ table_name: string }[]> {
  const mysqlDbName = config.getMysqlConfig().database;
  console.log(`🔍 Checking MySQL database: ${mysqlDbName}`);
  
  let showTablesError: Error | null = null;
  
  try {
    // First try using SHOW TABLES which is more reliable
    const [tablesResult] = await mysqlConnection.execute(`SHOW TABLES`) as [any[], any];
    
    if (tablesResult.length > 0) {
      // Convert SHOW TABLES result to standard format
      const firstRow = tablesResult[0];
      if (firstRow && typeof firstRow === 'object') {
        const tableKey = Object.keys(firstRow)[0];
        if (tableKey) {
          const mysqlTablesResult = tablesResult.map(row => ({
            table_name: row[tableKey] as string
          }));
          
          console.log(`🔍 Found ${mysqlTablesResult.length} MySQL tables`);
          if (mysqlTablesResult.length > 0) {
            console.log(`🔍 First few MySQL tables: ${mysqlTablesResult.slice(0, 5).map(t => t.table_name).join(', ')}`);
          }
          
          return mysqlTablesResult;
        }
      }
    }
    
    throw new Error('SHOW TABLES returned unexpected format');
  } catch (error) {
    showTablesError = error as Error;
    console.log(`⚠️ SHOW TABLES failed, trying information_schema: ${showTablesError.message}`);
  }
  
  // Fallback to information_schema
  try {
    const [mysqlTablesResult] = await mysqlConnection.execute(`
      SELECT TABLE_NAME as table_name
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME;
    `, [mysqlDbName]) as [{ table_name: string }[], any];

    console.log(`🔍 Found ${mysqlTablesResult.length} MySQL tables via information_schema`);
    
    if (mysqlTablesResult.length > 0) {
      console.log(`🔍 First few MySQL tables: ${mysqlTablesResult.slice(0, 5).map(t => t.table_name).join(', ')}`);
    } else {
      console.log(`⚠️ No tables found in database: ${mysqlDbName}`);
      await debugMysqlConnection(mysqlConnection);
    }

    return mysqlTablesResult;
  } catch (infoSchemaError) {
    console.error(`❌ Both SHOW TABLES and information_schema failed:`);
    console.error(`   SHOW TABLES error: ${showTablesError?.message || 'Unknown error'}`);
    console.error(`   information_schema error: ${(infoSchemaError as Error).message}`);
    
    await debugMysqlConnection(mysqlConnection);
    return [];
  }
}

export async function debugMysqlConnection(mysqlConnection: mysql.Connection): Promise<void> {
  try {
    const [databases] = await mysqlConnection.execute(`SHOW DATABASES;`) as [{ Database: string }[], any];
    console.log(`🔍 Available MySQL databases: ${databases.map(d => d.Database).join(', ')}`);
    
    const [tables] = await mysqlConnection.execute(`SHOW TABLES;`) as [any[], any];
    console.log(`🔍 Tables in current database (via SHOW TABLES): ${tables.length} found`);
    
    if (tables.length > 0) {
      const firstTable = tables[0];
      if (firstTable && typeof firstTable === 'object') {
        const tableKey = Object.keys(firstTable)[0];
        if (tableKey) {
          console.log(`🔍 First few tables: ${tables.slice(0, 5).map(t => t[tableKey]).join(', ')}`);
        }
      }
    }
  } catch (showError) {
    console.log(`🔍 Debug queries failed: ${(showError as Error).message}`);
  }
}

export function logMissingTables(missingInMySQL: string[]): void {
  if (missingInMySQL.length > 0) {
    console.log('ℹ️  Tables missing in MySQL (will be skipped in validation):');
    missingInMySQL.forEach(tableName => {
      console.log(`   • ${tableName}`);
    });
  }
}

export async function validateTableSchema(
  connections: DatabaseConnections,
  tableName: string,
  results: SchemaValidationResult[]
): Promise<boolean> {
  try {
    const pgStructureResult = await connections.pgClient.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    const [mysqlStructureRows] = await connections.mysqlConnection.execute(`
      SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, IS_NULLABLE as is_nullable
      FROM information_schema.columns
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION;
    `, [config.getMysqlConfig().database, tableName]) as [MySQLColumn[], any];

    console.log(`🔍 Checking schema for table: ${tableName}`);
    console.log(`   PostgreSQL columns: ${pgStructureResult.rows.length}`);
    console.log(`   MySQL columns: ${mysqlStructureRows.length}`);

    const pgColumns = pgStructureResult.rows as PostgresColumn[];
    let hasIssues = false;

    if (mysqlStructureRows.length === 0) {
      console.log(`❌ Table ${tableName} not found in MySQL or has no columns`);
      results.push({
        table: tableName,
        status: 'table_missing',
        issue: `Table ${tableName} not found in MySQL`
      });
      return true;
    }

    for (const pgCol of pgColumns) {
      const mysqlCol = mysqlStructureRows.find(col => 
        col.column_name.toLowerCase() === pgCol.column_name.toLowerCase()
      );
      
      if (!mysqlCol) {
        console.log(`❌ Column ${tableName}.${pgCol.column_name} missing in MySQL`);
        results.push({
          table: tableName,
          status: 'column_missing',
          issue: `Column ${pgCol.column_name} not found in MySQL`
        });
        hasIssues = true;
      } else {
        // Column exists, could validate data types here if needed
        console.log(`✅ Column ${tableName}.${pgCol.column_name} found in MySQL`);
      }
    }

    if (!hasIssues) {
      console.log(`✅ All columns validated for table: ${tableName}`);
    }

    return hasIssues;
  } catch (error) {
    console.error(`❌ Error validating schema for ${tableName}:`, (error as Error).message);
    results.push({
      table: tableName,
      status: 'error',
      issue: `Schema validation error: ${(error as Error).message}`
    });
    return true;
  }
}

export async function validateCommonTables(
  connections: DatabaseConnections,
  commonTables: string[]
): Promise<SchemaValidationResult[]> {
  const results: SchemaValidationResult[] = [];

  for (const tableName of commonTables) {
    try {
      const hasIssues = await validateTableSchema(connections, tableName, results);
      
      if (!hasIssues) {
        console.log(`✅ Schema validation passed for ${tableName}`);
        results.push({ table: tableName, status: 'ok' });
      }
    } catch (error) {
      console.error(`❌ Error validating schema for ${tableName}:`, (error as Error).message);
      results.push({
        table: tableName,
        status: 'error',
        issue: `Validation error: ${(error as Error).message}`
      });
    }
  }

  return results;
}

export async function validateSchema(connections: DatabaseConnections): Promise<SchemaValidationResult[]> {
  console.log('🔍 Validating schema structure...');

  const pgTablesResult = await getPostgresTableList(connections.pgClient);
  const mysqlTablesResult = await getMysqlTableList(connections.mysqlConnection);

  const pgTableNames = new Set(pgTablesResult.map((row: { table_name: string }) => row.table_name));
  const mysqlTableNames = new Set(mysqlTablesResult.map(row => row.table_name));

  const commonTables = Array.from(pgTableNames).filter(tableName => mysqlTableNames.has(tableName));
  const missingInMySQL = Array.from(pgTableNames).filter(tableName => !mysqlTableNames.has(tableName));

  console.log(`📊 Found ${commonTables.length} common tables, ${missingInMySQL.length} missing in MySQL`);

  logMissingTables(missingInMySQL);

  return await validateCommonTables(connections, commonTables);
}

export interface ValidationResults {
  isValid: boolean;
  tableCounts: TableCountResult[];
  schemaValidation: SchemaValidationResult[];
  sampleDataResults: { table: string; isValid: boolean }[];
  summary: {
    totalTables: number;
    tablesWithMatchingCounts: number;
    tablesWithValidSchema: number;
    tablesWithValidSampleData: number;
  };
}

export async function runValidation(): Promise<ValidationResults> {
  const connections = await createConnections();
  
  try {
    console.log('🔍 Starting migration validation...');
    console.log('=====================================');

    // Validate table counts
    const countResults = await validateTableCounts(connections);
    console.log('');

    // Validate schema structure
    const schemaResults = await validateSchema(connections);
    console.log('');

    // Validate sample data for each table
    console.log('🔎 Validating sample data...');
    const sampleDataResults: { table: string; isValid: boolean }[] = [];
    const tablesWithData = countResults.filter(r => r.match && typeof r.postgresCount === 'number' && r.postgresCount > 0).map(r => r.table);
    
    for (const tableName of tablesWithData.slice(0, 5)) { // Validate first 5 tables
      const isValid = await sampleDataValidation(connections, tableName);
      sampleDataResults.push({ table: tableName, isValid });
    }

    console.log('');
    console.log('=====================================');
    console.log('📊 Validation Summary:');

    const successfulCounts = countResults.filter(r => r.match).length;
    const totalTables = countResults.length;
    const successfulSchema = schemaResults.filter(r => r.status === 'ok').length;
    const totalValidatedTables = schemaResults.length;
    const successfulSampleData = sampleDataResults.filter(r => r.isValid).length;

    console.log(`Row counts: ${successfulCounts}/${totalTables} tables match`);
    console.log(`Schema validation: ${successfulSchema}/${totalValidatedTables} tables validated`);
    console.log(`Sample data validation: ${successfulSampleData}/${sampleDataResults.length} tables validated`);

    const isValid = successfulCounts === totalTables && 
                   (totalValidatedTables === 0 || successfulSchema === totalValidatedTables) &&
                   (sampleDataResults.length === 0 || successfulSampleData === sampleDataResults.length);

    if (isValid) {
      console.log('🎉 All validations passed! Migration appears successful.');
    } else {
      console.log('⚠️  Some validations failed. Please review the results above.');
      console.log(`ℹ️  Note: Tables missing in MySQL are excluded from schema validation.`);
    }

    return {
      isValid,
      tableCounts: countResults,
      schemaValidation: schemaResults,
      sampleDataResults,
      summary: {
        totalTables,
        tablesWithMatchingCounts: successfulCounts,
        tablesWithValidSchema: successfulSchema,
        tablesWithValidSampleData: successfulSampleData
      }
    };

  } catch (error) {
    console.error('💥 Validation failed:', (error as Error).message);
    console.error((error as Error).stack);
    throw error;
  } finally {
    await closeConnections(connections);
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  runValidation().catch(console.error);
}
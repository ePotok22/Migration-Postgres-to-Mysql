import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import config from './config';
import { createConnections, closeConnections, DatabaseConnections } from './database';
import { 
  PostgresTableStructure, 
  TableStructureGroup, 
  ValidationResult, 
  MigrationReport 
} from './types/validate.type';

export async function getPostgresTableStructure(pgClient: Client): Promise<PostgresTableStructure[]> {
  const query = `
    SELECT
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name NOT LIKE 'strapi_%'
    ORDER BY table_name, ordinal_position;
  `;

  const result = await pgClient.query(query);
  return result.rows as PostgresTableStructure[];
}

export async function getPostgresTables(pgClient: Client): Promise<string[]> {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'strapi_%'
    ORDER BY table_name;
  `;

  const result = await pgClient.query(query);
  return result.rows.map((row: { table_name: string }) => row.table_name);
}

export function mapPostgresToMysqlType(
  pgType: string, 
  maxLength: number | null = null, 
  precision: number | null = null, 
  scale: number | null = null
): string {
  const typeMap: Record<string, string> = {
    'bigint': 'BIGINT',
    'integer': 'INT',
    'smallint': 'SMALLINT',
    'boolean': 'BOOLEAN',
    'text': 'TEXT',
    'character varying': maxLength ? `VARCHAR(${maxLength})` : 'TEXT',
    'varchar': maxLength ? `VARCHAR(${maxLength})` : 'TEXT',
    'timestamp without time zone': 'DATETIME',
    'timestamp with time zone': 'DATETIME',
    'date': 'DATE',
    'time': 'TIME',
    'decimal': precision && scale ? `DECIMAL(${precision},${scale})` : 'DECIMAL(10,2)',
    'numeric': precision && scale ? `DECIMAL(${precision},${scale})` : 'DECIMAL(10,2)',
    'real': 'FLOAT',
    'double precision': 'DOUBLE',
    'json': 'JSON',
    'jsonb': 'JSON',
    'uuid': 'VARCHAR(36)',
    'bytea': 'LONGBLOB'
  };

  return typeMap[pgType] || 'TEXT';
}

export async function createMysqlSchema(connections: DatabaseConnections): Promise<void> {
  console.log('🔄 Creating MySQL schema...');

  const tables = await getPostgresTables(connections.pgClient);
  const structure = await getPostgresTableStructure(connections.pgClient);

  // Group columns by table
  const tableStructures: TableStructureGroup = {};
  structure.forEach(col => {
    tableStructures[col.table_name] ??= [];
    tableStructures[col.table_name]!.push(col);
  });

  for (const tableName of tables) {
    console.log(`📝 Creating table: ${tableName}`);

    const tableStructure = tableStructures[tableName];
    if (!tableStructure) {
      console.log(`⚠️  No structure found for table ${tableName}, skipping...`);
      continue;
    }

    // Drop table if exists
    await connections.mysqlConnection.execute(`DROP TABLE IF EXISTS \`${tableName}\`;`);

    // Build CREATE TABLE statement
    const columns = tableStructure.map(col => {
      const mysqlType = mapPostgresToMysqlType(
        col.data_type,
        col.character_maximum_length,
        col.numeric_precision,
        col.numeric_scale
      );

      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultValue = col.column_default ?
        (col.column_default.includes('nextval') ? 'AUTO_INCREMENT' : `DEFAULT ${col.column_default}`) : '';

      return `\`${col.column_name}\` ${mysqlType} ${nullable} ${defaultValue}`.trim();
    });

    // Add primary key (assuming 'id' column exists)
    const hasIdColumn = tableStructure.some(col => col.column_name === 'id');
    if (hasIdColumn) {
      columns.push('PRIMARY KEY (`id`)');
    }

    const createTableSQL = `
      CREATE TABLE \`${tableName}\` (
        ${columns.join(',\n  ')}
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      await connections.mysqlConnection.execute(createTableSQL);
      console.log(`✅ Created table: ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to create table ${tableName}:`, (error as Error).message);
      console.log('SQL:', createTableSQL);
    }
  }
}

export async function migrateData(connections: DatabaseConnections): Promise<void> {
  console.log('🔄 Migrating data...');

  const tables = await getPostgresTables(connections.pgClient);

  for (const tableName of tables) {
    console.log(`📊 Migrating data for table: ${tableName}`);

    try {
      // Get data from PostgreSQL
      const pgResult = await connections.pgClient.query(`SELECT * FROM "${tableName}" ORDER BY id`);
      const rows = pgResult.rows as Record<string, any>[];

      if (rows.length === 0) {
        console.log(`📭 No data to migrate for table: ${tableName}`);
        continue;
      }

      console.log(`📦 Found ${rows.length} rows in ${tableName}`);

      // Disable foreign key checks temporarily
      await connections.mysqlConnection.execute('SET FOREIGN_KEY_CHECKS = 0;');

      // Get column names
      const columns = Object.keys(rows[0]!);
      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.map(col => `\`${col}\``).join(', ');

      const insertSQL = `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${placeholders})`;

      // Insert data in batches
      const batchSize = config.getMigrationConfig().batchSize;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        for (const row of batch) {
          const values = columns.map(col => {
            let value = row[col];

            // Handle special data types
            if (value === null || value === undefined) {
              return null;
            }

            // Convert boolean values
            if (typeof value === 'boolean') {
              return value ? 1 : 0;
            }

            // Convert dates
            if (value instanceof Date) {
              return value.toISOString().slice(0, 19).replace('T', ' ');
            }

            // Convert JSON objects
            if (typeof value === 'object') {
              return JSON.stringify(value);
            }

            return value;
          });

          await connections.mysqlConnection.execute(insertSQL, values);
        }

        console.log(`✅ Migrated ${Math.min(i + batchSize, rows.length)}/${rows.length} rows for ${tableName}`);
      }

      // Re-enable foreign key checks
      await connections.mysqlConnection.execute('SET FOREIGN_KEY_CHECKS = 1;');

      console.log(`✅ Completed migration for table: ${tableName}`);

    } catch (error) {
      console.error(`❌ Failed to migrate data for ${tableName}:`, (error as Error).message);
    }
  }
}

export async function validateMigration(connections: DatabaseConnections): Promise<ValidationResult[]> {
  console.log('🔍 Validating migration...');

  const tables = await getPostgresTables(connections.pgClient);
  const validationResults: ValidationResult[] = [];

  for (const tableName of tables) {
    try {
      // Count rows in both databases
      const pgCountResult = await connections.pgClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const pgCount = parseInt((pgCountResult.rows[0] as { count: string }).count);

      const [mysqlCountResult] = await connections.mysqlConnection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      const mysqlCount = (mysqlCountResult as any[])[0].count as number;

      const isValid = pgCount === mysqlCount;
      validationResults.push({
        table: tableName,
        postgresCount: pgCount,
        mysqlCount: mysqlCount,
        isValid: isValid
      });

      console.log(`${isValid ? '✅' : '❌'} ${tableName}: PG=${pgCount}, MySQL=${mysqlCount}`);

    } catch (error) {
      console.error(`❌ Validation failed for ${tableName}:`, (error as Error).message);
      validationResults.push({
        table: tableName,
        postgresCount: 'ERROR',
        mysqlCount: 'ERROR',
        isValid: false,
        error: (error as Error).message
      });
    }
  }

  return validationResults;
}

export async function generateReport(validationResults: ValidationResult[]): Promise<MigrationReport> {
  const report: MigrationReport = {
    migrationDate: new Date().toISOString(),
    totalTables: validationResults.length,
    successfulTables: validationResults.filter(r => r.isValid).length,
    failedTables: validationResults.filter(r => !r.isValid).length,
    tables: validationResults
  };

  // Ensure reports directory exists
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📋 Migration report saved to: ${reportPath}`);
  return report;
}

export async function runMigration(): Promise<void> {
  const connections = await createConnections();
  
  try {
    console.log('🚀 Starting PostgreSQL to MySQL migration...');
    console.log('=====================================');

    // Create MySQL schema
    await createMysqlSchema(connections);
    console.log('');

    // Migrate data
    await migrateData(connections);
    console.log('');

    // Validate migration
    const validationResults = await validateMigration(connections);
    console.log('');

    // Generate report
    const report = await generateReport(validationResults);

    console.log('=====================================');
    console.log('🎉 Migration completed!');
    console.log(`📊 Summary: ${report.successfulTables}/${report.totalTables} tables migrated successfully`);

    if (report.failedTables > 0) {
      console.log('⚠️  Some tables had issues. Check the migration report for details.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', (error as Error).message);
    console.error((error as Error).stack);
  } finally {
    await closeConnections(connections);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration().catch(console.error);
}
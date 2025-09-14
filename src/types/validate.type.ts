// Common type definitions for the migration project

export interface MySQLConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

export interface PostgresTableStructure {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export interface PostgresColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface MySQLColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface TableStructureGroup {
  [tableName: string]: PostgresTableStructure[];
}

export interface ValidationResult {
  table: string;
  postgresCount: number | string;
  mysqlCount: number | string;
  isValid: boolean;
  error?: string;
}

export interface MigrationReport {
  migrationDate: string;
  totalTables: number;
  successfulTables: number;
  failedTables: number;
  tables: ValidationResult[];
}

export interface TableCountResult {
  table: string;
  postgresCount: number | string;
  mysqlCount: number | string;
  match: boolean;
  error?: string;
}

export interface SchemaValidationResult {
  table: string;
  status: 'ok' | 'missing' | 'column_missing' | 'table_missing' | 'error';
  issue?: string;
}

export interface DatabaseRow {
  [key: string]: any;
  id: number;
}
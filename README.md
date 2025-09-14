# PostgreSQL to MySQL Migration Tool

A TypeScript-based migration tool that transfers data from PostgreSQL to MySQL databases with comprehensive validation.

## Features

- **Functional Architecture**: Clean, modular functions instead of classes
- **Schema Migration**: Automatically converts PostgreSQL schemas to MySQL
- **Data Migration**: Transfers data with proper type conversions
- **Validation**: Comprehensive validation of row counts, schema structure, and sample data
- **Environment Configuration**: Secure configuration via environment variables
- **TypeScript**: Full type safety and modern TypeScript features

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env` and fill in your database credentials:
   ```bash
   cp .env.example .env
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run migration**:
   ```bash
   npm run migrate
   ```

5. **Validate migration**:
   ```bash
   npm run validate
   ```

## Functional API

### Migration Functions

```typescript
import { runMigration, createMysqlSchema, migrateData } from './src/migrate';

// Run complete migration
await runMigration();

// Or use individual functions
const connections = await createConnections();
await createMysqlSchema(connections);
await migrateData(connections);
await closeConnections(connections);
```

### Validation Functions

```typescript
import { runValidation, validateTableCounts, validateSchema } from './src/validate';

// Run complete validation
await runValidation();

// Or use individual functions
const connections = await createConnections();
const countResults = await validateTableCounts(connections);
const schemaResults = await validateSchema(connections);
await closeConnections(connections);
```

### Database Connection Utilities

```typescript
import { createConnections, closeConnections, executeWithConnections } from './src/database';

// Manual connection management
const connections = await createConnections();
// ... use connections
await closeConnections(connections);

// Automatic connection management
await executeWithConnections(async (connections) => {
  // Your code here
});
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# PostgreSQL (Source Database)
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_USER=your-postgres-user
POSTGRES_PASSWORD=your-postgres-password
POSTGRES_DATABASE=your-postgres-database
POSTGRES_SSL=true

# MySQL (Target Database)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=your-mysql-database

# Migration Configuration
BATCH_SIZE=1000
MAX_RETRIES=3
RETRY_DELAY=1000
LOG_LEVEL=info

# Environment
NODE_ENV=development
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run migrate` - Run the migration process
- `npm run validate` - Run validation on existing migration
- `npm run clean` - Remove compiled files
- `npm run build:watch` - Watch for changes and rebuild

## Development

For development, you can use ts-node for faster iteration:

```bash
# Run migration in development
npm run migrate:dev

# Run validation in development
npm run validate:dev
```

## Architecture

The tool is built with a functional architecture:

- **`src/database.ts`**: Shared database connection utilities
- **`src/migrate.ts`**: Migration functions (schema creation, data transfer)
- **`src/validate.ts`**: Validation functions (counts, schema, data sampling)
- **`src/config.ts`**: Environment configuration management
- **`src/types.ts`**: TypeScript type definitions

## Type Mapping

PostgreSQL types are automatically mapped to MySQL equivalents:

| PostgreSQL | MySQL |
|------------|-------|
| `bigint` | `BIGINT` |
| `integer` | `INT` |
| `boolean` | `BOOLEAN` |
| `text` | `TEXT` |
| `varchar(n)` | `VARCHAR(n)` |
| `timestamp` | `DATETIME` |
| `json`/`jsonb` | `JSON` |
| `uuid` | `VARCHAR(36)` |

## Error Handling

The tool includes comprehensive error handling:

- Database connection failures
- Schema creation errors
- Data migration errors with batch retry logic
- Validation failures with detailed reporting

## Migration Reports

Migration results are saved to `reports/migration-report.json` with detailed information about:

- Migration timestamp
- Table counts (successful/failed)
- Individual table results
- Error messages for failed operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes using the functional architecture
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
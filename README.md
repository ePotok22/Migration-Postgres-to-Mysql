# 🚀 PostgreSQL to MySQL Migration Tool

A robust TypeScript-based migration tool designed to transfer data from PostgreSQL to MySQL databases with comprehensive validation, reporting, and monitoring capabilities.

## ✨ Features

- **🔄 Complete Database Migration**: Seamlessly migrate schema and data from PostgreSQL to MySQL
- **🏗️ Automatic Schema Conversion**: Intelligent PostgreSQL to MySQL data type mapping
- **📊 Comprehensive Reporting**: Generate detailed HTML, JSON, and Markdown reports
- **✅ Multi-level Validation**: Schema validation, row count verification, and sample data validation
- **⚡ Performance Optimized**: Batch processing with configurable batch sizes and connection pooling
- **🔍 Real-time Monitoring**: Progress tracking with detailed logging and performance metrics
- **🛡️ Error Handling**: Robust error handling with retry mechanisms and detailed error reporting
- **🎯 Flexible Configuration**: Environment-based configuration with validation

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [Features Details](#features-details)
- [Reports](#reports)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🔧 Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **PostgreSQL**: Source database
- **MySQL**: Target database (5.7+ or 8.0+)
- **Network Access**: Connectivity to both databases

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd migration
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

## ⚙️ Configuration

Create a `.env` file in the project root with the following configuration:

```env
# PostgreSQL Configuration (Source Database)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_pg_user
POSTGRES_PASSWORD=your_pg_password
POSTGRES_DATABASE=your_pg_database
POSTGRES_SSL=false

# MySQL Configuration (Target Database)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_mysql_database
MYSQL_SSL=false

# Migration Settings
BATCH_SIZE=1000
MAX_RETRIES=3
RETRY_DELAY=1000
LOG_LEVEL=info

# Environment
NODE_ENV=development
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_HOST` | PostgreSQL server hostname | `localhost` | ✅ |
| `POSTGRES_PORT` | PostgreSQL server port | `5432` | ❌ |
| `POSTGRES_USER` | PostgreSQL username | - | ✅ |
| `POSTGRES_PASSWORD` | PostgreSQL password | - | ✅ |
| `POSTGRES_DATABASE` | PostgreSQL database name | - | ✅ |
| `POSTGRES_SSL` | Enable SSL for PostgreSQL | `false` | ❌ |
| `MYSQL_HOST` | MySQL server hostname | `localhost` | ✅ |
| `MYSQL_PORT` | MySQL server port | `3306` | ❌ |
| `MYSQL_USER` | MySQL username | - | ✅ |
| `MYSQL_PASSWORD` | MySQL password | - | ✅ |
| `MYSQL_DATABASE` | MySQL database name | - | ✅ |
| `MYSQL_SSL` | Enable SSL for MySQL | `false` | ❌ |
| `BATCH_SIZE` | Records per batch | `1000` | ❌ |
| `MAX_RETRIES` | Maximum retry attempts | `3` | ❌ |
| `RETRY_DELAY` | Delay between retries (ms) | `1000` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |

## 🚀 Usage

### Development Mode

```bash
# Run complete migration
npm run migrate:dev

# Run validation only
npm run validate:dev

# Generate reports
npm run report:dev
```

### Production Mode

```bash
# Build and run migration
npm run migrate

# Build and run validation
npm run validate

# Generate production report
npm run report
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:watch` | Watch mode compilation |
| `npm run migrate` | Run full migration (production) |
| `npm run migrate:dev` | Run migration in development mode |
| `npm run validate` | Run validation (production) |
| `npm run validate:dev` | Run validation in development mode |
| `npm run report` | Generate comprehensive reports |
| `npm run report:dev` | Generate reports in development mode |
| `npm run type-check` | Run TypeScript type checking |

## 🔍 Features Details

### Schema Migration

The tool automatically:
- Maps PostgreSQL data types to MySQL equivalents
- Creates tables with proper column definitions
- Handles constraints and indexes
- Manages foreign key relationships
- Converts special data types (JSON, UUID, etc.)

#### Data Type Mapping

| PostgreSQL Type | MySQL Type | Notes |
|----------------|------------|--------|
| `bigint` | `BIGINT` | - |
| `integer` | `INT` | - |
| `boolean` | `BOOLEAN` | Converted from true/false to 1/0 |
| `text` | `TEXT` | - |
| `varchar(n)` | `VARCHAR(n)` | Preserves length constraints |
| `timestamp` | `DATETIME` | Timezone handling |
| `json/jsonb` | `JSON` | MySQL 5.7+ required |
| `uuid` | `VARCHAR(36)` | - |
| `decimal(p,s)` | `DECIMAL(p,s)` | Preserves precision and scale |

### Data Migration

- **Batch Processing**: Configurable batch sizes for optimal performance
- **Progress Tracking**: Real-time migration progress with ETA calculations
- **Error Recovery**: Continues migration even if individual tables fail
- **Data Transformation**: Handles special cases like boolean conversion and JSON serialization

### Validation System

#### 1. Row Count Validation
Compares record counts between source and target databases:
```typescript
// Example validation result
{
  table: "users",
  postgresCount: 1000,
  mysqlCount: 1000,
  match: true
}
```

#### 2. Schema Validation
Verifies table and column structures:
- Table existence
- Column presence
- Data type compatibility

#### 3. Sample Data Validation
Validates actual data integrity by comparing sample records:
- Handles data type conversions
- Timestamp tolerance (24-hour window)
- JSON object comparison
- Null value handling

## 📊 Reports

The tool generates three types of reports:

### 1. JSON Report
Machine-readable detailed report with all metrics and data.

### 2. HTML Report
Interactive web report with:
- Migration overview dashboard
- Database information comparison
- Detailed table results
- Performance metrics
- Issue identification and recommendations

### 3. Markdown Report
Human-readable report perfect for documentation and sharing.

### Report Contents

- **Migration Overview**: Success rates, record counts, performance metrics
- **Database Information**: Version details, table counts, database sizes
- **Table Details**: Individual table migration status and throughput
- **Issues & Recommendations**: Identified problems with suggested solutions
- **Performance Metrics**: Throughput, memory usage, bottlenecks

### Sample Report Structure

```
📊 Migration Overview
├── Tables Migrated: 88/88 (100%)
├── Total Records: 5,234 records
├── Average Throughput: 1,250 records/sec
└── Peak Memory Usage: 245 MB

🗄️ Database Information
├── Source: PostgreSQL 16.9 (22 MB, 101 tables)
└── Target: MySQL 8.0.43 (6.39 MB, 88 tables)

💡 Recommendations
├── ✅ Migration completed successfully
├── 📋 Update application connection strings
└── 💾 Keep PostgreSQL as backup
```

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build verification
npm run build
```

## 🐛 Troubleshooting

### Common Issues

#### Connection Errors
```
❌ Connection failed: connect ECONNREFUSED
```
**Solution**: Verify database credentials and network connectivity.

#### Schema Issues
```
❌ Failed to create table: Unknown column type
```
**Solution**: Check data type mapping and update `mapPostgresToMysqlType` function if needed.

#### Performance Issues
```
⚠️ Low throughput detected: <100 records/sec
```
**Solutions**:
- Increase `BATCH_SIZE` for larger tables
- Optimize network connection
- Check database server resources

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

### Logs Location

- **Application Logs**: `logs/report-generation.log`
- **Migration Reports**: `reports/`

## 🏗️ Architecture

```
src/
├── config.ts           # Configuration management
├── database.ts         # Database connection handling
├── migrate.ts          # Main migration logic
├── validate.ts         # Validation system
├── report-generator.ts # Report generation
├── performance.ts      # Performance monitoring
├── logger.ts          # Logging system
└── types/             # TypeScript type definitions
    ├── validate.type.ts
    └── report.type.ts
```

## 🔒 Security Considerations

- Store database credentials securely using environment variables
- Use SSL connections for production environments
- Limit database user permissions to required operations only
- Regularly rotate database passwords
- Monitor and log all migration activities

## 📈 Performance Tips

1. **Optimize Batch Size**: Start with 1000, adjust based on table size and network latency
2. **Use Connection Pooling**: Built-in connection pooling optimizes database connections
3. **Monitor Memory Usage**: Large tables may require memory optimization
4. **Network Optimization**: Ensure good network connectivity between databases
5. **Index Management**: Consider temporarily dropping indexes during migration for better performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode requirements
- Add comprehensive error handling
- Include logging for debugging
- Update type definitions for new features
- Test with different database configurations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with TypeScript for type safety and better development experience
- Uses industry-standard database drivers (`pg` for PostgreSQL, `mysql2` for MySQL)
- Designed for production environments with enterprise-grade features

---

## 🆘 Support

If you encounter any issues or need help:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the generated logs in `logs/`
3. Examine the migration reports in `reports/`
4. Create an issue with detailed error information

**Happy migrating! 🚀**
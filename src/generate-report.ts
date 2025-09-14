#!/usr/bin/env ts-node

import 'dotenv/config';
import { generateMigrationReport } from './report-generator';
import { Logger } from './logger';

async function main(): Promise<void> {
  const logger = new Logger({ level: 'info', enableFile: false });
  
  try {
    logger.info('🚀 Generating comprehensive migration report...');
    
    const report = await generateMigrationReport();
    
    logger.info('✅ Report generation completed successfully!');
    logger.info(`📊 Migration Summary:`);
    logger.info(`   • Tables: ${report.migration.tablesSuccessful}/${report.migration.tablesProcessed} successful`);
    logger.info(`   • Records: ${report.migration.recordsMigrated.toLocaleString()} migrated`);
    logger.info(`   • Success Rate: ${report.migration.successRate}%`);
    logger.info(`   • Duration: ${Math.round(report.duration / 1000)}s`);
    logger.info(`   • Throughput: ${report.performance.averageRecordsPerSecond.toLocaleString()} records/sec`);
    
    if (report.issues.length > 0) {
      logger.info(`⚠️  ${report.issues.length} issues identified - check the detailed report`);
    }
    
    logger.info('📄 Reports have been saved to the reports/ directory');
    
  } catch (error) {
    logger.error('❌ Failed to generate migration report', error as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
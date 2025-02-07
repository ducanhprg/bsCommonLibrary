import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { getCache, setCache } from '@shared/utils/RedisClient';

export const mainDataSource = new DataSource({
  type: 'mysql',
  host: process.env.MAIN_DB_HOST || 'localhost',
  port: Number(process.env.MAIN_DB_PORT) || 3306,
  username: process.env.MAIN_DB_USER || 'root',
  password: process.env.MAIN_DB_PASSWORD || 'password',
  database: process.env.MAIN_DB_NAME || 'main_db',
  synchronize: false, // Disable in production
  logging: false,
  entities: ['src/infrastructure/database/main/entities/**/*.ts'],
  extra: {
    connectionLimit: 10, // Connection pool size
  },
} as DataSourceOptions);

const multiTenantBaseConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.MT_DB_HOST || 'localhost',
  port: Number(process.env.MT_DB_PORT) || 3306,
  username: process.env.MT_DB_USER || 'root',
  password: process.env.MT_DB_PASSWORD || 'password',
  synchronize: false,
  logging: false,
  entities: ['src/infrastructure/database/multi-tenant/entities/**/*.ts'],
  extra: {
    connectionLimit: 5, // Connection pool size for each tenant
  },
};

export const getTenantDataSource = async (vendorDatabase: string): Promise<DataSource> => {
  const cacheKey = `tenant:${vendorDatabase}`;
  const cachedDataSourceOptions = await getCache(cacheKey);

  if (cachedDataSourceOptions) {
    console.log(`Using cached configuration for tenant: ${vendorDatabase}`);
    const dataSource = new DataSource(JSON.parse(cachedDataSourceOptions) as DataSourceOptions);

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log(`Reconnected to tenant database: ${vendorDatabase}`);
    }

    return dataSource;
  }

  const dataSourceOptions: DataSourceOptions = {
    ...multiTenantBaseConfig,
    database: vendorDatabase,
  };

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  console.log(`Connected to tenant database: ${vendorDatabase}`);

  await setCache(cacheKey, JSON.stringify(dataSourceOptions), 60 * 60 * 24); // Cache for 24 hours

  return dataSource;
};

export const closeTenantConnections = async (): Promise<void> => {
  console.log('No in-memory tenant connections to close. Redis manages configurations.');
};

export const initializeMainDatabase = async (): Promise<void> => {
  if (!mainDataSource.isInitialized) {
    await mainDataSource.initialize();
    console.log('Connected to the Main database.');
  }
};

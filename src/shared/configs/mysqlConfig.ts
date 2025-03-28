import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { getDataByKey, setDataByKey } from '@shared/utils/RedisClient';

const MAX_TENANT_CONNECTIONS = 50;
const SOFT_CONNECTION_LIMIT = 55;

const tenantConnections: Map<string, DataSource> = new Map();
const connectionLRU: string[] = [];
const SERVICE_ID = process.env.SERVICE_ID || `service-${Math.random().toString(36).substring(2, 9)}`;

export const mainDataSource = new DataSource({
  type: 'mysql',
  host: process.env.MAIN_DB_HOST || 'localhost',
  port: Number(process.env.MAIN_DB_PORT) || 3306,
  username: process.env.MAIN_DB_USER || 'root',
  password: process.env.MAIN_DB_PASSWORD || 'password',
  database: process.env.MAIN_DB_NAME || 'main_db',
  synchronize: false,
  logging: false,
  entities: ['src/infrastructure/database/main/models/**/*.ts', 'src/shared/database/models/**/*.ts'],
  extra: { connectionLimit: 10 },
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
  extra: { connectionLimit: 5 },
};

const isConnectionHealthy = async (dataSource: DataSource): Promise<boolean> => {
  try {
    await dataSource.query('SELECT 1');
    return true;
  } catch (error) {
    console.error(`Connection health check failed for database: ${error.message}`);
    return false;
  }
};

const updateLRUOrder = (databaseName: string): void => {
  const index = connectionLRU.indexOf(databaseName);
  if (index !== -1) {
    connectionLRU.splice(index, 1);
  }
  connectionLRU.push(databaseName);
};

const evictLeastRecentlyUsed = async (maxAttempts: number = 3): Promise<boolean> => {
  let attempts = 0;
  while (attempts < maxAttempts && connectionLRU.length > 0) {
    const leastRecentlyUsed = connectionLRU.shift();
    if (!leastRecentlyUsed) return false;

    const dataSource = tenantConnections.get(leastRecentlyUsed);
    if (!dataSource) return false;

    try {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        console.log(`Evicted least recently used connection: ${leastRecentlyUsed}`);
      }
      tenantConnections.delete(leastRecentlyUsed);
      await setDataByKey(`tenant-connection:${SERVICE_ID}:${leastRecentlyUsed}`, 'evicted', 10);
      return true;
    } catch (error) {
      console.error(`Failed to evict connection ${leastRecentlyUsed} (attempt ${attempts + 1}):`, error);
      attempts++;
    }
  }
  return false;
};

const initializeDataSourceWithRetry = async (
  dataSourceOptions: DataSourceOptions,
  vendorDatabase: string,
  maxRetries = 3
): Promise<DataSource> => {
  const dataSource = new DataSource(dataSourceOptions);
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await dataSource.initialize();
      return dataSource;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        console.error(`Failed to initialize connection to ${vendorDatabase} after ${maxRetries} attempts`);
        throw error;
      }
      console.warn(`Connection attempt ${retries} failed for ${vendorDatabase}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  throw new Error(`Failed to initialize connection to ${vendorDatabase}`);
};

export const getTenantDataSource = async (vendorDatabase: string): Promise<DataSource> => {
  try {
    if (!vendorDatabase || typeof vendorDatabase !== 'string') {
      throw new Error('Invalid vendor database name');
    }

    if (tenantConnections.has(vendorDatabase)) {
      const existingDataSource = tenantConnections.get(vendorDatabase)!;
      if (existingDataSource.isInitialized) {
        if (await isConnectionHealthy(existingDataSource)) {
          updateLRUOrder(vendorDatabase);
          await setDataByKey(`tenant-connection:${SERVICE_ID}:${vendorDatabase}`, 'active', 60);
          return existingDataSource;
        } else {
          try {
            await existingDataSource.destroy();
          } catch (e) {
            console.warn(`Failed to properly close unhealthy connection: ${e.message}`);
          }
          tenantConnections.delete(vendorDatabase);
          const index = connectionLRU.indexOf(vendorDatabase);
          if (index !== -1) {
            connectionLRU.splice(index, 1);
          }
        }
      } else {
        tenantConnections.delete(vendorDatabase);
        const index = connectionLRU.indexOf(vendorDatabase);
        if (index !== -1) {
          connectionLRU.splice(index, 1);
        }
      }
    }

    if (tenantConnections.size >= MAX_TENANT_CONNECTIONS) {
      await evictLeastRecentlyUsed();
      if (tenantConnections.size >= SOFT_CONNECTION_LIMIT) {
        console.warn(`Connection limit exceeded: ${tenantConnections.size} connections active`);
      }
    }

    const configCacheKey = `tenant-config:${vendorDatabase}`;
    const cachedDataSourceOptions = await getDataByKey(configCacheKey);
    let dataSourceOptions: DataSourceOptions;

    if (cachedDataSourceOptions) {
      try {
        dataSourceOptions = JSON.parse(cachedDataSourceOptions) as DataSourceOptions;
      } catch (error) {
        console.error(`Invalid cached config for ${vendorDatabase}:`, error);
        dataSourceOptions = { ...multiTenantBaseConfig, database: vendorDatabase };
      }
    } else {
      dataSourceOptions = { ...multiTenantBaseConfig, database: vendorDatabase };
      await setDataByKey(configCacheKey, JSON.stringify(dataSourceOptions), 60 * 60 * 24);
    }

    const dataSource = await initializeDataSourceWithRetry(dataSourceOptions, vendorDatabase);
    console.log(`Service ${SERVICE_ID} connected to tenant database: ${vendorDatabase}`);
    
    tenantConnections.set(vendorDatabase, dataSource);
    updateLRUOrder(vendorDatabase);
    await setDataByKey(`tenant-connection:${SERVICE_ID}:${vendorDatabase}`, 'active', 60);
    
    return dataSource;
  } catch (error) {
    console.error(`Failed to initialize tenant ${vendorDatabase}:`, error);
    throw error;
  }
};

const refreshConnectionStatus = async () => {
  try {
    const staleConnections: string[] = [];
    for (const [tenant, dataSource] of tenantConnections.entries()) {
      if (dataSource.isInitialized) {
        if (await isConnectionHealthy(dataSource)) {
          await setDataByKey(`tenant-connection:${SERVICE_ID}:${tenant}`, 'active', 60);
        } else {
          staleConnections.push(tenant);
        }
      } else {
        staleConnections.push(tenant);
      }
    }

    for (const tenant of staleConnections) {
      const dataSource = tenantConnections.get(tenant);
      if (dataSource && dataSource.isInitialized) {
        try {
          await dataSource.destroy();
        } catch (error) {
          console.error(`Error closing stale connection for ${tenant}:`, error);
        }
      }
      tenantConnections.delete(tenant);
      const index = connectionLRU.indexOf(tenant);
      if (index !== -1) {
        connectionLRU.splice(index, 1);
      }
      console.log(`Removed stale connection for tenant: ${tenant}`);
    }
  } catch (error) {
    console.error('Failed to refresh connection status:', error);
  }
};

export const optimizeConnectionPool = async (): Promise<void> => {
  try {
    if (tenantConnections.size > MAX_TENANT_CONNECTIONS * 0.8) {
      console.log(`Connection pool optimization triggered: ${tenantConnections.size}/${MAX_TENANT_CONNECTIONS}`);
      const connectionsToEvict = Math.max(2, Math.floor(MAX_TENANT_CONNECTIONS * 0.1));
      let evicted = 0;
      for (let i = 0; i < connectionsToEvict; i++) {
        if (await evictLeastRecentlyUsed()) {
          evicted++;
        }
      }
      console.log(`Connection pool optimization complete: ${evicted} connections evicted`);
    }
  } catch (error) {
    console.error('Failed to optimize connection pool:', error);
  }
};

if (typeof globalThis !== 'undefined' && typeof setInterval !== 'undefined') {
  setInterval(refreshConnectionStatus, 30000);
  setInterval(optimizeConnectionPool, 300000); // Every 5 minutes
}

export const closeTenantConnections = async (): Promise<void> => {
  const closePromises: Promise<void>[] = [];
  try {
    for (const [tenant, dataSource] of tenantConnections.entries()) {
      if (dataSource.isInitialized) {
        console.log(`Service ${SERVICE_ID} closing connection to tenant database: ${tenant}`);
        closePromises.push(dataSource.destroy());
        await setDataByKey(`tenant-connection:${SERVICE_ID}:${tenant}`, 'closed', 10);
      }
    }
    await Promise.all(closePromises);
    tenantConnections.clear();
    connectionLRU.length = 0;
    console.log(`Service ${SERVICE_ID} closed all tenant connections.`);
  } catch (error) {
    console.error('Failed to close tenant connections:', error);
    throw error;
  }
};

export const initializeMainDatabase = async (): Promise<void> => {
  try {
    if (!mainDataSource.isInitialized) {
      await mainDataSource.initialize();
      console.log(`Service ${SERVICE_ID} connected to the Main database.`);
    }
  } catch (error) {
    console.error('Failed to initialize main database:', error);
    throw error;
  }
};

export const getConnectionStats = async (): Promise<{
  activeConnections: number;
  tenantDatabases: string[];
  lruOrder: string[];
  serviceId: string;
  overSoftLimit: boolean;
  capacityPercentage: number;
}> => {
  return {
    activeConnections: tenantConnections.size,
    tenantDatabases: Array.from(tenantConnections.keys()),
    lruOrder: [...connectionLRU],
    serviceId: SERVICE_ID,
    overSoftLimit: tenantConnections.size > MAX_TENANT_CONNECTIONS,
    capacityPercentage: (tenantConnections.size / MAX_TENANT_CONNECTIONS) * 100
  };
};

if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    try {
      await closeTenantConnections();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}
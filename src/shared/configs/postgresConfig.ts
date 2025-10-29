import 'dotenv/config';
import { DataSource, DataSourceOptions, EntitySchema } from 'typeorm';
import { getDataByKey, setDataByKey } from '@shared/utils/RedisClient';

const MAX_TENANT_CONNECTIONS = 50;
const SOFT_CONNECTION_LIMIT = 55;

const tenantConnections: Map<string, DataSource> = new Map();
const connectionLRU: string[] = [];
const SERVICE_ID = process.env.SERVICE_ID || `service-${Math.random().toString(36).substring(2, 9)}`;

export const omsDataSource = new DataSource({
  type: 'postgres',
  host: process.env.OMS_DB_HOST || 'localhost',
  port: Number(process.env.OMS_DB_PORT) || 5432,
  username: process.env.OMS_DB_USER || 'root',
  password: process.env.OMS_DB_PASSWORD || 'secret',
  database: process.env.OMS_DB_NAME || 'oms',
  synchronize: false,
  logging: false,
  entities: ['src/infrastructure/database/main/models/OMS/**/*.ts'],
  ssl: process.env.OMS_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
} as DataSourceOptions);


export const isConnectionHealthy = async (dataSource: DataSource): Promise<boolean> => {
  try {
    await dataSource.query('SELECT 1');
    return true;
  } catch (error: unknown) {
    console.error(`Connection health check failed for database: ${(error as Error).message}`);
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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



/**
 * Checks if entities1 contains all entities from entities2 (by name)
 * @param entities1 The container entities array
 * @param entities2 The entities array to check if it's contained in entities1
 * @returns true if entities1 contains all entities from entities2
 */
const entitiesContain = (entities1: any, entities2: any[]): boolean => {
  // Convert to arrays if needed
  const entities1Array = Array.isArray(entities1) ? entities1 : Object.values(entities1 || {});
  const entities2Array = Array.isArray(entities2) ? entities2 : Object.values(entities2 || {});
  
  // Extract entity names
  const names1 = entities1Array.map((entity: any) => entity.options?.name || entity.name || 'unknown');
  const names2 = entities2Array.map((entity: any) => entity.options?.name || entity.name || 'unknown');
  
  // Check if names1 contains all names from names2
  return names2.every(name2 => names1.includes(name2));
};

const refreshConnectionStatus = async (): Promise<void> => {
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
      if (dataSource?.isInitialized) {
        try {
          await dataSource.destroy();
        } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('Failed to close tenant connections:', error);
    throw error;
  }
};

export const initializeOMSDatabase = async (): Promise<void> => {
  try {
    if (!omsDataSource.isInitialized) {
      await omsDataSource.initialize();
      console.log(`Service ${SERVICE_ID} connected to the OMS PostgreSQL database.`);
    }
  } catch (error: unknown) {
    console.error('Failed to initialize OMS database:', error);
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
    capacityPercentage: (tenantConnections.size / MAX_TENANT_CONNECTIONS) * 100,
  };
};

if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    try {
      await closeTenantConnections();
      if (omsDataSource.isInitialized) {
        await omsDataSource.destroy();
        console.log(`Service ${SERVICE_ID} closed OMS database connection.`);
      }
      process.exit(0);
    } catch (error: unknown) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}

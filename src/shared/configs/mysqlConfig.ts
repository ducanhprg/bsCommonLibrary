import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { getDataByKey, setDataByKey } from '@shared/utils/RedisClient';
import { createTunnel } from 'tunnel-ssh';
import fs from 'fs';

// Environment Variables
const USE_SSH = process.env.USE_SSH === 'true';
const SSH_KEY_PATH = process.env.SSH_KEY_PATH || '/root/.ssh/id_rsa_breezyship_dev';
const SSH_USER = process.env.SSH_USER || 'sandboxbreezy';
const SSH_HOST = process.env.SSH_HOST || '174.129.31.191';
const SSH_PORT = Number(process.env.SSH_PORT) || 22;

// Database connection details (same for both direct & SSH)
const MAIN_DB_HOST = USE_SSH ? '127.0.0.1' : process.env.MAIN_DB_HOST || 'localhost';
const MAIN_DB_PORT = Number(process.env.MAIN_DB_PORT) || 3306;
const MAIN_DB_USER = process.env.MAIN_DB_USER || 'sandboxbreezy_main_user';
const MAIN_DB_PASSWORD = process.env.MAIN_DB_PASSWORD || 'PKVkHYr#ba=c';
const MAIN_DB_NAME = process.env.MAIN_DB_NAME || 'sandboxbreezy_main_2';

console.log(`🛠️ Connecting to DB: ${MAIN_DB_NAME} as ${MAIN_DB_USER}, via ${USE_SSH ? 'SSH Tunnel' : 'Direct Connection'}`);

const createSSHTunnel = async (): Promise<void> => {
  if (!USE_SSH) return;

  console.log(`🔄 Establishing SSH tunnel to ${SSH_HOST}...`);

  const tunnelOptions = {
    autoClose: true,
    reconnectOnError: true
  };

  const serverOptions = {
    host: '127.0.0.1',
    port: 3306,     
  };

  const sshOptions = {
    host: SSH_HOST,
    port: SSH_PORT,
    username: SSH_USER,
    privateKey: fs.readFileSync(SSH_KEY_PATH),
  };
  
  const forwardOptions = {
    srcAddr: '127.0.0.1',
    srcPort: 3306,
    dstAddr: '127.0.0.1',
    dstPort: MAIN_DB_PORT,
  };

  try {
    await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
    console.log(`✅ SSH Tunnel established! Forwarding local 3306 to remote MySQL`);
  } catch (err) {
    console.error('❌ SSH Tunnel Error:', err);
    throw err;
  }
};

// ** Main Database Connection **
export const mainDataSource = new DataSource({
  type: 'mysql',
  host: MAIN_DB_HOST, 
  port: MAIN_DB_PORT,
  username: MAIN_DB_USER,
  password: MAIN_DB_PASSWORD,
  database: MAIN_DB_NAME,
  synchronize: false,
  logging: false,
  entities: ['src/infrastructure/database/main/models/**/*.ts', 'src/shared/database/models/**/*.ts'],
  extra: {
    connectionLimit: 10, 
  },
} as DataSourceOptions);

const multiTenantBaseConfig: DataSourceOptions = {
  type: 'mysql',
  host: MAIN_DB_HOST, 
  port: MAIN_DB_PORT,
  username: MAIN_DB_USER,
  password: MAIN_DB_PASSWORD,
  synchronize: false,
  logging: false,
  entities: ['src/infrastructure/database/multi-tenant/entities/**/*.ts'],
  extra: {
    connectionLimit: 5, 
  },
};

export const getTenantDataSource = async (vendorDatabase: string): Promise<DataSource> => {
  const cacheKey = `tenant:${vendorDatabase}`;
  const cachedDataSourceOptions = await getDataByKey(cacheKey);

  if (cachedDataSourceOptions) {
    console.log(`🟢 Using cached configuration for tenant: ${vendorDatabase}`);
    const dataSource = new DataSource(JSON.parse(cachedDataSourceOptions) as DataSourceOptions);

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log(`🔄 Reconnected to tenant database: ${vendorDatabase}`);
    }

    return dataSource;
  }

  const dataSourceOptions: DataSourceOptions = {
    ...multiTenantBaseConfig,
    database: vendorDatabase,
  };

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  console.log(`✅ Connected to tenant database: ${vendorDatabase}`);

  await setDataByKey(cacheKey, JSON.stringify(dataSourceOptions), 60 * 60 * 24);

  return dataSource;
};

export const initializeMainDatabase = async (): Promise<void> => {
  if (USE_SSH) {
    await createSSHTunnel(); 
  }

  if (!mainDataSource.isInitialized) {
    await mainDataSource.initialize();
    console.log('✅ Connected to the Main database.');
  }
};

export const closeTenantConnections = async (): Promise<void> => {
  console.log('🔸 No in-memory tenant connections to close. Redis manages configurations.');
};

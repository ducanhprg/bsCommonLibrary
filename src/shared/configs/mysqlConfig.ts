import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { getDataByKey, setDataByKey } from '@shared/utils/RedisClient';
import { createTunnel } from 'tunnel-ssh';
import fs from 'fs';

// Environment Variables
const USE_SSH = true;//process.env.USE_SSH === 'true';
const SSH_KEY_PATH = process.env.SSH_KEY_PATH || '/root/.ssh/id_rsa_breezyship_dev';
const SSH_USER = process.env.SSH_USER || 'sandboxbreezy';
const SSH_HOST = process.env.SSH_HOST || '174.129.31.191';
const SSH_PORT = Number(process.env.SSH_PORT) || 22;

// Database credentials based on connection type
const DB_HOST = USE_SSH ? '127.0.0.1' : process.env.DIRECT_DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DIRECT_DB_PORT) || 3306;

// Credentials for **Direct Connection** (USE_SSH=false)
const DIRECT_DB_USER = process.env.DIRECT_DB_USER || 'direct_user';
const DIRECT_DB_PASSWORD = process.env.DIRECT_DB_PASSWORD || 'direct_password';
const DIRECT_DB_NAME = process.env.DIRECT_DB_NAME || 'direct_db';

// Credentials for **SSH Connection** (USE_SSH=true)
const SSH_DB_USER = process.env.SSH_DB_USER || 'sandboxbreezy_main_user';
const SSH_DB_PASSWORD = process.env.SSH_DB_PASSWORD || 'PKVkHYr#ba=c';
const SSH_DB_NAME = process.env.SSH_DB_NAME || 'sandboxbreezy_main_2';

// Use correct credentials based on SSH setting
const DB_USER = USE_SSH ? SSH_DB_USER : DIRECT_DB_USER;
const DB_PASSWORD = USE_SSH ? SSH_DB_PASSWORD : DIRECT_DB_PASSWORD;
const DB_NAME = USE_SSH ? SSH_DB_NAME : DIRECT_DB_NAME;

console.log(`🛠️ Connecting to DB: ${DB_NAME} as ${DB_USER}, via ${USE_SSH ? 'SSH Tunnel' : 'Direct Connection'}`);

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
    dstPort: DB_PORT,
  };

  try {
    await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
    console.log(`✅ SSH Tunnel established! Forwarding local 3306 to ${DB_HOST}:${DB_PORT}`);
  } catch (err) {
    console.error('❌ SSH Tunnel Error:', err);
    throw err;
  }
};

// ** Main Database Connection **
export const mainDataSource = new DataSource({
  type: 'mysql',
  host: DB_HOST, 
  port: DB_PORT,
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  synchronize: false,
  logging: false,
  entities: ['src/infrastructure/database/main/models/**/*.ts', 'src/shared/database/models/**/*.ts'],
  extra: {
    connectionLimit: 10, 
  },
} as DataSourceOptions);

const multiTenantBaseConfig: DataSourceOptions = {
  type: 'mysql',
  host: DB_HOST, 
  port: DB_PORT,
  username: process.env.MT_DB_USER || 'root',
  password: process.env.MT_DB_PASSWORD || 'password',
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

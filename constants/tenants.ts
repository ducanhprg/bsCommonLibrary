import { Tenant } from "@src/domain/entities/Tenant";

  // Export the TENANTS constant as an array of tenant objects
  export const TENANTS: Tenant[] = [
    {
      database: process.env.TENANT_1_DB_NAME || 'tenant_1',
      name:'Tenant 1'
    },
    {
      database: process.env.TENANT_2_DB_NAME || 'tenant_2',
      name:'Tenant 2'
    },
    {
      database: 'tenant_3',
      name:'Tenant 3'
    },
    
    {
      database: 'tenant_4',
      name:'Tenant 4'
    },
    {
      database: 'tenant_5',
      name:'Tenant 5'
    },
  ];
  
  
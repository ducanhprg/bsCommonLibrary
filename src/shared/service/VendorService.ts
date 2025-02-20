import { mainDataSource } from '@shared/configs/mysqlConfig';
import { Vendor } from '@shared/database/models/Vendor';
import { setDataByKey, getDataByKey } from '@shared/utils/RedisClient';
import { getVendorRepository } from '@shared/database/repositories/VendorRepository';


export class VendorService {
  /**
   * Loads all vendor meta records from the database and caches them.
   */
  public static async initialize(): Promise<Vendor | null> {
    let cachedMetaData = await getDataByKey('vendor_meta_data:' + process.env.VENDOR_NAME);
    if (cachedMetaData) {
		console.log('Vendor Data Loaded from Redis');
      return JSON.parse(cachedMetaData);
    } else {
      try {
        if (process.env.VENDOR_NAME) {
          let vendorName = process.env.VENDOR_NAME;
          const vendor = await getVendorRepository(mainDataSource).findVendorWithRelations(vendorName);
          if (vendor) {
            console.log('Vendor Data Loaded from DB');
            await setDataByKey('vendor_meta_data:' + process.env.VENDOR_NAME, JSON.stringify(vendor));
			      return vendor;
          } else {
            throw 'Vendor Data Not Found';
		  }
        } else {
          throw 'Vendor name not set in the environment variables.';
        }
      } catch (error) {
        throw 'Error loading vendor meta data:' + error;
      }
    }
  }
  
}
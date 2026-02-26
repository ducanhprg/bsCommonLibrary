import { mainDataSource } from '@shared/configs/mysqlConfig';
import { Vendor } from '@shared/database/models/Vendor';
import { setDataByKey, getDataByKey } from '@shared/utils/RedisClient';
import { getVendorRepository } from '@shared/database/repositories/VendorRepository';
import { ExchangeNames } from '../enums/exchangeNames';
import { VendorEventTypes } from '../enums/vendorEventTypes';
import { RabbitMQClient } from '../utils/RabbitMQClient';


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
  
  public static async publishToExchangeConsolidator(requestId: string, parcelRequestItemId: string, vendorName: string) {
		try {
			const event = VendorEventTypes.GET_LABEL;
			const exchangeName = ExchangeNames.CONSOLIDATOR_REQUESTS;
			const routingKey = `${vendorName}.${event}`;
			const messageContent = JSON.stringify(
				{ 
					request_id: requestId,
					parcel_request_items : parcelRequestItemId 
				});
			await RabbitMQClient.publish(exchangeName, routingKey, messageContent);
			console.log(`[x] Sent "${messageContent}" to exchange "${exchangeName}" with the routing key "${routingKey}" `);
		} catch ( error ) {
			console.error('Error publishing to exchange:', error);
		} 
  }
  

  /**
   * Publish failure to plRequestHandler's vendor failure retry queue.
   * plRequestHandler will attempt retry with next vendor (no consolidator).
   */
  public static async publishToVendorFailureQueue(
    requestId: string,
    parcelRequestItemId: string,
    vendorId: number,
    error: string,
    vendorName: string,
    customer: {
      customer_branch_id: number;
      customer_master_id: number;
      dbprefix: string;
      database: string;
      pcode?: string;
      firmname?: string;
      display_firmname?: string;
      address_1?: string;
      address_2?: string;
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
      display_addr?: string;
    },
    rateSearchItemId?: string,
    rateSearchId?: string
  ) {
    try {
      const exchangeName = ExchangeNames.VENDOR_REQUESTS;
      const routingKey = `${vendorName}.failure`;
      const messageContent = JSON.stringify({
        parcelRequestItemId,
        vendorId,
        error,
        requestId,
        rateSearchItemId,
        rateSearchId,
        customer,
      });
      await RabbitMQClient.publish(exchangeName, routingKey, messageContent);
      console.log(`[x] Sent failure to vendor retry queue for parcel ${parcelRequestItemId}`);
    } catch (err) {
      console.error('Error publishing to vendor failure queue:', err);
    }
  }

}
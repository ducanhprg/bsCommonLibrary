import { getDataByHashKey, sscanKeys} from "@shared/utils/RedisClient";
import { ParcelRequestItem } from "./ParcelRequestItem";
import { redisKeys } from "@shared/constants/redisKeys";

export class PrintLabelRequest {
    request_id!: string;
    parcelRequestItemID!: string;
    rateSearchID!: string;
    parcelRequestItem!: ParcelRequestItem;
    customerInfo!: any;

    public static async initialize(request_id: string, item: any, customer: any): Promise<PrintLabelRequest | null> {
        let printLabelRequest = new PrintLabelRequest();
        printLabelRequest.request_id = request_id;
        printLabelRequest.parcelRequestItemID = item.parcel_request_items;
        printLabelRequest.rateSearchID = item.rate_searches;
        printLabelRequest.customerInfo = {
            customer_branch_id: customer.customer_branch_id,
            customer_master_id: customer.customer_master_id
        };
        let keyParcelRequestItem = this.generateKey(redisKeys.REDIS_KEY_PARCEL_REQUEST_ITEM,printLabelRequest.parcelRequestItemID );
        let metaParcelRequestItem = await getDataByHashKey(keyParcelRequestItem);
        let keyRateSearch = this.generateKey(redisKeys.REDIS_KEY_RATE_SEARCH, printLabelRequest.rateSearchID );
        let metaRateSearch = await getDataByHashKey(keyRateSearch);
        if(metaParcelRequestItem && metaRateSearch) {
            let parcelSize = {
                length: metaRateSearch.length,
                width: metaRateSearch.width,
                height: metaRateSearch.height,
                weight: metaRateSearch.weight,
                length_plus_girth: metaRateSearch.length_plus_girth,
                girth: metaRateSearch.girth,
                cubic_ft: metaRateSearch.cubic_ft,
                weight_unit: metaRateSearch.weight_unit,
                dimension_unit: metaRateSearch.dimension_unit,
            };
            let shippingLane = {
                departure_hub: metaRateSearch.departure_hub,
                injection_hub: metaRateSearch.injection_hub,
                carrier_code: metaRateSearch.carrier_code,
                service_type_code: metaRateSearch.service_type_code,
                address_clarification: metaParcelRequestItem.address_clarification
            };

            let packageContents = await this.getPackageContent(keyParcelRequestItem);
            printLabelRequest.parcelRequestItem = new ParcelRequestItem(
                metaParcelRequestItem.address_to_json,
                metaParcelRequestItem.address_from_json,
                JSON.stringify(parcelSize),
                JSON.stringify(shippingLane),
                metaParcelRequestItem.customer_ref_json,
                packageContents,
                metaParcelRequestItem.uuid,
                printLabelRequest.rateSearchID,
                metaParcelRequestItem.parcel_request_id);
            return printLabelRequest;
        } else {
            console.log('Failed to get parcel request item from Redis');
        }
        return null;
    }

    private static generateKey(keyName:string, parcelRequestItemId: string): string {
        return `${keyName}:${parcelRequestItemId}`;
    }

    private static async getPackageContent(key: string): Promise<any> {
        let idPackageContent = await sscanKeys(`${key}:package_contents:`) ?? [];
        const packageContents = await Promise.all(
            idPackageContent.map(async (id: string) => {
            let keyPackageContent = this.generateKey(redisKeys.REDIS_KEY_PACKAGE_CONTENT, id);
            return await getDataByHashKey(keyPackageContent);
            })
        );
        return packageContents;
    }
}
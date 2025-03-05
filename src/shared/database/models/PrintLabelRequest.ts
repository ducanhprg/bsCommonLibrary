import { getDataByHashKey, sscanKeys } from "@shared/utils/RedisClient";
import { ParcelRequestItem } from "./ParcelRequestItem";
import { redisKeys } from "@shared/constants/redisKeys";

export class PrintLabelRequest {
    request_id!: string;
    parcelRequestItemID!: string;
    rateSearchID!: string;
    rateSearchItemID!: string;
    parcelRequestItem!: ParcelRequestItem;
    customerInfo!: any;
    rateInfo!: {
        total: number;
        currency_code: string;
        dim_factor: number;
        rate_amount: number;
        surcharge_amount: number;
        duty_code: string;
        rate_card_header_id: number;
    };

    constructor(record?: Record<string, string>) {
        if (record) {
            this.request_id = record.request_id;
            this.parcelRequestItemID = record.parcelRequestItemID;
            this.rateSearchID = record.rateSearchID;
            this.rateSearchItemID = record.rateSearchItemID;
            this.customerInfo = JSON.parse(record.customerInfo);
            this.parcelRequestItem = JSON.parse(record.parcelRequestItem);
        }
    }

    public static async initialize(request_id: string, item: any, customer: any): Promise<PrintLabelRequest | null> {
        let printLabelRequest = new PrintLabelRequest();
        printLabelRequest.request_id = request_id;
        printLabelRequest.parcelRequestItemID = item.parcel_request_items;
        printLabelRequest.rateSearchID = item.rate_searches;
        printLabelRequest.rateSearchItemID = item.rate_search_items;
        printLabelRequest.customerInfo = {
            customer_branch_id: customer.customer_branch_id,
            customer_master_id: customer.customer_master_id
        };
        let keyParcelRequestItem = this.generateKey(redisKeys.REDIS_KEY_PARCEL_REQUEST_ITEM, printLabelRequest.parcelRequestItemID);
        let keyRateSearch = this.generateKey(redisKeys.REDIS_KEY_RATE_SEARCH, printLabelRequest.rateSearchID);
        let keyRateSearchItem = this.generateKey(redisKeys.REDIS_KEY_RATE_SEARCH_ITEM, printLabelRequest.rateSearchItemID);
        let metaParcelRequestItem = await getDataByHashKey(keyParcelRequestItem);
        let metaRateSearch = await getDataByHashKey(keyRateSearch);
        let metaRateSearchItem = await getDataByHashKey(keyRateSearchItem);
        if (metaParcelRequestItem && metaRateSearch && metaRateSearchItem) {
            let parcelSize = {
                length: metaParcelRequestItem.length,
                width: metaParcelRequestItem.width,
                height: metaParcelRequestItem.height,
                weight: metaParcelRequestItem.weight,
                cubic_ft: metaParcelRequestItem.cubic_ft,
                length_plus_girth: metaRateSearch.length_plus_girth,
                girth: metaRateSearch.girth,
                weight_unit: metaParcelRequestItem.weight_unit,
                dimension_unit: metaParcelRequestItem.dimension_unit,
                chargeable_weight: metaRateSearchItem.chargeable_weight,
                chargeable_weight_unit: metaRateSearchItem.chargeable_weight_unit
            };
            let shippingLane = {
                departure_hub: metaRateSearch.departure_hub,
                injection_hub: metaRateSearch.injection_hub,
                carrier_code: metaRateSearch.carrier_code,
                service_type_code: metaRateSearch.service_type_code,
                address_clarification: metaParcelRequestItem.address_clarification,
                shipping_date: metaParcelRequestItem.input_shipping_date,
                packaging_type: metaParcelRequestItem.input_packaging_type
            };

            let packageContents = await this.getPackageContent(keyParcelRequestItem);
            printLabelRequest.rateInfo = {
                total: parseFloat(metaRateSearchItem.total),
                currency_code: metaRateSearchItem.currency_code,
                dim_factor: parseInt(metaRateSearchItem.dim_factor),
                rate_amount: parseFloat(metaRateSearchItem.rate),
                surcharge_amount: parseFloat(metaRateSearchItem.surcharge),
                duty_code: metaRateSearchItem.duty_code,
                rate_card_header_id: parseInt(metaRateSearchItem.rate_card_header_id)
            }
            printLabelRequest.parcelRequestItem = new ParcelRequestItem(
                metaParcelRequestItem.address_to_json,
                metaParcelRequestItem.address_from_json,
                JSON.stringify(parcelSize),
                JSON.stringify(shippingLane),
                metaParcelRequestItem.customer_ref_json,
                packageContents,
                metaParcelRequestItem.uuid,
                printLabelRequest.rateSearchID,
                metaParcelRequestItem.parcel_request_id,
                metaParcelRequestItem.input_package_service_option,
                metaRateSearchItem.rate_search_id);
            return printLabelRequest;
        } else {
            console.log('Failed to get parcel request item from Redis');
        }
        return null;
    }

    private static generateKey(keyName: string, parcelRequestItemId: string): string {
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

    public toRecord(): Record<string, string> {
        const record: Record<string, string> = {
            request_id: this.request_id,
            parcel_request_item_id: this.parcelRequestItemID,
            rate_search_id: this.rateSearchID,
            rate_search_item_id: this.rateSearchItemID,
            customer_info: JSON.stringify(this.customerInfo),
            parcel_request_item: JSON.stringify(this.parcelRequestItem),
            rate_info: JSON.stringify(this.rateInfo)
        };
        return record;
    }

}
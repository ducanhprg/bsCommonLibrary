interface ParcelSize {
  length_plus_girth: number;
  girth: number;
  cubic_ft: number;
  length:number;
  width:number;
  height:number;
  weight:number;
  dimension_unit: string;
  weight_unit: string;
}

interface ShipFrom {
  send_address_residential_indicator: boolean;
  send_address_validation: boolean;
  use_as_shipout_address: boolean;
  send_zip_postal_code: string;
  send_state_province: string;
  send_city_locality: string;
  send_country_code: string;
  send_zip4_code: string;
  send_district: string;
  send_tax_no: string;
  send_id_no: string;
  send_email: string;
  send_addr3: string;
  send_addr2: string;
  send_addr1: string;
  send_town: string;
  send_name: string;
  send_firm: string;
  send_sms: string;
}

interface ShipTo {
  validation_flag: boolean;
  recv_address_residential_indicator: boolean;
  recv_address_validation: boolean;
  use_as_shipout_address: boolean;
  recv_zip_postal_code: string;
  recv_state_province: string;
  recv_city_locality: string;
  recv_country_code: string;
  recv_zip4_code: string;
  recv_districtl: string;
  recv_tax_no: string;
  recv_id_no: string;
  recv_email: string;
  recv_addr3: string;
  recv_addr2: string;
  recv_addr1: string;
  recv_town: string;
  recv_name: string;
  recv_firm: string;
  recv_sms: string;
}

interface ShippingLane {
  departure_hub: string;
  injection_hub: string;
  service_type_code: string;
  carrier_code: string;
  address_clarification: string;
}

interface CustomerReference {
  cust_ref1:string,
  cust_ref2:string,
  cust_ref3:string,
  cust_ref4:string,
  cust_ref5:string,
  order_id:string,
  invoice_id:string
}

interface PackageContent {
  declared_total_value: 'string',
  export_country_hts_code: 'string',
  item_no: 'string',
  commodity_desc: 'string',
  item_weight_unit: 'string',
  declared_item_value: 'string',
  total_net_weight: 'string',
  declared_currency: 'string',
  country_import: 'string',
  import_country_hts_code: 'string',
  id: 'string',
  parcel_request_item_id: 'string',
  item_sku: 'string',
  total_gross_weight: 'string',
  item_gross_weight_unit: 'string',
  country_origin: 'string',
  reference_json: 'string',
  created_at: 'string',
  item_desc: 'string',
  item_category: 'string',
  item_product_id: 'string',
  total_quantity: 'string',
  updated_at: 'string',
  item_gross_weight: 'string',
  item_net_weight: 'string',
  country_export: 'string'
}

export class ParcelRequestItem {
    id!: string;
    rateSearchId!: string;
    parcelRequestId!: string; 
    shipFrom!: ShipFrom; 
    shipTo!: ShipTo; 
    parcelSize?: ParcelSize;
    shippingLane!: ShippingLane;
    customerReference!: CustomerReference;
    packageContent!: PackageContent[];

    constructor(shipTo: any, shipFrom: any, parcelSize: any, shippingLane: any, customerReference: any, packageContent: any[], id: string, rateSearchId: string, parcelRequestId: string) {
      this.shipTo = JSON.parse(shipTo);
      this.shipFrom = JSON.parse(shipFrom);
      this.parcelSize = JSON.parse(parcelSize);
      this.shippingLane = JSON.parse(shippingLane);
      this.customerReference = JSON.parse(customerReference);
      if (packageContent) {
        this.packageContent = packageContent;
      }
    }
  }
  
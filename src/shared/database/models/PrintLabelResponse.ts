
export class PrintLabelResponse {
    status!: string;
    parcel_request_item_id!: string;
    label_url!: string;
    tracking_number!: string;
    vendor_tracking_no!: string;
    last_mile_tracking_no!: string;
    package_identification_code!: string;
    vendor_name!: string;
    vendor_id!: string;
    customer_branch_id!: string;
    customer_master_id!: string;
    order_number!: string;
    print_label_request_id!: string;
    message: any;
    api_log:any;
    constructor(record?: Record<string, string>) {
        if (record) {
            this.customer_branch_id = record.customer_branch_id;
            this.customer_master_id = record.customer_master_id;
            this.label_url = record.label_url;
            this.last_mile_tracking_no = record.last_mile_tracking_no;
            this.order_number = record.order_number;
            this.package_identification_code = record.package_identification_code;
            this.print_label_request_id = record.print_label_request_id;
            this.parcel_request_item_id = record.parcel_request_item_id;
            this.status = record.status;
            this.tracking_number = record.tracking_number;
            this.vendor_id = record.vendor_id;
            this.vendor_name = record.vendor_name;
            this.vendor_tracking_no = record.vendor_tracking_no;
            this.message = record.message;
        }
    }
    
    
    public toRecord(): Record<string, string> {
        return {
            customer_branch_id: this.customer_branch_id,
            customer_master_id: this.customer_master_id,
            label_url: this.label_url,
            last_mile_tracking_no: `"${this.last_mile_tracking_no}"`,
            order_number: `"${this.order_number}"`,
            package_identification_code: `"${this.package_identification_code}"`,
            print_label_request_id : this.print_label_request_id,
            parcel_request_item_id: this.parcel_request_item_id,
            status: this.status,
            tracking_number: `"${this.tracking_number}"`,
            vendor_id: this.vendor_id,
            vendor_name: this.vendor_name,
            vendor_tracking_no: `"${this.vendor_tracking_no}"`,
            message: this.message
        };
    }
}
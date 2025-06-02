import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('parcel_master_list')
export class ParcelMasterList {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'customer_branch_id' })
    customerBranchId!: number;

    @Column({ name: 'customer_parcel_id' })
    customerParcelId!: number;

    @Column({ name: 'tracking_no', nullable: true })
    trackingNo?: string;

    @Column({ name: 'package_identification_no', nullable: true })
    packageIdentificationNo?: string;

    @Column({ name: 'cust_order_id', nullable: true })
    custOrderId?: string;

    @Column({ name: 'cust_invoice_id', nullable: true })
    custInvoiceId?: string;

    @Column({ name: 'cust_reference_1', nullable: true })
    custReference1?: string;

    @Column({ nullable: true })
    status?: string;

    @Column({ name: 'created_date', type: 'date', nullable: true })
    createdDate?: Date;

    @Column({ name: 'created_time', nullable: true })
    createdTime?: string;

    @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
    updatedAt?: Date;

    @Column({ name: 'service_type_id', nullable: true })
    serviceTypeId?: number;

    @Column({ name: 'vendor_id', nullable: true })
    vendorId?: number;

    @Column({ name: 'manifest_status', nullable: true })
    manifestStatus?: string;

    @Column({ name: 'manifest_id', nullable: true })
    manifestId?: number;

    @Column({ name: 'bucket_id', nullable: true })
    bucketId?: number;

    @Column({ name: 'overpack_id', nullable: true })
    overpackId?: number;

    @Column({ name: 'gross_weight', type: 'decimal', precision: 10, scale: 2, nullable: true })
    grossWeight?: number;

    @Column({ nullable: true })
    dimension?: string;

    @Column({ name: 'carrier_id', nullable: true })
    carrierId?: number;

    @Column({ name: 'vendor_tracking_no', nullable: true })
    vendorTrackingNo?: string;

    @Column({ name: 'last_mile_tracking_no', nullable: true })
    lastMileTrackingNo?: string;

    @Column({ name: 'contribution_center', nullable: true })
    contributionCenter?: string;

    @Column({ name: 'customer_manifest_id', nullable: true })
    customerManifestId?: number;

    @Column({ name: 'pickup_no', nullable: true })
    pickupNo?: string;
} 
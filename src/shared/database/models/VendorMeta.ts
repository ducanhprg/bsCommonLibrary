import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Vendor } from './Vendor';

@Entity("vendor_master_meta")
export class VendorMeta {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    vendor_id!: number;

    @Column()
    group_name!: string;

    @Column()
    meta_key!: string;

    @Column({ type: 'json', nullable: true })
    meta_value: any;
    
    @ManyToOne(() => Vendor, (vendor) => vendor.vendorMeta)
    @JoinColumn({ name: 'vendor_id' })
    vendor!: Vendor;
};
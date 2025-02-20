import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Vendor } from './Vendor';

@Entity("vendor_external_token")
export class VendorToken {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    vendor_id!: number;

    @Column()
    module!: string;

    @Column()
    token!: string;

    @Column({ type: 'timestamp' })
    generated_at!: Date;

    @Column({ type: 'timestamp' })
    expired_on!: Date;

    @Column()
    remark!: string;

    @OneToOne(() => Vendor, (vendor) => vendor.vendorToken)
    @JoinColumn({ name: 'vendor_id' })
    vendor!: Vendor;
    
    constructor(id: number, vendor_id: number, module: string, token: string, generated_at: Date, expired_on: Date, remark: string) {
        this.id = id;
        this.vendor_id = vendor_id;
        this.module = module;
        this.token = token;
        this.generated_at = generated_at;
        this.expired_on = expired_on;
        this.remark = remark;
    }
};
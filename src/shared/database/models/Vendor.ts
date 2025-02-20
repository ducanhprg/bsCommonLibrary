import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn, JoinTable } from 'typeorm';
import { VendorMeta } from './VendorMeta';
import { VendorToken } from './VendorToken';

@Entity("vendor_master")
export class Vendor {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    status!: number;

    @OneToMany(() => VendorMeta, (vendorMeta) => vendorMeta.vendor)
    vendorMeta!: VendorMeta[];

    @OneToOne(() => VendorToken, (vendorToken) => vendorToken.vendor)
    vendorToken!: VendorToken;
};
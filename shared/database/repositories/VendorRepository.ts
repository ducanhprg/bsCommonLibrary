import { DataSource } from "typeorm";
import { Vendor } from "@shared/database/models/Vendor";

export const getVendorRepository = (dataSource: DataSource) =>
	dataSource.getRepository(Vendor).extend({
		async findVendorWithRelations(vendorName: string | undefined): Promise<Vendor | null> {
			return this.findOne({
				where: { name: vendorName },
				relations: ['vendorMeta', 'vendorToken'],
			});
		}
	});

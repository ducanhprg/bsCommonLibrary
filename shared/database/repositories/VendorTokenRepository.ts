import { DataSource } from "typeorm";
import { VendorToken } from "@shared/database/models/VendorToken";

export const getVendorTokenRepository = (dataSource: DataSource) =>
	dataSource.getRepository(VendorToken).extend({
		async findByNameCaseInsensitive(vendorName: string): Promise<VendorToken | null> {
			return this.createQueryBuilder('vendor')
				.where('LOWER(vendor.name) = LOWER(:name)', { name: vendorName })
				.getOne();
		}
	});

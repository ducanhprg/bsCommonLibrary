import { DataSource } from "typeorm";
import { VendorMeta } from "@shared/database/models/VendorMeta";

export const getVendorMetaRepository = (dataSource: DataSource) =>
	dataSource.getRepository(VendorMeta).extend({
		async findByVendorId(vendorId: number): Promise<VendorMeta[]> {
			return this.find({ where: { vendor_id: vendorId } });
		}
	});

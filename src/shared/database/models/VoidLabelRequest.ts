import { redisKeys } from "@src/shared/constants/redisKeys";
import { getDataByHashKey, sscanKeys } from "@src/shared/utils/RedisClient";
import { ParcelRequestItem } from "./ParcelRequestItem";
import { PrintLabelRequest } from "./PrintLabelRequest";
import { Vendor } from "./Vendor";
import { PrintLabelResponse } from "./PrintLabelResponse";

export class VoidLabelRequest {
    printLabelRequest!: PrintLabelRequest;
    printLabelResponse!: PrintLabelResponse;

    public static async initialize(parcelRequestItemID: string) : Promise<VoidLabelRequest|undefined> {
        const printLabelRequest = await getDataByHashKey('print_label_request:' + parcelRequestItemID);
        const printLabelResponse = await getDataByHashKey('print_label_response:' + parcelRequestItemID);
        console.log('printLabelRequest load from Redis', printLabelRequest);
        console.log('printLabelResponse load from Redis', printLabelResponse);
        const voidLabelRequest = new VoidLabelRequest();
        if (printLabelRequest != null && printLabelResponse != null) {
            voidLabelRequest.printLabelRequest = new PrintLabelRequest(printLabelRequest);
            voidLabelRequest.printLabelResponse = PrintLabelResponse.fromRecord(printLabelResponse);
            return voidLabelRequest;
        }
        return undefined;
    }
}
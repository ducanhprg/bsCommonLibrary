import { redisKeys } from "@src/shared/constants/redisKeys";
import { getDataByHashKey, sscanKeys } from "@src/shared/utils/RedisClient";
import { ParcelRequestItem } from "./ParcelRequestItem";
import { PrintLabelRequest } from "./PrintLabelRequest";
import { Vendor } from "./Vendor";
import { PrintLabelResponse } from "./PrintLabelResponse";

export class VoidLabelRequest {
    request_id!: string;
    printLabelRequest!: PrintLabelRequest;
    printLabelResponse!: PrintLabelResponse;
    voidLabelResponse!: any;

    public static async initialize(request_id:string, parcelRequestItemID: string) : Promise<VoidLabelRequest|undefined> {
        const printLabelRequest = await getDataByHashKey('print_label_request:' + parcelRequestItemID);
        const printLabelResponse = await getDataByHashKey('print_label_response:' + parcelRequestItemID);
        console.log('printLabelRequest load from Redis', printLabelRequest);
        console.log('printLabelResponse load from Redis', printLabelResponse);
        const voidLabelRequest = new VoidLabelRequest();
        if (printLabelRequest != null && printLabelResponse != null) {
            voidLabelRequest.request_id = request_id;
            voidLabelRequest.printLabelRequest = new PrintLabelRequest(printLabelRequest);
            voidLabelRequest.printLabelResponse = new PrintLabelResponse(printLabelResponse);
            return voidLabelRequest;
        }
        return undefined;
    }

    public toRecord(voidLabelResponse : any): Record<string, string> {
        return {
            request_id: this.request_id,
            printl_label_request: JSON.stringify(this.printLabelRequest),
            print_label_response: JSON.stringify(this.printLabelResponse),
            void_label_response: JSON.stringify(voidLabelResponse)
        };
    }
}
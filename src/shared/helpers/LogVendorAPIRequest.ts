import { Logger } from "@src/shared/logging/Logger";
import { AxiosRequestConfig, AxiosResponse } from "axios";

interface LogVendorAPIRequest {
    request_id: any;
    request_api_content: {
        endpoint: any;
        method: any;
        headers: any;
        body: any;
        params?: any;
    };
    vendor_response: any;
    timestamp: any;
}

export const logVendorAPIRequest = (requestId: string, request: LogVendorAPIRequest["request_api_content"], responseAxiosResponse : any) => {
    const log = {
        "request_id": requestId,
        "request_api_content": {
          "endpoint": request.endpoint,
          "method": request.method,
          "headers": request.headers,
          "body": request.body,
          "params": request.params ? request.params : null
        },
        "vendor_response": responseAxiosResponse,
        "timestamp": new Date().toISOString()
    }
    Logger.debug(JSON.stringify(log));
}
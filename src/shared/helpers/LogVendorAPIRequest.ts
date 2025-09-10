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
    vendor_response: {
        status_code: any;
        error: {
            code: any;
            message: any;
        };
    };
    timestamp: any;
}

export const logVendorAPIRequest = (requestId: string, request: LogVendorAPIRequest["request_api_content"], responseAxiosResponse : AxiosResponse) => {
    const log = {
        "request_id": requestId,
        "request_api_content": {
          "endpoint": request.endpoint,
          "method": request.method,
          "headers": request.headers,
          "body": request.body,
          "params": request.params ? request.params : null
        },
        "vendor_response": {
          "status_code": responseAxiosResponse.status ? responseAxiosResponse.status : null,
          "error": {
            "code": responseAxiosResponse.status ? responseAxiosResponse.status : null,
            "message": responseAxiosResponse.data ? responseAxiosResponse.data.Message : null
          }
        },
        "timestamp": new Date().toISOString()
    }
    console.log(JSON.stringify(log));
}
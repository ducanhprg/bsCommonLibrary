import { createAxiosClient, executeRequest } from '@configs/kongGatewayConfig';

class KongGatewayClient {
    private client = createAxiosClient();

    // Internal gateway call
    async getRate(packageData: any) {
        const GET_RATE_API = process.env.GET_RATE_API || '';
        return executeRequest(this.client, 'post', GET_RATE_API, packageData);
    }
}

export const kongGatewayClient = new KongGatewayClient();

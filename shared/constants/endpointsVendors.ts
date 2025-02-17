export const ENDPOINTS : any[] = [
    {
      name: 'GDE',
      environment: 'production',
      apiKey: '',
      vendorDomain : "http://dragon.iot-easy.cn",
      tokenEndpoint : "http://authorization.iot-easy.cn/connect/token",
      createOrderEndpoint : "http://dragon.iot-easy.cn/api/gts/CreateOrder",
      cancelOrderEndpoint : "http://dragon.iot-easy.cn/api/gts/VoidShipment",
      getLabelEndpoint : "http://dragon.iot-easy.cn/api/gts/ShippingLabel",
    },
    {
      name: 'GDE',
      environment: 'development',
      apiKey: '',
      vendorDomain : "http://ioteasy.tpddns.cn:9102",
      tokenEndpoint : "http://sanbox.authorization.iot-easy.cn/connect/token",
      createOrderEndpoint : "http://ioteasy.tpddns.cn:9102/api/gts/CreateOrder",
      cancelOrderEndpoint : "http://ioteasy.tpddns.cn:9102/api/gts/VoidShipment",
      getLabelEndpoint : "http://ioteasy.tpddns.cn:9102/api/gts/ShippingLabel",
    }
]
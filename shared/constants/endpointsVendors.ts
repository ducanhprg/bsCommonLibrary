export const ENDPOINTS : any[] = [
    {
      name: 'Shipsaving',
      environment: 'production',
      apiKey: '',
      vendorDomain : "https://s.shipsaving.com",
      tokenEndpoint : "https://s.shipsaving.com",
      createOrderEndpoint : "https://s.shipsaving.com/api/rates/buy-label",
      cancelOrderEndpoint : "https://s.shipsaving.com/api/shipments/void",
      getLabelEndpoint : "https://s.shipsaving.com",
      rateOrderEndpoint : 'https://s.shipsaving.comapi/rates/list',
    },
    {
      name: 'Shipsaving',
      environment: 'development',
      apiKey: '',
      vendorDomain : "https://www.shipsaving.us",
      tokenEndpoint : "https://www.shipsaving.us",
      createOrderEndpoint : "https://www.shipsaving.us/api/rates/buy-label",
      cancelOrderEndpoint : "https://www.shipsaving.us/api/shipments/void",
      getLabelEndpoint : "https://www.shipsaving.us",
      rateOrderEndpoint : 'https://shipsaving.us/api/rates/list',
    },
    {
      // api document -> https://www.showdoc.com.cn/IOTEasy/4410471878010502
      // client_id 账号：Dev
      // secret 密码：Ml4eYCu6PI6z
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
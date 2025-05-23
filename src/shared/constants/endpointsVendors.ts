export const ENDPOINTS : any[] = [
    {
      name: 'Shipsavings',
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
      name: 'Shipsavings',
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
      createOrderEndpoint : "http://dragon.iot-easy.cn/api/gts/ShippingLabel",
      cancelOrderEndpoint : "http://dragon.iot-easy.cn/api/gts/VoidShipment",
      getLabelEndpoint : "http://dragon.iot-easy.cn/api/gts/ShippingLabel",
    },
    {
      name: 'GDE',
      environment: 'development',
      apiKey: '',
      vendorDomain : "http://ioteasy.tpddns.cn:9102",
      tokenEndpoint : "http://sanbox.authorization.iot-easy.cn/connect/token",
      createOrderEndpoint : "http://ioteasy.tpddns.cn:9102/api/gts/ShippingLabel",
      cancelOrderEndpoint : "http://ioteasy.tpddns.cn:9102/api/gts/VoidShipment",
      getLabelEndpoint : "http://ioteasy.tpddns.cn:9102/api/gts/ShippingLabel",
    },
    // https://www.deepros.com
    // api document 
    // api carrier list https://deepros.com/CarrierList.aspx
    //
    //开放Api Key:60c3db80f9d44e8a9407197f3b258479
    //开放Secret:aeed82491966484ba96cd5f0bac7e1af
    //@Roger
    //UPS 835- SS 
    //http://login.yccang.com/Login.aspx
    //username:  rogerpaul@iotsolutions.ai
    //password: Yun2023!
    {
      name: 'Dp',
      environment: 'production',
      apiKey: '',
      vendorDomain : "",
      tokenEndpoint : "",
      createOrderEndpoint : "https://login.yccang.com/Api/Express/CreateLabel.ashx?",
      cancelOrderEndpoint : "https://login.yccang.com/Api/Express/LabelsCancel.ashx?",
    },
    {
      name: 'Dp',
      environment: 'development',
      apiKey: '',
      vendorDomain : "",
      tokenEndpoint : "",
      createOrderEndpoint : "https://login.yccang.com/Api/Express/CreateLabel.ashx?",
      cancelOrderEndpoint : "https://login.yccang.com/Api/Express/LabelsCancel.ashx?",
    },
    {
      name: 'Ftd',
      environment: 'production',
      apiKey: '',
      vendorDomain : "",
      tokenEndpoint : "http://gw-api.ftdint.com/api/login/access_token",
      createOrderEndpoint : "http://gw-api.ftdint.com/api/service/create_order",
      cancelOrderEndpoint : "http://gw-api.ftdint.com/api/service/cancel_order",
      refreshTokenEndpoint : "http://gw-api.ftdint.com/api/login/refresh_token",
    },
    {
      name: 'Ftd',
      environment: 'development',
      //NOTE: NO SANDBOX SERVER for FTD
    },
    {
      name: 'Pylon',
      environment: 'production',
      apiKey: '',
      vendorDomain : "https://carrier-api.pylonlogistics.com/api/auth/v4/accesstoken",
      tokenEndpoint : "https://carrier-api.pylonlogistics.com/api",
      createOrderEndpoint : "https://carrier-api.pylonlogistics.com/api/CreateShipment",
      cancelOrderEndpoint : "https://carrier-api.pylonlogistics.com/api/CancelLabel",
    },
    {
      name: 'Pylon',
      environment: 'development',
      //NOTE: NO SANDBOX SERVER for FTD
    },
    {
      name: 'Fedex',
      environment: 'production',
      apiKey: '',
      vendorDomain : "https://apis.fedex.com",
      tokenEndpoint : "https://apis.fedex.com/oauth/token",
      createOrderEndpoint : "https://apis.fedex.com/ship/v1/shipments",
      cancelOrderEndpoint : "https://apis.fedex.com/ship/v1/shipments/cancel",
    },
    {
      name: 'Fedex',
      environment: 'development',
      vendorDomain : "https://apis-sandbox.fedex.com",
      tokenEndpoint : "https://apis-sandbox.fedex.com/oauth/token",
      createOrderEndpoint : "https://apis-sandbox.fedex.com/ship/v1/shipments",
      cancelOrderEndpoint : "https://apis-sandbox.fedex.com/ship/v1/shipments/cancel",
    }
]
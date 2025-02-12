import { Vendor } from "@shared/domain/entities/Vendor";

  // Export the VENDORS constant as an array of vendor objects
  export const VENDORS: Vendor[] = [
    {
      name: 'UPS',
      trackingUrl: 'https://www.ups.com/track?loc=en_US&tracknum=',
      apiKey: '',
    },
    {
      name: 'DHL',
      trackingUrl: 'https://www.dhl.com/en/express/tracking.html?awb=',
      apiKey: '',
    },
    {
      name: 'FedEx',
      trackingUrl: 'https://www.fedex.com/apps/fedextrack/?tracknumbers=',
      apiKey: '',
    },
  ];
  
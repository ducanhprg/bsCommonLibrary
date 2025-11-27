import { IEcommercePlatformAdapter } from '@domain/interfaces/IEcommercePlatformAdapter';
import { CartroverAdapter } from '@domain/adapters/ecommerce/CartroverAdapter';

/**
 * E-commerce Platform Constants
 * Contains all supported e-commerce platform definitions with their adapters
 */

export interface IEcommercePlatform {
  code: string;                                      // Unique identifier used in code/database
  name: string;                                      // Display name
  description?: string;                              // Optional description
  adapter: new () => IEcommercePlatformAdapter;      // Adapter class for this platform
}

/**
 * Supported e-commerce platforms
 * This is the single source of truth for all platform definitions
 */
export const ECOMMERCE_PLATFORMS: Record<string, IEcommercePlatform> = {
  CARTROVER: {
    code: 'cartrover',
    name: 'Cart Rover',
    description: 'CartRover warehouse management and order fulfillment',
    adapter: CartroverAdapter
  }
  // Add more platforms here:
  // SHIPSTATION: {
  //   code: 'shipstation',
  //   name: 'ShipStation',
  //   description: 'ShipStation shipping and fulfillment platform',
  //   adapter: ShipStationAdapter
  // },
  // SHOPIFY: {
  //   code: 'shopify',
  //   name: 'Shopify',
  //   description: 'Shopify e-commerce platform',
  //   adapter: ShopifyAdapter
  // }
} as const;

/**
 * Get all platform codes
 */
export function getAllPlatformCodes(): string[] {
  return Object.values(ECOMMERCE_PLATFORMS).map(p => p.code);
}

/**
 * Get platform by code
 */
export function getPlatformByCode(code: string): IEcommercePlatform | undefined {
  return Object.values(ECOMMERCE_PLATFORMS).find(
    p => p.code.toLowerCase() === code.toLowerCase()
  );
}

/**
 * Check if platform code is valid
 */
export function isValidPlatformCode(code: string): boolean {
  return getAllPlatformCodes().includes(code.toLowerCase());
}

/**
 * Get all platforms as array (without adapter for API responses)
 */
export function getAllPlatforms(): Omit<IEcommercePlatform, 'adapter'>[] {
  return Object.values(ECOMMERCE_PLATFORMS).map(({ adapter, ...platform }) => platform);
}

/**
 * Get platform adapter by code
 */
export function getPlatformAdapter(code: string): (new () => IEcommercePlatformAdapter) | undefined {
  const platform = Object.values(ECOMMERCE_PLATFORMS).find(
    p => p.code.toLowerCase() === code.toLowerCase()
  );
  return platform?.adapter;
}

// Jest setup file for common configurations and global mocks

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock Date.now for consistent test results
const mockDateNow = jest.fn(() => 1234567890000);
global.Date.now = mockDateNow;

// Setup test environment
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset Date.now mock
  mockDateNow.mockReturnValue(1234567890000);
});

// Global cleanup for test environment
afterAll(async () => {
  // Allow time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Export test utilities instead of using global
export const testUtils = {
  createMockDate: (offset = 0) => new Date(1234567890000 + offset),
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
}; 
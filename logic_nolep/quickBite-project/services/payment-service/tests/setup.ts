import { beforeAll, afterAll, beforeEach } from "bun:test";

// Global test setup
beforeAll(() => {
   // Set test environment variables
   process.env.NODE_ENV = 'test';
   process.env.ORDER_SERVICE_URL = 'http://localhost:3002';
   process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3003';

   // Mock console to reduce noise during tests
   console.log = () => { };
   console.warn = () => { };
});

afterAll(() => {
   // Cleanup after all tests
   delete process.env.NODE_ENV;
   delete process.env.ORDER_SERVICE_URL;
   delete process.env.NOTIFICATION_SERVICE_URL;
});

beforeEach(() => {
   // Reset any global state before each test
});
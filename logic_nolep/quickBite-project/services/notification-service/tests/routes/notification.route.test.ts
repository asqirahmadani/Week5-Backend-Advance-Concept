import { notificationRoutes } from "../../src/routes/notification.routes";
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";

// Define proper types for mock responses
interface MockNotificationHistory {
   id: string;
   userId: string;
   status: string;
   templateKey: string;
   notificationType: string;
   recipient: string;
   subject: string;
   content: string;
   createdAt: string;
}

interface MockNotificationResponse {
   notificationId: string;
   userId: string;
   templateKey: string;
   notificationType: string;
   recipient: string;
   subject: string;
   content: string;
}

interface MockStats {
   status: string;
   type: string;
   count: number;
}

interface MockProcessResult {
   success: boolean;
   queueId: string;
   error?: string;
}

interface MockRetryResult {
   queueId: string;
   retryCount: number;
}

// Mock NotificationService with proper types
const mockNotificationService = {
   getNotificationHistory: mock((): Promise<MockNotificationHistory[]> => Promise.resolve([])),
   queueNotification: mock((): Promise<MockNotificationResponse> => Promise.resolve({
      notificationId: 'test-123',
      userId: 'user-123',
      templateKey: 'test',
      notificationType: 'email',
      recipient: 'test@example.com',
      subject: 'Test',
      content: 'Test content'
   })),
   getNotificationStats: mock((): Promise<MockStats[]> => Promise.resolve([])),
   processPendingNotifications: mock((): Promise<MockProcessResult[]> => Promise.resolve([])),
   retryFailedNotifications: mock((): Promise<MockRetryResult[]> => Promise.resolve([]))
};

// Mock database
const mockDb = {};

describe("Notification Routes", () => {
   let app: any;

   beforeEach(() => {
      // Create new app instance with mocked database
      app = new Elysia()
         .derive(() => ({
            db: mockDb
         }))
         .use(notificationRoutes);

      // Reset all mocks
      mockNotificationService.getNotificationHistory.mockClear();
      mockNotificationService.queueNotification.mockClear();
      mockNotificationService.getNotificationStats.mockClear();
      mockNotificationService.processPendingNotifications.mockClear();
      mockNotificationService.retryFailedNotifications.mockClear();

      // Mock the NotificationService constructor
      const NotificationService = require("../../src/services/notification.service").NotificationService;
      NotificationService.prototype.getNotificationHistory = mockNotificationService.getNotificationHistory;
      NotificationService.prototype.queueNotification = mockNotificationService.queueNotification;
      NotificationService.prototype.getNotificationStats = mockNotificationService.getNotificationStats;
      NotificationService.prototype.processPendingNotifications = mockNotificationService.processPendingNotifications;
      NotificationService.prototype.retryFailedNotifications = mockNotificationService.retryFailedNotifications;
   });

   describe("Protected Routes", () => {
      const validHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'user',
         'x-user-email': 'user@test.com'
      };

      describe("GET /api/notifications/history", () => {
         it("should get notification history successfully", async () => {
            const mockHistory: MockNotificationHistory[] = [
               {
                  id: 'notif-1',
                  userId: 'user-123',
                  status: 'sent',
                  templateKey: 'welcome-email',
                  notificationType: 'email',
                  recipient: 'user@test.com',
                  subject: 'Welcome!',
                  content: 'Welcome to our platform',
                  createdAt: `${new Date()}`
               }
            ];

            mockNotificationService.getNotificationHistory.mockResolvedValue(mockHistory);

            const response = await app.handle(
               new Request('http://localhost/api/notifications/history', {
                  method: 'GET',
                  headers: validHeaders
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
               success: true,
               data: mockHistory
            });

            expect(mockNotificationService.getNotificationHistory).toHaveBeenCalledWith('user-123', 50);
         });

         it("should handle custom limit parameter", async () => {
            mockNotificationService.getNotificationHistory.mockResolvedValue([]);

            const response = await app.handle(
               new Request('http://localhost/api/notifications/history?limit=10', {
                  method: 'GET',
                  headers: validHeaders
               })
            );

            expect(response.status).toBe(200);
            expect(mockNotificationService.getNotificationHistory).toHaveBeenCalledWith('user-123', 10);
         });

         it("should return 401 when user ID is missing", async () => {
            // Create a copy and make x-user-id optional by setting it to undefined
            const invalidHeaders: Partial<typeof validHeaders> = { ...validHeaders };
            invalidHeaders['x-user-id'] = undefined as any;
            delete (invalidHeaders as any)['x-user-id'];

            const response = await app.handle(
               new Request('http://localhost/api/notifications/history', {
                  method: 'GET',
                  headers: invalidHeaders as Record<string, string>
               })
            );

            expect(response.status).toBe(401);
         });

         it("should handle service errors", async () => {
            mockNotificationService.getNotificationHistory.mockRejectedValue(
               new Error('Database connection failed')
            );

            const response = await app.handle(
               new Request('http://localhost/api/notifications/history', {
                  method: 'GET',
                  headers: validHeaders
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data).toEqual({
               success: false,
               error: 'Database connection failed'
            });
         });
      });

      describe("POST /api/notifications/send", () => {
         it("should queue notification successfully", async () => {
            const mockNotification: MockNotificationResponse = {
               notificationId: 'queue-123',
               userId: 'user-123',
               templateKey: 'welcome-email',
               notificationType: 'email',
               recipient: 'user@test.com',
               subject: 'Welcome John!',
               content: 'Hello John, welcome!'
            };

            mockNotificationService.queueNotification.mockResolvedValue(mockNotification);

            const requestBody = {
               templateKey: 'welcome-email',
               notificationType: 'email' as const,
               recipient: 'user@test.com',
               variables: { name: 'John' }
            };

            const response = await app.handle(
               new Request('http://localhost/api/notifications/send', {
                  method: 'POST',
                  headers: {
                     ...validHeaders,
                     'content-type': 'application/json'
                  },
                  body: JSON.stringify(requestBody)
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
               success: true,
               data: mockNotification
            });

            expect(mockNotificationService.queueNotification).toHaveBeenCalledWith('user-123', requestBody);
         });

         it("should handle different notification types", async () => {
            const mockResponse: MockNotificationResponse = {
               notificationId: 'sms-123',
               userId: 'user-123',
               templateKey: 'otp-sms',
               notificationType: 'sms',
               recipient: '+1234567890',
               subject: 'OTP',
               content: 'Your code is 123456'
            };

            mockNotificationService.queueNotification.mockResolvedValue(mockResponse);

            const requestBody = {
               templateKey: 'otp-sms',
               notificationType: 'sms' as const,
               recipient: '+1234567890',
               variables: { code: '123456' }
            };

            const response = await app.handle(
               new Request('http://localhost/api/notifications/send', {
                  method: 'POST',
                  headers: {
                     ...validHeaders,
                     'content-type': 'application/json'
                  },
                  body: JSON.stringify(requestBody)
               })
            );

            expect(response.status).toBe(200);
            expect(mockNotificationService.queueNotification).toHaveBeenCalledWith('user-123', requestBody);
         });

         it("should handle scheduled notifications", async () => {
            const mockResponse: MockNotificationResponse = {
               notificationId: 'scheduled-123',
               userId: 'user-123',
               templateKey: 'reminder',
               notificationType: 'email',
               recipient: 'user@test.com',
               subject: 'Reminder',
               content: 'Don\'t forget!'
            };

            mockNotificationService.queueNotification.mockResolvedValue(mockResponse);

            const scheduledDate = new Date('2024-12-25T10:00:00Z');
            const requestBody = {
               templateKey: 'reminder',
               notificationType: 'email' as const,
               recipient: 'user@test.com',
               scheduledAt: scheduledDate
            };

            const response = await app.handle(
               new Request('http://localhost/api/notifications/send', {
                  method: 'POST',
                  headers: {
                     ...validHeaders,
                     'content-type': 'application/json'
                  },
                  body: JSON.stringify({
                     ...requestBody,
                     scheduledAt: scheduledDate.toISOString()
                  })
               })
            );

            expect(response.status).toBe(200);
         });

         it("should return 400 for invalid request body", async () => {
            const invalidBody = {
               templateKey: 'test',
               // Missing required notificationType and recipient
            };

            const response = await app.handle(
               new Request('http://localhost/api/notifications/send', {
                  method: 'POST',
                  headers: {
                     ...validHeaders,
                     'content-type': 'application/json'
                  },
                  body: JSON.stringify(invalidBody)
               })
            );

            expect(response.status).toBe(422); // Validation error
         });

         it("should handle service errors", async () => {
            mockNotificationService.queueNotification.mockRejectedValue(
               new Error('Template not found')
            );

            const requestBody = {
               templateKey: 'non-existent',
               notificationType: 'email' as const,
               recipient: 'user@test.com'
            };

            const response = await app.handle(
               new Request('http://localhost/api/notifications/send', {
                  method: 'POST',
                  headers: {
                     ...validHeaders,
                     'content-type': 'application/json'
                  },
                  body: JSON.stringify(requestBody)
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data).toEqual({
               success: false,
               error: 'Template not found'
            });
         });
      });
   });

   describe("Public Routes", () => {
      describe("GET /api/notifications/stats", () => {
         it("should get notification stats successfully", async () => {
            const mockStats: MockStats[] = [
               { status: 'sent', type: 'email', count: 150 },
               { status: 'failed', type: 'email', count: 5 },
               { status: 'sent', type: 'sms', count: 75 }
            ];

            mockNotificationService.getNotificationStats.mockResolvedValue(mockStats);

            const response = await app.handle(
               new Request('http://localhost/api/notifications/stats', {
                  method: 'GET'
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
               success: true,
               data: mockStats
            });

            expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith(30);
         });

         it("should handle custom days parameter", async () => {
            mockNotificationService.getNotificationStats.mockResolvedValue([]);

            const response = await app.handle(
               new Request('http://localhost/api/notifications/stats?days=7', {
                  method: 'GET'
               })
            );

            expect(response.status).toBe(200);
            expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith(7);
         });

         it("should handle service errors", async () => {
            mockNotificationService.getNotificationStats.mockRejectedValue(
               new Error('Database query failed')
            );

            const response = await app.handle(
               new Request('http://localhost/api/notifications/stats', {
                  method: 'GET'
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data).toEqual({
               success: false,
               error: 'Database query failed'
            });
         });
      });

      describe("POST /api/notifications/process", () => {
         it("should process pending notifications successfully", async () => {
            const mockResults: MockProcessResult[] = [
               { success: true, queueId: 'queue-1' },
               { success: true, queueId: 'queue-2' },
               { success: false, queueId: 'queue-3', error: 'SMTP failed' }
            ];

            mockNotificationService.processPendingNotifications.mockResolvedValue(mockResults);

            const response = await app.handle(
               new Request('http://localhost/api/notifications/process', {
                  method: 'POST'
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
               success: true,
               data: mockResults
            });

            expect(mockNotificationService.processPendingNotifications).toHaveBeenCalled();
         });

         it("should handle service errors", async () => {
            mockNotificationService.processPendingNotifications.mockRejectedValue(
               new Error('Processing failed')
            );

            const response = await app.handle(
               new Request('http://localhost/api/notifications/process', {
                  method: 'POST'
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data).toEqual({
               success: false,
               error: 'Processing failed'
            });
         });
      });

      describe("POST /api/notifications/retry", () => {
         it("should retry failed notifications successfully", async () => {
            const mockResults: MockRetryResult[] = [
               { queueId: 'queue-1', retryCount: 1 },
               { queueId: 'queue-2', retryCount: 2 }
            ];

            mockNotificationService.retryFailedNotifications.mockResolvedValue(mockResults);

            const response = await app.handle(
               new Request('http://localhost/api/notifications/retry', {
                  method: 'POST'
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
               success: true,
               data: mockResults
            });

            expect(mockNotificationService.retryFailedNotifications).toHaveBeenCalled();
         });

         it("should handle service errors", async () => {
            mockNotificationService.retryFailedNotifications.mockRejectedValue(
               new Error('Retry failed')
            );

            const response = await app.handle(
               new Request('http://localhost/api/notifications/retry', {
                  method: 'POST'
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data).toEqual({
               success: false,
               error: 'Retry failed'
            });
         });
      });
   });
});
import { NotificationService } from "../../src/services/notification.service";
import { EmailResult, EmailFailure } from "../../src/services/email.service";
import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock EmailService
const mockEmailService = {
   sendEmail: mock(() => Promise.resolve({ success: true, messageId: 'test-123' }))
};

// Create mock database with proper chaining
const createMockDb = () => {
   // Create a base query object that can chain methods
   const createChainableQuery = (finalResult: any = []) => {
      const chain: any = {};

      const methods = [
         'where', 'from', 'select', 'insert', 'update',
         'values', 'returning', 'set', 'orderBy', 'limit', 'groupBy'
      ];

      methods.forEach(method => {
         chain[method] = mock(() => {
            if (method === 'values' || method === 'returning' || method === 'set') {
               return Promise.resolve(finalResult);
            }
            return chain; // Return self for chaining
         });
      });

      // For terminal operations that should return promise
      chain.then = (onResolve: any) => Promise.resolve(finalResult).then(onResolve);

      return chain;
   };

   return {
      select: mock((fields?: any) => createChainableQuery()),
      insert: mock((table: any) => createChainableQuery()),
      update: mock((table: any) => createChainableQuery()),
      // For direct query results
      setResult: (result: any) => {
         // This is a helper to set what queries should return
         return createChainableQuery(result);
      }
   };
};

type status = "pending" | "processing" | "sent" | "failed" | "retry" | null;
type type = "email" | "sms" | "push";

describe("NotificationService", () => {
   let notificationService: NotificationService;
   let mockDb: any;

   beforeEach(() => {
      mockDb = createMockDb();
      notificationService = new NotificationService(mockDb);

      // Mock the email service
      (notificationService as any).emailService = mockEmailService;

      // Reset mocks
      mockEmailService.sendEmail.mockClear();
   });

   describe("createTemplate", () => {
      it("should create a notification template successfully", async () => {
         const templateData = {
            templateKey: "welcome-email",
            templateType: "email" as const,
            subject: "Welcome {{name}}!",
            content: "Hello {{name}}, welcome to our platform!",
            variables: ["name"]
         };

         const mockTemplate = {
            id: "template-123",
            ...templateData,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         // Mock the insert chain to return the template
         mockDb.insert.mockReturnValue({
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockTemplate]))
            }))
         });

         const result = await notificationService.createTemplate(templateData);

         expect(mockDb.insert).toHaveBeenCalled();
         expect(result).toEqual(mockTemplate);
      });
   });

   describe("queueNotification", () => {
      it("should queue notification successfully with existing template", async () => {
         const userId = "user-123";
         const notificationData = {
            templateKey: "welcome-email",
            notificationType: "email" as const,
            recipient: "test@example.com",
            variables: { name: "John Doe" }
         };

         const mockTemplate = {
            templateKey: "welcome-email",
            templateType: "email",
            subject: "Welcome {{name}}!",
            content: "Hello {{name}}, welcome!",
            isActive: true
         };

         const mockQueuedNotification = {
            id: "queue-123",
            userId,
            templateKey: "welcome-email",
            notificationType: "email",
            recipient: "test@example.com",
            subject: "Welcome John Doe!",
            content: "Hello John Doe, welcome!",
            variables: { name: "John Doe" },
            scheduledAt: new Date(),
            status: "pending"
         };

         // Mock template lookup
         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockTemplate]))
            }))
         });

         // Mock queue insertion
         mockDb.insert.mockReturnValue({
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockQueuedNotification]))
            }))
         });

         const result = await notificationService.queueNotification(userId, notificationData);

         expect(result.notificationId).toBe("queue-123");
         expect(result.subject).toBe("Welcome John Doe!");
         expect(result.content).toBe("Hello John Doe, welcome!");
      });

      it("should throw error when template not found", async () => {
         const userId = "user-123";
         const notificationData = {
            templateKey: "non-existent",
            notificationType: "email" as const,
            recipient: "test@example.com"
         };

         // Mock empty template result
         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([]))
            }))
         });

         await expect(
            notificationService.queueNotification(userId, notificationData)
         ).rejects.toThrow("Template not found: non-existent");
      });

      it("should throw error when no notification type specified", async () => {
         const userId = "user-123";
         const notificationData = {
            templateKey: "welcome-email",
            recipient: "test@example.com"
         } as any;

         await expect(
            notificationService.queueNotification(userId, notificationData)
         ).rejects.toThrow("Either templateType or notificationType must be specified");
      });
   });

   describe("processNotifications", () => {
      it("should process email notification successfully", async () => {
         const queueId = "queue-123";
         const mockNotification = {
            id: queueId,
            userId: "user-123",
            notificationType: "email",
            recipient: "test@example.com",
            subject: "Test Subject",
            content: "Test Content",
            variables: {},
            retryCount: 0,
            status: "pending"
         };

         // Mock notification lookup
         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockNotification]))
            }))
         });

         // Mock updates
         mockDb.update.mockReturnValue({
            set: mock(() => ({
               where: mock(() => Promise.resolve())
            }))
         });

         // Mock logging
         mockDb.insert.mockReturnValue({
            values: mock(() => Promise.resolve())
         });

         // Mock email service
         mockEmailService.sendEmail.mockResolvedValue({
            success: true,
            messageId: "email-123"
         });

         const result = await notificationService.processNotifications(queueId);

         expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
            "test@example.com",
            "Test Subject",
            "Test Content",
            {}
         );
         expect(result).toEqual({ success: true, queueId });
      });

      it("should handle SMS notification", async () => {
         const queueId = "queue-sms";
         const mockNotification = {
            id: queueId,
            notificationType: "sms",
            recipient: "+1234567890",
            content: "Test SMS",
            retryCount: 0
         };

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockNotification]))
            }))
         });

         mockDb.update.mockReturnValue({
            set: mock(() => ({
               where: mock(() => Promise.resolve())
            }))
         });

         mockDb.insert.mockReturnValue({
            values: mock(() => Promise.resolve())
         });

         const result = await notificationService.processNotifications(queueId);
         expect(result).toEqual({ success: true, queueId });
      });

      it("should handle push notification", async () => {
         const queueId = "queue-push";
         const mockNotification = {
            id: queueId,
            notificationType: "push",
            recipient: "device-token-123",
            content: "Push Content",
            retryCount: 0
         };

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockNotification]))
            }))
         });

         mockDb.update.mockReturnValue({
            set: mock(() => ({
               where: mock(() => Promise.resolve())
            }))
         });

         mockDb.insert.mockReturnValue({
            values: mock(() => Promise.resolve())
         });

         const result = await notificationService.processNotifications(queueId);
         expect(result).toEqual({ success: true, queueId });
      });

      it("should return error when notification not found", async () => {
         const queueId = "non-existent";

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([]))
            }))
         });

         const result = await notificationService.processNotifications(queueId);
         expect(result).toEqual({ success: false, error: "Notification not found" });
      });

      it("should handle email service failure", async () => {
         const queueId = "queue-fail";
         const mockNotification = {
            id: queueId,
            userId: "user-123",
            notificationType: "email",
            recipient: "test@example.com",
            subject: "Test Subject",
            content: "Test Content",
            variables: {},
            retryCount: 0,
            status: "pending"
         };

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockNotification]))
            }))
         });

         mockDb.update.mockReturnValue({
            set: mock(() => ({
               where: mock(() => Promise.resolve())
            }))
         });

         mockDb.insert.mockReturnValue({
            values: mock(() => Promise.resolve())
         });

         // Fix: Override the default mock for this specific test
         const emailFailureResponse: EmailFailure = {
            success: false,
            error: "SMTP connection failed"
         };
         mockEmailService.sendEmail.mockResolvedValueOnce(emailFailureResponse as any);

         const result = await notificationService.processNotifications(queueId);
         expect(result).toEqual({ success: false, queueId });
      });


      it("should handle unexpected errors", async () => {
         const queueId = "queue-error";
         const mockNotification = {
            id: queueId,
            userId: "user-123",
            notificationType: "email",
            recipient: "test@example.com",
            subject: "Test Subject",
            content: "Test Content",
            variables: {},
            retryCount: 0,
            status: "pending"
         };

         // Mock successful notification lookup
         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockNotification]))
            }))
         });

         // Mock the first update to succeed, but make emailService throw an error
         mockDb.update.mockReturnValue({
            set: mock(() => ({
               where: mock(() => Promise.resolve())
            }))
         });

         // Mock insert for logging to succeed
         mockDb.insert.mockReturnValue({
            values: mock(() => Promise.resolve())
         });

         // Make email service throw an unexpected error (not return a failure response)
         mockEmailService.sendEmail.mockRejectedValue(new Error("Network timeout"));

         const result = await notificationService.processNotifications(queueId);
         expect(result.success).toBe(false);
         expect(result.error).toBe("Network timeout");
      });
   });

   describe("processPendingNotifications", () => {
      it("should process multiple pending notifications", async () => {
         const mockPendingNotifications = [
            { id: "queue-1", status: "pending", scheduledAt: new Date() },
            { id: "queue-2", status: "pending", scheduledAt: new Date() }
         ];

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.resolve(mockPendingNotifications))
               }))
            }))
         });

         // Mock processNotifications calls
         let callCount = 0;
         const originalProcess = notificationService.processNotifications;
         notificationService.processNotifications = mock(async (queueId: string) => {
            callCount++;
            return { success: true, queueId };
         });

         const results = await notificationService.processPendingNotifications();

         expect(results).toHaveLength(2);
         expect(callCount).toBe(2);

         // Restore original method
         notificationService.processNotifications = originalProcess;
      });
   });

   describe("getNotificationHistory", () => {
      it("should return user notification history", async () => {
         const userId = "user-123";
         const mockHistory = [
            {
               id: "queue-1",
               userId,
               status: "sent" as status,
               templateKey: "template.key1",
               notificationType: "email" as type,
               recipient: "recipient@example.com",
               subject: "test subject",
               content: "test content",
               variables: ['email', 'name'],
               scheduledAt: null,
               sentAt: null,
               retryCount: 0,
               errorMessage: null,
               createdAt: new Date(),
               updatedAt: new Date()
            },
            {
               id: "queue-2",
               userId,
               status: "failed" as status,
               templateKey: "template.key2",
               notificationType: "email" as type,
               recipient: "recipient@example.com",
               subject: "test subject",
               content: "test content",
               variables: ['email', 'name'],
               scheduledAt: null,
               sentAt: null,
               retryCount: 0,
               errorMessage: null,
               createdAt: new Date(),
               updatedAt: new Date()
            }
         ];

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => ({
                  orderBy: mock(() => ({
                     limit: mock(() => Promise.resolve(mockHistory))
                  }))
               }))
            }))
         });

         const result = await notificationService.getNotificationHistory(userId);
         expect(result).toEqual(mockHistory);
      });

      it("should use custom limit", async () => {
         const userId = "user-123";
         const limit = 10;
         const mockHistory: any[] = [];

         const limitMock = mock(() => Promise.resolve(mockHistory));
         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => ({
                  orderBy: mock(() => ({
                     limit: limitMock
                  }))
               }))
            }))
         });

         await notificationService.getNotificationHistory(userId, limit);
         expect(limitMock).toHaveBeenCalledWith(limit);
      });
   });

   describe("getNotificationStats", () => {
      it("should return notification statistics", async () => {
         const mockStats = [
            { status: "sent" as status, type: "email" as type, count: 10 },
            { status: "failed" as status, type: "email" as type, count: 2 },
            { status: "sent" as status, type: "sms" as type, count: 5 }
         ];

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => ({
                  groupBy: mock(() => Promise.resolve(mockStats))
               }))
            }))
         });

         const result = await notificationService.getNotificationStats(7);
         expect(result).toEqual(mockStats);
      });
   });

   describe("retryFailedNotifications", () => {
      it("should retry failed notifications", async () => {
         const mockFailedNotifications = [
            { id: "queue-1", retryCount: 1, status: "failed" },
            { id: "queue-2", retryCount: 2, status: "failed" }
         ];

         mockDb.select.mockReturnValue({
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.resolve(mockFailedNotifications))
               }))
            }))
         });

         mockDb.update.mockReturnValue({
            set: mock(() => ({
               where: mock(() => Promise.resolve())
            }))
         });

         const results = await notificationService.retryFailedNotifications(3);

         expect(results).toHaveLength(2);
         expect(results[0]).toEqual({ queueId: "queue-1", retryCount: 2 });
         expect(results[1]).toEqual({ queueId: "queue-2", retryCount: 3 });
      });
   });

   describe("logNotification", () => {
      it("should log notification result", async () => {
         const queueId = "queue-123";
         const status = "sent";
         const response = { messageId: "email-123", success: true };

         mockDb.insert.mockReturnValue({
            values: mock(() => Promise.resolve())
         });

         await notificationService.logNotification(queueId, status, response);

         expect(mockDb.insert).toHaveBeenCalled();
      });
   });
});
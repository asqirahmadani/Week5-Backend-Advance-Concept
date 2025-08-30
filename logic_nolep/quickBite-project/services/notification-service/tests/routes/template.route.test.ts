import { describe, it, expect, beforeEach, mock } from "bun:test";
import { templateRoutes } from "../../src/routes/template.routes";
import { Elysia } from "elysia";

// Define proper types for mock template responses
interface MockTemplate {
   id: string;
   templateKey: string;
   templateType: string;
   subject?: string;
   content: string;
   variables?: string[];
   isActive?: boolean;
   createdAt?: string;
   updatedAt?: string;
}

// Mock NotificationService with proper typing
const mockNotificationService = {
   createTemplate: mock((): Promise<MockTemplate> => Promise.resolve({
      id: 'template-123',
      templateKey: 'welcome-email',
      templateType: 'email',
      subject: 'Welcome {{name}}!',
      content: 'Hello {{name}}, welcome to our platform!',
      variables: ['name'],
      isActive: true,
      createdAt: `${new Date()}`,
      updatedAt: `${new Date()}`
   }))
};

// Mock database
const mockDb = {};

describe("Template Routes", () => {
   let app: any;

   beforeEach(() => {
      // Create new app instance with mocked database
      app = new Elysia()
         .derive(() => ({
            db: mockDb
         }))
         .use(templateRoutes);

      // Reset all mocks
      mockNotificationService.createTemplate.mockClear();

      // Mock the NotificationService constructor
      const NotificationService = require("../../src/services/notification.service").NotificationService;
      NotificationService.prototype.createTemplate = mockNotificationService.createTemplate;
   });

   describe("POST /api/templates", () => {
      const adminHeaders = {
         'x-user-id': 'admin-123',
         'x-user-role': 'admin',
         'x-user-email': 'admin@test.com'
      };

      const userHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'user',
         'x-user-email': 'user@test.com'
      };

      it("should create email template successfully", async () => {
         const mockTemplate: MockTemplate = {
            id: 'template-123',
            templateKey: 'welcome-email',
            templateType: 'email',
            subject: 'Welcome {{name}}!',
            content: 'Hello {{name}}, welcome to our platform!',
            variables: ['name'],
            isActive: true,
            createdAt: `${new Date()}`,
            updatedAt: `${new Date()}`
         };

         mockNotificationService.createTemplate.mockResolvedValue(mockTemplate);

         const requestBody = {
            templateKey: 'welcome-email',
            templateType: 'email' as const,
            subject: 'Welcome {{name}}!',
            content: 'Hello {{name}}, welcome to our platform!',
            variables: ['name']
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);

         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockTemplate
         });

         expect(mockNotificationService.createTemplate).toHaveBeenCalledWith(requestBody);
      });

      it("should create SMS template successfully", async () => {
         const mockTemplate: MockTemplate = {
            id: 'template-456',
            templateKey: 'otp-sms',
            templateType: 'sms',
            subject: undefined, // SMS templates don't need subject
            content: 'Your OTP code is {{code}}. Valid for 5 minutes.',
            variables: ['code'],
            isActive: true,
            createdAt: `${new Date()}`,
            updatedAt: `${new Date()}`
         };

         mockNotificationService.createTemplate.mockResolvedValue(mockTemplate);

         const requestBody = {
            templateKey: 'otp-sms',
            templateType: 'sms' as const,
            content: 'Your OTP code is {{code}}. Valid for 5 minutes.',
            variables: ['code']
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);

         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockTemplate
         });

         expect(mockNotificationService.createTemplate).toHaveBeenCalledWith(requestBody);
      });

      it("should create push notification template successfully", async () => {
         const mockTemplate: MockTemplate = {
            id: 'template-789',
            templateKey: 'order-update',
            templateType: 'push',
            subject: undefined, // Push notifications don't need subject
            content: 'Your order {{orderNumber}} has been {{status}}',
            variables: ['orderNumber', 'status'],
            isActive: true,
            createdAt: `${new Date()}`,
            updatedAt: `${new Date()}`
         };

         mockNotificationService.createTemplate.mockResolvedValue(mockTemplate);

         const requestBody = {
            templateKey: 'order-update',
            templateType: 'push' as const,
            content: 'Your order {{orderNumber}} has been {{status}}',
            variables: ['orderNumber', 'status']
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);

         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockTemplate
         });
      });

      it("should create template without optional fields", async () => {
         const mockTemplate: MockTemplate = {
            id: 'template-minimal',
            templateKey: 'simple-notification',
            templateType: 'email',
            subject: undefined, // No subject provided
            content: 'This is a simple notification without variables.',
            variables: undefined, // No variables
            isActive: true,
            createdAt: `${new Date()}`,
            updatedAt: `${new Date()}`
         };

         mockNotificationService.createTemplate.mockResolvedValue(mockTemplate);

         const requestBody = {
            templateKey: 'simple-notification',
            templateType: 'email' as const,
            content: 'This is a simple notification without variables.'
            // No subject or variables
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);

         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockTemplate
         });
      });

      it("should return 401 when user ID is missing", async () => {
         const invalidHeaders: Partial<typeof adminHeaders> = { ...adminHeaders };
         invalidHeaders['x-user-id'] = undefined as any;
         delete (invalidHeaders as any)['x-user-id'];

         const requestBody = {
            templateKey: 'test-template',
            templateType: 'email' as const,
            content: 'Test content'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...invalidHeaders,
                  'content-type': 'application/json'
               } as Record<string, string>,
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(401);
      });

      it("should return 401 when user is not admin", async () => {
         const requestBody = {
            templateKey: 'test-template',
            templateType: 'email' as const,
            content: 'Test content'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...userHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(401);
      });

      it("should return 400 for invalid template type", async () => {
         const requestBody = {
            templateKey: 'test-template',
            templateType: 'invalid-type', // Invalid type
            content: 'Test content'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(422); // Validation error
      });

      it("should return 400 for missing required fields", async () => {
         const requestBody = {
            templateKey: 'test-template',
            // Missing templateType and content
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(422); // Validation error
      });

      it("should return 422 for empty template key", async () => {
         // Mock the service to not be called since validation should catch this
         mockNotificationService.createTemplate.mockRejectedValue(new Error("Should not reach service"));

         const requestBody = {
            templateKey: '', // Empty string
            templateType: 'email' as const,
            content: 'Test content'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(422); // Validation error
      });

      it("should return 422 for empty content", async () => {
         // Mock the service to not be called since validation should catch this
         mockNotificationService.createTemplate.mockRejectedValue(new Error("Should not reach service"));

         const requestBody = {
            templateKey: 'test-template',
            templateType: 'email' as const,
            content: '' // Empty content
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(422); // Validation error
      });

      it("should handle service errors", async () => {
         mockNotificationService.createTemplate.mockRejectedValue(
            new Error('Template key already exists')
         );

         const requestBody = {
            templateKey: 'duplicate-template',
            templateType: 'email' as const,
            content: 'Test content'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(400);

         const data = await response.json();
         expect(data).toEqual({
            success: false,
            error: 'Template key already exists'
         });
      });

      it("should handle unknown service errors", async () => {
         mockNotificationService.createTemplate.mockRejectedValue(
            'Unknown error' // Non-Error object
         );

         const requestBody = {
            templateKey: 'error-template',
            templateType: 'email' as const,
            content: 'Test content'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(400);

         const data = await response.json();
         expect(data).toEqual({
            success: false,
            error: 'Failed to create template'
         });
      });

      it("should handle complex template with multiple variables", async () => {
         const mockTemplate: MockTemplate = {
            id: 'template-complex',
            templateKey: 'order-confirmation',
            templateType: 'email',
            subject: 'Order {{orderNumber}} Confirmed - {{customerName}}',
            content: `Dear {{customerName}},
               
Your order {{orderNumber}} has been confirmed.
Total: {{total}}
Delivery Date: {{deliveryDate}}

Thank you for shopping with {{companyName}}!`,
            variables: ['orderNumber', 'customerName', 'total', 'deliveryDate', 'companyName'],
            isActive: true,
            createdAt: `${new Date()}`,
            updatedAt: `${new Date()}`
         };

         mockNotificationService.createTemplate.mockResolvedValue(mockTemplate);

         const requestBody = {
            templateKey: 'order-confirmation',
            templateType: 'email' as const,
            subject: 'Order {{orderNumber}} Confirmed - {{customerName}}',
            content: `Dear {{customerName}},
               
Your order {{orderNumber}} has been confirmed.
Total: {{total}}
Delivery Date: {{deliveryDate}}

Thank you for shopping with {{companyName}}!`,
            variables: ['orderNumber', 'customerName', 'total', 'deliveryDate', 'companyName']
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...adminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);

         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockTemplate
         });

         expect(mockNotificationService.createTemplate).toHaveBeenCalledWith(requestBody);
      });
   });

   describe("Authentication and Authorization", () => {
      it("should accept valid admin user", async () => {
         const mockTemplate: MockTemplate = {
            id: 'auth-test',
            templateKey: 'auth-test',
            templateType: 'email',
            subject: undefined,
            content: 'Test content',
            variables: undefined,
            isActive: true,
            createdAt: `${new Date()}`,
            updatedAt: `${new Date()}`
         };

         mockNotificationService.createTemplate.mockResolvedValue(mockTemplate);

         const validAdminHeaders = {
            'x-user-id': 'admin-456',
            'x-user-role': 'admin',
            'x-user-email': 'admin@company.com'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...validAdminHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify({
                  templateKey: 'auth-test',
                  templateType: 'email',
                  content: 'Test content'
               })
            })
         );

         expect(response.status).toBe(200);
      });

      it("should reject requests with missing authentication headers", async () => {
         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  'content-type': 'application/json'
               },
               body: JSON.stringify({
                  templateKey: 'test',
                  templateType: 'email',
                  content: 'Test'
               })
            })
         );

         expect(response.status).toBe(401);
      });

      it("should reject non-admin users even with valid authentication", async () => {
         const managerHeaders = {
            'x-user-id': 'manager-123',
            'x-user-role': 'manager',
            'x-user-email': 'manager@company.com'
         };

         const response = await app.handle(
            new Request('http://localhost/api/templates', {
               method: 'POST',
               headers: {
                  ...managerHeaders,
                  'content-type': 'application/json'
               },
               body: JSON.stringify({
                  templateKey: 'test',
                  templateType: 'email',
                  content: 'Test'
               })
            })
         );

         expect(response.status).toBe(401);
      });
   });
});
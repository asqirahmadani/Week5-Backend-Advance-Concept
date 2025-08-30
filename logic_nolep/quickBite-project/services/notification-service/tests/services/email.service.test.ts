import { EmailService, type ITransporter, type ITemplateEngine } from "../../src/services/email.service";
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

describe("EmailService", () => {
   let mockTransporter: ITransporter;
   let mockTemplateEngine: ITemplateEngine;
   let emailService: EmailService;
   let originalEnv: NodeJS.ProcessEnv;

   beforeEach(() => {
      // Store original environment
      originalEnv = { ...process.env };

      // Set test environment variables
      process.env.SMTP_FROM = 'test@example.com';

      // Create mock transporter
      mockTransporter = {
         sendMail: mock(() => Promise.resolve({ messageId: 'test-123' }))
      };

      // Create mock template engine
      mockTemplateEngine = {
         compile: mock((template: string) => {
            return mock((variables: Record<string, any> = {}) => {
               let result = template;
               for (const [key, value] of Object.entries(variables)) {
                  result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
               }
               return result;
            });
         })
      };

      // Create service with mocked dependencies
      emailService = new EmailService(mockTransporter, mockTemplateEngine);

      // Reset mocks
      (mockTransporter.sendMail as any).mockClear();
      (mockTemplateEngine.compile as any).mockClear();
   });

   afterEach(() => {
      // Restore environment
      process.env = originalEnv;
   });

   describe("constructor", () => {
      it("should use provided transporter and template engine", () => {
         const service = new EmailService(mockTransporter, mockTemplateEngine);
         expect(service).toBeInstanceOf(EmailService);
      });

      it("should create default transporter when none provided", () => {
         const service = new EmailService();
         expect(service).toBeInstanceOf(EmailService);
      });
   });

   describe("sendEmail", () => {
      it("should send email successfully", async () => {
         const mockResult = {
            messageId: 'email-123',
            accepted: ['recipient@test.com'],
            rejected: []
         };

         (mockTransporter.sendMail as any).mockResolvedValue(mockResult);

         const result = await emailService.sendEmail(
            'recipient@test.com',
            'Test Subject',
            'Hello {{name}}!',
            { name: 'John' }
         );

         // Verify template compilation
         expect(mockTemplateEngine.compile).toHaveBeenCalledWith('Test Subject');
         expect(mockTemplateEngine.compile).toHaveBeenCalledWith('Hello {{name}}!');

         // Verify email sending
         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'recipient@test.com',
            subject: 'Test Subject',
            html: 'Hello John!'
         });

         expect(result).toEqual({
            success: true,
            messageId: 'email-123'
         });
      });

      it("should process template variables in subject and content", async () => {
         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-456' });

         const result = await emailService.sendEmail(
            'user@test.com',
            'Welcome {{name}} to {{platform}}!',
            'Hello {{name}}, your role is {{role}}.',
            {
               name: 'Alice',
               platform: 'TestApp',
               role: 'admin'
            }
         );

         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'user@test.com',
            subject: 'Welcome Alice to TestApp!',
            html: 'Hello Alice, your role is admin.'
         });

         expect(result.success).toBe(true);
      });

      it("should handle empty variables", async () => {
         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-empty' });

         const result = await emailService.sendEmail(
            'recipient@test.com',
            'Simple Subject',
            'Simple content without variables'
         );

         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'recipient@test.com',
            subject: 'Simple Subject',
            html: 'Simple content without variables'
         });

         expect(result.success).toBe(true);
      });

      it("should use default FROM address when SMTP_FROM is not set", async () => {
         delete process.env.SMTP_FROM;

         // Create new service to pick up env change
         const newService = new EmailService(mockTransporter, mockTemplateEngine);

         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'default-test' });

         await newService.sendEmail(
            'recipient@test.com',
            'Subject',
            'Content'
         );

         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'rahmadaniasqi@gmail.com',
            to: 'recipient@test.com',
            subject: 'Subject',
            html: 'Content'
         });
      });

      it("should handle transporter sendMail errors", async () => {
         const error = new Error('SMTP connection failed');
         (mockTransporter.sendMail as any).mockRejectedValue(error);

         // Mock console.error
         const originalConsoleError = console.error;
         console.error = mock(() => { });

         const result = await emailService.sendEmail(
            'recipient@test.com',
            'Subject',
            'Content'
         );

         expect(result).toEqual({
            success: false,
            error: 'SMTP connection failed'
         });

         // Restore console.error
         console.error = originalConsoleError;
      });

      it("should handle template compilation errors", async () => {
         // Make template engine throw error
         (mockTemplateEngine.compile as any).mockImplementation(() => {
            throw new Error('Invalid template syntax');
         });

         const originalConsoleError = console.error;
         console.error = mock(() => { });

         const result = await emailService.sendEmail(
            'recipient@test.com',
            'Invalid {{template',
            'Content'
         );

         expect(result).toEqual({
            success: false,
            error: 'Invalid template syntax'
         });

         console.error = originalConsoleError;
      });

      it("should handle unknown error types", async () => {
         (mockTransporter.sendMail as any).mockRejectedValue('String error');

         const originalConsoleError = console.error;
         console.error = mock(() => { });

         const result = await emailService.sendEmail(
            'recipient@test.com',
            'Subject',
            'Content'
         );

         expect(result).toEqual({
            success: false,
            error: 'Unknown error'
         });

         console.error = originalConsoleError;
      });

      it("should handle multiple recipients", async () => {
         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'multi-test' });

         const result = await emailService.sendEmail(
            'user1@test.com,user2@test.com,user3@test.com',
            'Broadcast Message',
            'Content for all'
         );

         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'user1@test.com,user2@test.com,user3@test.com',
            subject: 'Broadcast Message',
            html: 'Content for all'
         });

         expect(result.success).toBe(true);
      });

      it("should process different variable types correctly", async () => {
         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'types-test' });

         await emailService.sendEmail(
            'user@test.com',
            'Status: {{isActive}}',
            'Balance: ${{balance}}, Premium: {{isPremium}}',
            {
               isActive: true,
               balance: 150.75,
               isPremium: false
            }
         );

         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'user@test.com',
            subject: 'Status: true',
            html: 'Balance: $150.75, Premium: false'
         });
      });

      it("should handle missing variables in template", async () => {
         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'missing-test' });

         await emailService.sendEmail(
            'user@test.com',
            'Hello {{name}}!',
            'Welcome {{name}}, your {{status}} is ready.',
            { name: 'Bob' } // status is missing
         );

         // Missing variables should remain unchanged
         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'user@test.com',
            subject: 'Hello Bob!',
            html: 'Welcome Bob, your {{status}} is ready.'
         });
      });
   });

   describe("integration scenarios", () => {
      it("should handle complex email workflow", async () => {
         const complexVariables = {
            user: 'Alice Johnson',
            order: '12345',
            amount: 99.99,
            date: '2024-01-15'
         };

         (mockTransporter.sendMail as any).mockResolvedValue({
            messageId: 'complex-123',
            accepted: ['alice@test.com']
         });

         const result = await emailService.sendEmail(
            'alice@test.com',
            'Order {{order}} Confirmation',
            'Dear {{user}}, your order {{order}} for ${{amount}} on {{date}} is confirmed.',
            complexVariables
         );

         expect(result).toEqual({
            success: true,
            messageId: 'complex-123'
         });

         expect(mockTransporter.sendMail).toHaveBeenCalledWith({
            from: 'test@example.com',
            to: 'alice@test.com',
            subject: 'Order 12345 Confirmation',
            html: 'Dear Alice Johnson, your order 12345 for $99.99 on 2024-01-15 is confirmed.'
         });
      });

      it("should maintain service functionality after multiple calls", async () => {
         (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'multi-call' });

         // First call
         await emailService.sendEmail('user1@test.com', 'Subject 1', 'Content 1');

         // Second call
         await emailService.sendEmail('user2@test.com', 'Subject 2', 'Content 2');

         expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
         expect(mockTemplateEngine.compile).toHaveBeenCalledTimes(4); // 2 calls * 2 templates each
      });
   });
});
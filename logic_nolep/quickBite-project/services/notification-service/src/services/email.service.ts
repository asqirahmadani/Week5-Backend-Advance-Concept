import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';

// Define proper return types
export interface EmailSuccess {
   success: true;
   messageId: string;
}

export interface EmailFailure {
   success: false;
   error: string;
}

export type EmailResult = EmailSuccess | EmailFailure;

// Interface for transporter
export interface ITransporter {
   sendMail(options: any): Promise<any>;
}

// Interface for template engine
export interface ITemplateEngine {
   compile(template: string): (variables: any) => string;
}

export class EmailService {
   private transporter: ITransporter;
   private templateEngine: ITemplateEngine;

   constructor(
      transporter?: ITransporter,
      templateEngine?: ITemplateEngine
   ) {
      this.transporter = transporter || this.createDefaultTransporter();
      this.templateEngine = templateEngine || Handlebars;
   }

   private createDefaultTransporter(): ITransporter {
      return nodemailer.createTransport({
         host: process.env.SMTP_HOST || 'smtp.gmail.com',
         port: parseInt(process.env.SMTP_PORT || '587'),
         secure: false,
         auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
         }
      });
   }

   async sendEmail(
      to: string,
      subject: string,
      content: string,
      variables: Record<string, any> = {}
   ): Promise<EmailResult> {
      try {
         // Compile templates
         const subjectTemplate = this.templateEngine.compile(subject);
         const contentTemplate = this.templateEngine.compile(content);

         // Process templates with variables
         const processedSubject = subjectTemplate(variables);
         const processedContent = contentTemplate(variables);

         const mailOptions = {
            from: process.env.SMTP_FROM || 'rahmadaniasqi@gmail.com',
            to,
            subject: processedSubject,
            html: processedContent
         };

         const result = await this.transporter.sendMail(mailOptions);
         return { success: true, messageId: result.messageId };
      } catch (error) {
         console.error('Email sending failed:', error);
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
         };
      }
   }
}
import { NotificationService } from "../services/notification.service";
import { rabbitmq } from "../config/rabbitmq";

export class NotificationWorker {
   private notificationService: NotificationService;
   private isRunning: boolean;

   constructor() {
      this.notificationService = new NotificationService();
      this.isRunning = false;
   }

   async start() {
      this.isRunning = true;
      console.log('📧 Notification worker started');

      await rabbitmq.connect();
      const channel = rabbitmq.getChannel();

      if (channel) {
         // Listen for email notifications
         await channel.consume('email.order.confirmation', async (msg: any) => {
            if (msg) {
               const data = JSON.parse(msg.content.toString());
               await this.processEmailNotification(data);
               channel.ack(msg);
            }
         });

         // Listen for other notification types
         await channel.consume('email.order.cancelled', async (msg: any) => {
            if (msg) {
               const data = JSON.parse(msg.content.toString());
               await this.processEmailNotification(data);
               channel.ack(msg);
            }
         });
      }

      this.startPeriodicProcessing();
   }

   private async processEmailNotification(data: any) {
      try {
         await this.notificationService.queueNotification({
            userId: data.userId,
            templateKey: data.templateKey,
            notificationType: 'email',
            recipient: data.email,
            variables: data.variables
         });
      } catch (error) {
         console.error('Failed to process email notification:', error);
      }
   }

   private startPeriodicProcessing() {
      setInterval(async () => {
         if (this.isRunning) {
            try {
               await this.notificationService.processPendingNotifications();
               await this.notificationService.retryFailedNotifications();
            } catch (error) {
               console.error('Error in periodic processing:', error);
            }
         }
      }, 30000)   // process every 30 seconds
   }

   stop() {
      this.isRunning = false;
      rabbitmq.close();
      console.log('📧 Notification worker stopped');
   }
}
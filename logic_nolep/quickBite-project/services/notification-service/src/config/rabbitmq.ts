import * as amqp from 'amqplib';

class RabbitMQConnection {
   private connection: any = null;
   private channel: any = null;

   async connect(): Promise<void> {
      try {
         this.connection = await amqp.connect(process.env.CLOUDAMQP_URL || 'amqp://localhost');
         this.channel = await this.connection.createChannel();

         // Declare exchanges and queues
         await this.setupQueues();
         console.log('📧 Connected to RabbitMQ');
      } catch (error) {
         console.error('Failed to connect to RabbitMQ:', error);
         throw error;
      }
   }

   private async setupQueues(): Promise<void> {
      if (!this.channel) return;

      const exchanges = ['email', 'sms', 'push'];
      const queues = [
         'email.order.confirmation',
         'email.order.cancelled',
         'email.payment.received',
         'email.refund.processed',
         'email.delivery.updates',
         'sms.order.updates',
         'push.order.status'
      ];

      // Create exchanges
      for (const exchange of exchanges) {
         await this.channel.assertExchange(exchange, 'topic', { durable: true });
      }

      // Create queues
      for (const queue of queues) {
         await this.channel.assertQueue(queue, { durable: true });
      }
   }

   getChannel(): any {
      return this.channel;
   }

   async close(): Promise<void> {
      try {
         if (this.channel) {
            await this.channel.close();
         }
         if (this.connection) {
            await this.connection.close();
         }
      } catch (error) {
         console.error('Error closing RabbitMQ connection:', error);
      }
   }
}

export const rabbitmq = new RabbitMQConnection();
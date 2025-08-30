import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { refunds } from './routes/refund.route';
import { payments } from './routes/payment.route';
import { createWebhookRoutes } from './routes/webhook.route';
import { errorHandler } from './middleware/errorHandler';

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'Payment Service API',
        version: '1.0.0',
        description: 'Payment processing service for QuickBite food delivery platform',
      },
      servers: [
        {
          url: 'http://localhost:3004',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Payments', description: 'Payment operations' },
        { name: 'Refunds', description: 'Refund operations' },
        { name: 'Webhooks', description: 'Webhook handlers' },
      ],
    }
  }))

  .use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }))
  .use(payments)
  .use(refunds)
  .use(createWebhookRoutes())
  .use(errorHandler)
  .listen(process.env.PORT_PAYMENT || 3004);

console.log(`🚀 Payment Service running on port ${process.env.PORT_PAYMENT}`);
console.log(`📚 API Documentation: http://localhost:${process.env.PORT_PAYMENT}/swagger`);
console.log(`💳 Payments API: http://localhost:${process.env.PORT_PAYMENT}/api/payments`);
console.log(`🔄 Refunds API: http://localhost:${process.env.PORT_PAYMENT}/api/refunds`);
console.log(`🪝 Webhooks: http://localhost:${process.env.PORT_PAYMENT}/webhooks`);

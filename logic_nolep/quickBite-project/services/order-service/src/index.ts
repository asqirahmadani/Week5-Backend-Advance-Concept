import jwt from '@elysiajs/jwt';
import { db } from './db/client';
import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { bearer } from '@elysiajs/bearer';
import { swagger } from '@elysiajs/swagger';
import { orderRoutes } from './routes/order.route';
import { errorHandler } from './middleware/errorHandler';

const app = new Elysia()
  .use(cors({ credentials: true, origin: 'http://localhost' }))
  .decorate('db', db)
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET! || '081bf92884614a5944007b1c92d44e38e61a101fb284588567894b1fb0068778',
      exp: '7d'
    })
  )
  .use(bearer())
  .use(swagger({ path: '/docs' }))
  .use(orderRoutes)
  .use(errorHandler)
  .listen(process.env.PORT_ORDER || 3003);

console.log(`🍕 Order Service running at http://localhost:3003`);

export type OrderApp = typeof app;
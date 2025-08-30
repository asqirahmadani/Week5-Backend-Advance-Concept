import { Elysia } from "elysia";
import { db } from './db/client';
import { jwt } from '@elysiajs/jwt'
import { cors } from '@elysiajs/cors';
import { bearer } from '@elysiajs/bearer';
import { swagger } from '@elysiajs/swagger';
import { errorHandler } from "./middleware/errorHandler";
import { notificationRoutes } from "./routes/notification.routes";

const app = new Elysia()
  .use(cors())
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
  .use(notificationRoutes)
  .use(errorHandler)
  .listen(process.env.PORT_NOTIFICATION || 3007);

console.log(`📧 Notification Service is running at http://localhost:3007`);
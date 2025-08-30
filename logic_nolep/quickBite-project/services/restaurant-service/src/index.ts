import { Elysia } from 'elysia';
import jwt from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { bearer } from '@elysiajs/bearer';
import { swagger } from '@elysiajs/swagger';
import { menuRoutes } from './routes/menu.routes';
import { errorHandler } from './middleware/errorHandler';
import { restaurantRoutes } from './routes/restaurant.route';

const app = new Elysia()
  .use(cors({ credentials: true, origin: 'http://localhost' }))
  .use(bearer())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET! || '081bf92884614a5944007b1c92d44e38e61a101fb284588567894b1fb0068778',
      exp: '7d'
    })
  )
  .use(swagger({ path: '/docs' }))
  .use(restaurantRoutes)
  .use(menuRoutes)
  .use(errorHandler)
  .listen(process.env.PORT_RESTAURANT || 3002);

console.log(`🦊 Users service running at ${app.server?.hostname}:${app.server?.port}`);
import { Elysia } from 'elysia';
import jwt from '@elysiajs/jwt';
import { cors } from '@elysiajs/cors';
import { bearer } from '@elysiajs/bearer';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth.route';
import { userRoutes } from './routes/user.route';
import { errorHandler } from './middleware/errorHandler';

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
  .use(authRoutes)
  .use(userRoutes)
  .use(errorHandler)
  .listen(process.env.PORT_USER || 3001);

console.log(`🦊 Users service running at ${app.server?.hostname}:${app.server?.port}`);
import { logger } from './logger';
import type { APIError } from '@/types';

export const errorHandler = {
   onError({ code, error, set }: any): APIError {
      logger.error({ error: error.message, code }, 'Application error');

      switch (code) {
         case 'VALIDATION':
            set.status = 400;
            return { success: false, error: 'Validation error', statusCode: 400 };

         case 'NOT_FOUND':
            set.status = 404;
            return { success: false, error: 'Resource not found', statusCode: 404 };

         case 'UNAUTHORIZED':
            set.status = 401;
            return { success: false, error: 'Unauthorized', statusCode: 401 };

         case 'FORBIDDEN':
            set.status = 403;
            return { success: false, error: 'Forbidden', statusCode: 403 };

         default:
            set.status = 500;
            return {
               success: false,
               error: 'Internal server error',
               statusCode: 500
            };
      }
   }
};
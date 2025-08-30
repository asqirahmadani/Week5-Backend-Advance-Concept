import { Elysia } from 'elysia';

export const errorHandler = new Elysia()
    .onError(({ code, error, set }) => {
        switch (code) {
            case 'VALIDATION':
                set.status = 400;
                return { error: error.message };
            case 'NOT_FOUND':
                set.status = 404;
                return { error: 'Resource not found' };
            default:
                set.status = 500;
                return { error: 'Internal server error' };
        }
    });
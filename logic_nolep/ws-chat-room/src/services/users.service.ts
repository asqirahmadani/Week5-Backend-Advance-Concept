import { db } from "../db";
import { users } from "../db/schema";
import { eq } from 'drizzle-orm';

export class UserService {
    async createUser(username: string) {
        try {
            const result = await db.insert(users)
                .values({ username })
                .returning()
                .execute();
            return result[0];
        } catch (error) {
            // handle unique constraint violation
            const existingUser = await db.select()
                .from(users)
                .where(eq(users.username, username))
                .limit(1)
                .execute();
            return existingUser[0];
        }
    }

    async updateLastSeen(username: string) {
        return await db.update(users)
            .set({ lastSeen: new Date() })
            .where(eq(users.username, username))
            .returning()
            .execute()
    }

    async getUserByUsername(username: string) {
        const result = await db.select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1)
            .execute();
        return result[0];
    }

    async getUserById(id: number) {
        const result = await db.select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1)
            .execute()
        return result[0];
    }
}
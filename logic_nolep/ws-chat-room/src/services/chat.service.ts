import { db } from "../db";
import { users, messages } from "../db/schema";
import { and, eq } from 'drizzle-orm';

export class ChatService {
    async getRecentMessages(limit: number = 50, roomId?: number) {
        if (roomId) {
            return await db.select({
                id: messages.id,
                content: messages.content,
                username: users.username,
                roomId: messages.roomId,
                createdAt: messages.createdAt
            })
                .from(messages)
                .leftJoin(users, eq(messages.userId, users.id))
                .where(
                    and(
                        eq(messages.roomId, roomId),
                        eq(messages.isDeleted, false)
                    )
                )
                .orderBy(messages.createdAt)
                .limit(limit)
                .execute();
        } else {
            return await db.select({
                id: messages.id,
                content: messages.content,
                username: users.username,
                roomId: messages.roomId,
                createdAt: messages.createdAt
            })
                .from(messages)
                .leftJoin(users, eq(messages.userId, users.id))
                .where(eq(messages.isDeleted, false))
                .orderBy(messages.createdAt)
                .limit(limit)
                .execute();
        }

    }

    async saveMessage(username: string, content: string, roomId: number) {
        // find the user first
        const user = await db.select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1)
            .execute()
        if (!user.length) return null;

        // then save the message
        const result = await db.insert(messages)
            .values({
                content,
                userId: user[0]?.id,
                roomId
            })
            .returning()
            .execute();

        return {
            ...result[0],
            username
        };
    }

    async getMessageById(messageId: number) {
        try {
            const result = await db.select()
                .from(messages)
                .where(eq(messages.id, messageId))
                .limit(1)
                .execute()

            return result[0] || null;

        } catch (error) {
            console.error('Error getting message by ID:', error);
            return null;
        }
    }

    async editMessage(messageId: number, newContent: string) {
        try {
            const result = await db.update(messages)
                .set({
                    content: newContent,
                    editedAt: new Date(),
                    isEdited: true
                })
                .where(eq(messages.id, messageId))
                .returning()
                .execute();

            return result[0] || null;

        } catch (error) {
            console.error('Error editing message:', error);
            return null;
        }
    }

    async deleteMessage(messageId: number) {
        try {
            const result = await db.update(messages)
                .set({
                    content: '[This message was deleted]',
                    isDeleted: true,
                    deletedAt: new Date()
                })
                .where(eq(messages.id, messageId))
                .returning()
                .execute()

            return result[0] || null;

        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }
}
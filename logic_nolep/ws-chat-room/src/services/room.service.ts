import { db } from "../db";
import { and, asc, desc, eq, lt } from 'drizzle-orm';
import { users, rooms, roomMembers, messages } from "../db/schema";

export class RoomService {
    async createRoom(name: string, createdBy: number, isPrivate?: boolean) {
        try {
            // find the user first
            const user = await db.select()
                .from(users)
                .where(eq(users.id, createdBy))
                .limit(1)
                .execute()
            if (!user.length) return { error: 'User not found' };

            // then create room
            const result = await db.insert(rooms)
                .values({ name, createdBy, isPrivate })
                .returning()
                .execute();

            // insert into room members
            await db.insert(roomMembers)
                .values({
                    roomId: result[0]?.id,
                    userId: createdBy,
                    role: 'admin'
                })
                .execute();

            return result[0];

        } catch (error) {
            console.error('Error creating room:', error);

            const existingRoom = await db.select()
                .from(rooms)
                .where(eq(rooms.name, name))
                .limit(1)
                .execute();

            if (existingRoom.length) {
                return { error: 'Room name already exists' }
            }
            return { error: 'Failed to create room' };
        }
    }

    async getRoomList() {
        try {
            return await db.select({
                id: rooms.id,
                name: rooms.name,
                isPrivate: rooms.isPrivate,
                createdBy: rooms.createdBy,
                creatorUsername: users.username,
                createdAt: rooms.createdAt
            })
                .from(rooms)
                .leftJoin(users, eq(rooms.createdBy, users.id))
                .execute();
        } catch (error) {
            console.error('Error getting room list:', error);
            return [];
        }

    }

    async joinRoom(roomId: number, userId: number) {
        try {
            // check if room exists
            const room = await db.select()
                .from(rooms)
                .where(eq(rooms.id, roomId))
                .limit(1)
                .execute()
            if (!room.length) return null;

            // check if user exists
            const user = await db.select()
                .from(users)
                .where(eq(users.id, userId))
                .limit(1)
                .execute()
            if (!user.length) return null;

            // check if user is already a member
            const existingMember = await this.isUserMember(roomId, userId)
            if (existingMember) return { error: 'User already a member' };

            const result = await db.insert(roomMembers)
                .values({ roomId, userId })
                .returning()
                .execute();

            return result[0];
        } catch (error) {
            console.error('Error joining room:', error)
            return { error: 'Failed to join room' }
        }

    }

    async leaveRoom(roomId: number, userId: number) {
        try {
            // // check if user is the only admin
            // const adminCount = await db.select()
            //     .from(roomMembers)
            //     .where(
            //         and(
            //             eq(roomMembers.roomId, roomId),
            //             eq(roomMembers.role, 'admin')
            //         )
            //     )
            //     .execute();

            // const userRole = await db.select()
            //     .from(roomMembers)
            //     .where(
            //         and(
            //             eq(roomMembers.roomId, roomId),
            //             eq(roomMembers.userId, userId)
            //         )
            //     )
            //     .limit(1)
            //     .execute();

            // if (adminCount.length === 1 && userRole[0]?.role === 'admin') {
            //     return { error: 'Cannot leave room as the only admin' };
            // }

            const result = await db.delete(roomMembers)
                .where(
                    and(
                        eq(roomMembers.roomId, roomId),
                        eq(roomMembers.userId, userId)
                    )
                )
                .returning()
                .execute();

            return result[0];
        } catch (error) {
            console.error('Error leaving room:', error);
            return { error: 'Failed to leave room' };
        }
    }

    async getRoomMessages(roomId: number, limit: number = 20, before?: number) {
        if (before) {
            return await this.getMessagesBeforeId(roomId, before, limit);
        } else {
            return await this.getRecentMessages(roomId, limit);
        }
    }

    async getRecentMessages(roomId: number, limit: number = 20) {
        try {
            const result = await db.select({
                id: messages.id,
                content: messages.content,
                username: users.username,
                roomName: rooms.name,
                createdAt: messages.createdAt,
                updatedAt: messages.editedAt,
                isEdited: messages.isEdited
            })
                .from(messages)
                .leftJoin(users, eq(messages.userId, users.id))
                .leftJoin(rooms, eq(messages.roomId, rooms.id))
                .where(eq(messages.roomId, roomId))
                .orderBy(desc(messages.createdAt), desc(messages.id))
                .limit(limit);

            return result.reverse();

        } catch (error) {
            console.error('Error getting recent messages:', error);
            return [];
        }
    }

    async getMessagesBeforeId(roomId: number, beforeId: number, limit: number = 20) {
        try {
            const result = db.select({
                id: messages.id,
                content: messages.content,
                username: users.username,
                roomName: rooms.name,
                createdAt: messages.createdAt,
                updatedAt: messages.editedAt,
                isEdited: messages.isEdited
            })
                .from(messages)
                .leftJoin(users, eq(messages.userId, users.id))
                .leftJoin(rooms, eq(messages.roomId, rooms.id))
                .where(and(
                    eq(messages.roomId, roomId),
                    lt(messages.id, beforeId)
                ))
                .orderBy(desc(messages.createdAt), desc(messages.id))
                .limit(limit)

            return result;
        } catch (error) {
            console.error('Error getting messages before Id:', error);
            return [];
        }
    }

    async getRoomMembers(roomId: number) {
        try {
            return await db.select({
                userId: users.id,
                username: users.username,
                role: roomMembers.role,
                joinedAt: roomMembers.joinedAt
            })
                .from(roomMembers)
                .leftJoin(users, eq(roomMembers.userId, users.id))
                .where(eq(roomMembers.roomId, roomId))
                .execute();
        } catch (error) {
            console.error('Error getting room members:', error)
            return [];
        }
    }

    async isUserMember(roomId: number, userId: number): Promise<boolean> {
        try {
            const member = await db.select()
                .from(roomMembers)
                .where(
                    and(
                        eq(roomMembers.roomId, roomId),
                        eq(roomMembers.userId, userId)
                    )
                )
                .limit(1)
                .execute();
            return member.length > 0;
        } catch (error) {
            console.error('Error checking membership:', error)
            return false;
        }
    }

    async isUserAdmin(roomId: number, userId: number): Promise<boolean> {
        try {
            const admin = await db.select()
                .from(roomMembers)
                .where(
                    and(
                        eq(roomMembers.roomId, roomId),
                        eq(roomMembers.userId, userId),
                        eq(roomMembers.role, 'admin')
                    )
                )
                .limit(1)
                .execute();
            return admin.length > 0;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    async deleteRoom(roomId: number, userId: number) {
        try {
            const admin = await this.isUserAdmin(roomId, userId);
            if (!admin) return new Error('Only admin can delete room!');

            const result = await db.delete(rooms)
                .where(eq(rooms.id, roomId))
                .returning()
                .execute();
            return result[0];
        } catch (error) {
            console.error('Error deleting room:', error);
            return { error: 'Failed to delete room' };
        }
    }

    async getRoomName(roomId: number) {
        try {
            const room = await db.select()
                .from(rooms)
                .where(eq(rooms.id, roomId))
                .limit(1)
                .execute()
            return room[0];
        } catch (error) {
            console.error('Error find this room:', error);
            return { error: 'Room not found!' };
        }
    }
}
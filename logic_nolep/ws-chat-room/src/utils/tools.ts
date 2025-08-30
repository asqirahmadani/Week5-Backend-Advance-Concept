import { roomConnections, connectedUsers, userRooms } from "..";
import { UserService, RoomService } from "../services";

const userService = new UserService();
const roomService = new RoomService();

export function broadcastToAll(message: any, exludeWs?: any) {
    for (const [_, ws] of connectedUsers.entries()) {
        if (ws !== exludeWs && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
            } catch (error) {
                console.error('Error broadcasting to all:', error);
            }
        }
    }
}

export function broadcastToRoom(roomId: number, message: any, exludeWs?: any) {
    const roomUsers = roomConnections.get(roomId);
    if (roomUsers) {
        for (const [_, ws] of roomUsers.entries()) {
            if (ws !== exludeWs && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(message);
                } catch (error) {
                    console.error('Error broadcasting to room:', error);
                }
            }
        }
    }
}

export async function handleUserDisconnect(username: string) {
    await userService.updateLastSeen(username);

    // remove from global tracking
    connectedUsers.delete(username);

    // remove from room and notify room members
    const currentRoomId = userRooms.get(username);
    if (currentRoomId) {
        roomConnections.get(currentRoomId)?.delete(username);
        userRooms.delete(username);

        broadcastToRoom(currentRoomId, {
            type: 'system',
            content: `${username} left the room`,
            roomId: currentRoomId,
            timestamp: new Date()
        });
    }
}

export async function getRoomName(roomId: number) {
    try {
        const rooms = await roomService.getRoomList();
        const room = rooms.find(r => r.id === roomId);
        return room?.name || 'Unknown Room';
    } catch (error) {
        return 'Unknown Room'
    }
}
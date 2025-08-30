export interface ChatMessage {
    type: 'message' | 'join' | 'leave' | 'create_room' | 'join_room' | 'leave_room' | 'room_list' | 'delete_room' | 'error' | 'room_moved' | 'switch_room' | 'room_created' | 'edit_message' | 'delete_message';
    username?: string;
    content?: string;
    roomId?: number;
    roomName?: string;
    password?: string;
    timestamp?: Date;
}
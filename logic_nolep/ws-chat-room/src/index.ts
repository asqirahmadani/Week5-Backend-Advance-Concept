import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { staticPlugin } from '@elysiajs/static';
import { ChatService, UserService, RoomService } from './services';
import { broadcastToRoom, handleUserDisconnect, getRoomName, broadcastToAll } from './utils/tools';

// initialize services
const chatService = new ChatService();
const userService = new UserService();
const roomService = new RoomService();

// track connected users
export const connectedUsers = new Map<string, any>();

// track users current room
export const userRooms = new Map<string, number>();

// track users join by room
export const roomConnections = new Map<number, Map<string, any>>();

const app = new Elysia()
    .use(cors())
    .use(staticPlugin({
        assets: 'public',
        prefix: '/static',
        staticLimit: 1024 * 1024
    }))

    // configure swagger with detailed documentation
    .use(swagger({
        documentation: {
            info: {
                title: 'Real-time Chat API',
                version: '1.0.0',
                description: 'API for real-time chat with both WebSocket and REST endpoints'
            },
            tags: [
                { name: 'Messages', description: 'Message operations' },
                { name: 'Users', description: 'User management' },
                { name: 'Rooms', description: 'Room management' },
                { name: 'WebSocket', description: 'WebSocket connection info' }
            ]
        }
    }))

    // ejs configuration
    .get('/', async ({ request }) => {
        try {
            const templatePath = path.join(process.cwd(), 'views', 'chat.ejs');

            // Check if template exists
            if (!fs.existsSync(templatePath)) {
                console.error('Template not found:', templatePath);
                return new Response(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Chat App</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <link rel="stylesheet" href="/static/css/style.css">
                    </head>
                    <body>
                        <div id="app">
                            <h1>Real-time Chat Application</h1>
                            <p>Template file missing. Please create views/chat.ejs</p>
                            <div id="messages"></div>
                            <div>
                                <input type="text" id="messageInput" placeholder="Type your message...">
                                <button onclick="sendMessage()">Send</button>
                            </div>
                        </div>
                        <script>
                            const ws = new WebSocket('ws://localhost:3000/ws');
                            
                            ws.onopen = function() {
                                console.log('Connected to WebSocket');
                                ws.send(JSON.stringify({
                                    type: 'connect',
                                    username: 'User' + Math.floor(Math.random() * 1000),
                                    roomId: 1
                                }));
                            };
                            
                            ws.onmessage = function(event) {
                                const data = JSON.parse(event.data);
                                const messages = document.getElementById('messages');
                                messages.innerHTML += '<div>' + (data.username || 'System') + ': ' + data.content + '</div>';
                            };
                            
                            function sendMessage() {
                                const input = document.getElementById('messageInput');
                                if (input.value) {
                                    ws.send(JSON.stringify({
                                        type: 'message',
                                        username: 'TestUser',
                                        content: input.value
                                    }));
                                    input.value = '';
                                }
                            }
                            
                            document.getElementById('messageInput').addEventListener('keypress', function(e) {
                                if (e.key === 'Enter') {
                                    sendMessage();
                                }
                            });
                        </script>
                    </body>
                    </html>
                `, {
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-cache'
                    }
                });
            }

            // Try to render EJS template
            const html = await ejs.renderFile(templatePath, {
                title: 'Real-time Chat Application',
                wsUrl: `ws://localhost:3000/ws`,
                apiUrl: 'http://localhost:3000',
                maxMessageLength: 500,
                maxUsernameLength: 20,
                maxRoomNameLength: 30,
                version: '1.0.0',
                welcomeMessage: 'Welcome to our chat room!',
                additionalCSS: [],
                additionalJS: []
            });

            return new Response(html, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                }
            });
        } catch (error: any) {
            console.error('EJS Render Error:', error);

            // Fallback HTML if EJS fails
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Chat App - Error</title>
                    <meta charset="UTF-8">
                </head>
                <body>
                    <h1>Chat Application</h1>
                    <p>Error rendering template: ${error.message}</p>
                    <p>Please check your views/chat.ejs file</p>
                    <pre>${error.stack}</pre>
                </body>
                </html>
            `, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                }
            });
        }
    })

    // Enhanced debug route
    .get('/debug', () => {
        const fs = require('fs');
        const currentDir = process.cwd();

        return {
            message: 'Server is running correctly',
            currentDir,
            directories: {
                public: fs.existsSync('public'),
                views: fs.existsSync('views'),
                src: fs.existsSync('src')
            },
            files: {
                chatEjs: fs.existsSync('views/chat.ejs'),
                styleCss: fs.existsSync('public/css/style.css'),
                chatJs: fs.existsSync('public/js/chat.js')
            },
            routes: ['/', '/debug', '/test', '/static/css/style.css', '/static/js/chat.js', '/ws'],
            ejsVersion: require('ejs/package.json').version
        };
    })

    // Test route with working HTML
    .get('/test', () => {
        return new Response(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Chat Test</title>
                <link rel="stylesheet" href="/static/css/style.css">
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    #messages { border: 1px solid #ccc; height: 300px; overflow-y: auto; padding: 10px; margin: 10px 0; }
                    input, button { padding: 8px; margin: 5px; }
                </style>
            </head>
            <body>
                <h1>Chat Application Test</h1>
                <div id="connection-status">Connecting...</div>
                <div id="messages"></div>
                <div>
                    <input type="text" id="usernameInput" placeholder="Enter username" value="User${Math.floor(Math.random() * 1000)}">
                    <button onclick="connect()">Connect</button>
                </div>
                <div>
                    <input type="text" id="messageInput" placeholder="Type your message..." disabled>
                    <button onclick="sendMessage()" disabled id="sendBtn">Send</button>
                </div>
                
                <script>
                    let ws = null;
                    let username = '';
                    let connected = false;
                    
                    function updateStatus(status) {
                        document.getElementById('connection-status').textContent = status;
                    }
                    
                    function connect() {
                        username = document.getElementById('usernameInput').value;
                        if (!username) {
                            alert('Please enter a username');
                            return;
                        }
                        
                        ws = new WebSocket('ws://localhost:3000/ws');
                        
                        ws.onopen = function() {
                            updateStatus('Connected to WebSocket');
                            ws.send(JSON.stringify({
                                type: 'connect',
                                username: username,
                                roomId: 1
                            }));
                        };
                        
                        ws.onmessage = function(event) {
                            const data = JSON.parse(event.data);
                            const messages = document.getElementById('messages');
                            const messageDiv = document.createElement('div');
                            messageDiv.innerHTML = '<strong>' + (data.username || 'System') + ':</strong> ' + data.content;
                            messages.appendChild(messageDiv);
                            messages.scrollTop = messages.scrollHeight;
                            
                            if (data.type === 'system' && data.content.includes('Welcome')) {
                                connected = true;
                                document.getElementById('messageInput').disabled = false;
                                document.getElementById('sendBtn').disabled = false;
                                updateStatus('Connected and ready to chat');
                            }
                        };
                        
                        ws.onclose = function() {
                            updateStatus('Disconnected');
                            connected = false;
                            document.getElementById('messageInput').disabled = true;
                            document.getElementById('sendBtn').disabled = true;
                        };
                        
                        ws.onerror = function(error) {
                            updateStatus('Connection error: ' + error);
                        };
                    }
                    
                    function sendMessage() {
                        const input = document.getElementById('messageInput');
                        if (input.value && connected) {
                            ws.send(JSON.stringify({
                                type: 'message',
                                username: username,
                                content: input.value
                            }));
                            input.value = '';
                        }
                    }
                    
                    document.getElementById('messageInput').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            sendMessage();
                        }
                    });
                    
                    document.getElementById('usernameInput').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            connect();
                        }
                    });
                </script>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        });
    })

    // REST endpoint to get WebSocket connection details
    .get('/ws-info',
        () => ({
            websocketUrl: 'ws://localhost:3000/ws',
            messageFormats: {
                connect: { type: 'connect', username: 'string', roomId: 'number' },
                message: { type: 'message', username: 'string', content: 'string' },
                createRoom: { type: 'create_room', username: 'string', roomName: 'string', isPrivate: 'boolean' },
                switchRoom: { type: 'switch_room', username: 'string', roomId: 'number' },
                deleteRoom: { type: 'delete_room', username: 'string', roomId: 'number' },
                disconnect: { type: 'disconnect', username: 'string' }
            }
        }),
        {
            query: t.Object({
                limit: t.Optional(t.Number({
                    default: 50,
                    minimum: 1,
                    maximum: 100
                }))
            }),
            detail: {
                tags: ['Messages'],
                summary: 'Get recent messages',
                description: 'Retrieve recent chat messages from the database'
            }
        }
    )
    // REST endpoint to get a message
    .get('/messages',
        async ({ query }) => {
            const limit = Number(query?.limit || 50);
            const roomId = Number(query?.roomId)

            if (roomId) {
                return await roomService.getRoomMessages(roomId, limit);
            } else {
                return await chatService.getRecentMessages(limit);
            }
        },
        {
            detail: {
                tags: ['Messages'],
                summary: 'Get recent room message',
                description: 'Get recent room message through API'
            }
        }
    )
    // REST endpoint to send a message
    .post('/messages',
        async ({ body }) => {
            const user = await userService.getUserByUsername(body.username);
            if (!user) throw new Error('User not found');

            const roomId = body.roomId || 1;
            const isMember = await roomService.isUserMember(roomId, user.id);
            if (!isMember) throw new Error('User not member of this room');

            const message = await chatService.saveMessage(body.username, body.content, roomId);
            if (message) {
                broadcastToRoom(roomId, {
                    type: 'message',
                    username: body.username,
                    content: body.content,
                    roomId: roomId,
                    timestamp: new Date()
                });
                return message;
            }
            throw new Error('Failed to save message');
        },
        {
            body: t.Object({
                username: t.String({
                    minLength: 1,
                    description: 'Username of the sender'
                }),
                content: t.String({
                    minLength: 1,
                    description: 'Message content'
                }),
                roomId: t.Number()
            }),
            detail: {
                tags: ['Messages'],
                summary: 'Send a new message',
                description: 'Send a message through REST API (will be broadcast to WebSocket clients)'
            }
        }
    )
    // REST endpoint to get active users
    .get('/users/active',
        () => Array.from(connectedUsers.keys()),
        {
            detail: {
                tags: ['Users'],
                summary: 'Get active users',
                description: 'List all currently connected users'
            }
        }
    )
    // REST endpoint to create a new user
    .post('/users',
        async ({ body }) => {
            return await userService.createUser(body.username);
        },
        {
            body: t.Object({
                username: t.String({
                    minLength: 1,
                    description: 'Username to register'
                })
            }),
            detail: {
                tags: ['Users'],
                summary: 'Register a new user',
                description: 'Create a new user in the system'
            }
        }
    )
    // REST endpoint to get all rooms
    .get('/rooms',
        async () => {
            return await roomService.getRoomList();
        },
        {
            detail: {
                tags: ['Rooms'],
                summary: 'Get all chat rooms',
                description: 'List all available chat rooms'
            }
        }
    )
    // REST endpoint to create room
    .post('/rooms',
        async ({ body }) => {
            const user = await userService.getUserByUsername(body.createdBy);
            if (!user) throw new Error('User not found');

            return await roomService.createRoom(
                body.name,
                user.id,
                body.isPrivate || false
            );
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1 }),
                createdBy: t.String({ minLength: 1 }),
                isPrivate: t.Optional(t.Boolean())
            }),
            detail: {
                tags: ['Rooms'],
                summary: 'Create new room',
                description: 'Create a new chat room'
            }
        }
    )
    // REST endpoint to join chat room
    .post('/rooms/:roomId/join',
        async ({ params, body }) => {
            const user = await userService.getUserByUsername(body.username);
            if (!user) throw new Error('User not found');

            return await roomService.joinRoom(Number(params.roomId), user.id);
        },
        {
            body: t.Object({
                username: t.String({ minLength: 1 })
            }),
            detail: {
                tags: ['Rooms'],
                summary: 'Join room',
                description: 'Join a specific chat room'
            }
        }
    )
    // REST endpoint to get room message
    .get('/rooms/:roomId/messages',
        async ({ params, query }) => {
            const limit = Number(query?.limit || 20);
            const before = query?.before ? Number(query.before) : undefined;
            const sort = query?.sort || 'desc';
            return await roomService.getRoomMessages(Number(params.roomId), limit, before);
        },
        {
            query: t.Object({
                limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
                before: t.Optional(t.Number({ description: 'Get messages before this message ID' })),
                sort: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { default: 'desc' }))
            }),
            detail: {
                tags: ['Rooms'],
                summary: 'Get room messages',
                description: 'Get messages from specific room with pagination support. Use "before" parameter for loading older messages.'
            }
        }
    )
    // WebSocket endpoint
    .ws('/ws', {
        message: async (ws, message: any) => {
            try {
                switch (message.type) {
                    case 'connect':
                        const user = await userService.createUser(message.username);
                        if (user) {
                            connectedUsers.set(message.username, ws);

                            // default room
                            const roomId = message.roomId || 1;
                            await roomService.joinRoom(roomId, user.id);

                            // add to room connections
                            if (!roomConnections.has(roomId)) {
                                roomConnections.set(roomId, new Map());
                            }
                            roomConnections.get(roomId)!.set(message.username, ws);
                            userRooms.set(message.username, roomId);

                            // send welcome message
                            ws.send({
                                type: 'system',
                                content: `Welcome ${message.username} to the room!`,
                                roomId: roomId,
                                roomName: await getRoomName(roomId)
                            });

                            // send room chat history
                            const roomMessage = await roomService.getRoomMessages(roomId, 20);
                            for (const msg of roomMessage!) {
                                ws.send(JSON.stringify({
                                    type: 'message',
                                    messageId: msg.id,
                                    username: msg.username,
                                    content: msg.content,
                                    roomId: roomId,
                                    timestamp: msg.createdAt
                                }));
                            }

                            broadcastToRoom(roomId, {
                                type: 'system',
                                content: `${message.username} joined the chat`,
                                roomId: roomId
                            }, ws);
                        }
                        break;

                    case 'message':
                        if (message.content && message.username) {
                            const currentRoomId = userRooms.get(message.username);
                            if (!currentRoomId) {
                                ws.send({
                                    type: 'error',
                                    content: 'You are not in any room'
                                });
                                break;
                            }

                            const savedMessage = await chatService.saveMessage(
                                message.username,
                                message.content,
                                currentRoomId
                            );

                            if (savedMessage) {
                                broadcastToRoom(currentRoomId, {
                                    type: 'message',
                                    messageId: savedMessage.id,
                                    username: message.username,
                                    content: message.content,
                                    roomId: currentRoomId,
                                    timestamp: new Date()
                                });
                            }
                        }
                        break;

                    case 'create_room':
                        const creator = await userService.getUserByUsername(message.username);
                        if (creator) {
                            const newRoom = await roomService.createRoom(
                                message.roomName,
                                creator.id,
                                message.isPrivate || false
                            );

                            if (!newRoom || 'error' in newRoom) {
                                ws.send({
                                    type: 'error',
                                    content: newRoom?.error || 'Failed to create room'
                                });
                                break;
                            }

                            // auto join creator to the room
                            if (!roomConnections.has(newRoom.id)) {
                                roomConnections.set(newRoom.id, new Map());
                            }

                            // remove from old room
                            const oldRoomId = userRooms.get(message.username);
                            if (oldRoomId) {
                                roomConnections.get(oldRoomId)?.delete(message.username);

                                // notify old room that user left
                                broadcastToRoom(oldRoomId, {
                                    type: 'system',
                                    content: `${message.username} left the room`,
                                    roomId: oldRoomId,
                                    timestamp: new Date()
                                });
                            }

                            // add to new room
                            roomConnections.get(newRoom.id)!.set(message.username, ws);
                            userRooms.set(message.username, newRoom.id);

                            broadcastToAll({
                                type: 'room_created',
                                roomId: newRoom.id,
                                roomName: newRoom.name,
                                message: `New room "${newRoom.name}" is now available`,
                                createdBy: message.username,
                                timestamp: new Date()
                            });

                            setTimeout(() => {
                                try {
                                    broadcastToRoom(newRoom.id, {
                                        type: 'system',
                                        content: `${message.username} successfully created and joined the room`,
                                        roomId: newRoom.id,
                                        timestamp: new Date()
                                    });
                                } catch (error) {
                                    console.error('Error sending welcome message:', error)
                                }
                            }, 100)


                            const roomMessages = await roomService.getRoomMessages(newRoom.id, 20);
                            for (const msg of roomMessages!) {
                                ws.send({
                                    type: 'message',
                                    messageId: msg.id,
                                    username: msg.username,
                                    content: msg.content,
                                    roomId: newRoom.id,
                                    timestamp: msg.createdAt
                                });
                            }
                        }
                        break;

                    case 'switch_room':
                        const userToSwitch = await userService.getUserByUsername(message.username);
                        if (userToSwitch && message.fromRoomId && message.toRoomId) {
                            // leave old room
                            if (message.fromRoomId) {
                                await roomService.leaveRoom(message.fromRoomId, userToSwitch.id);
                                roomConnections.get(message.fromRoomId)?.delete(message.username);
                            }

                            // join new room
                            const joinResult = await roomService.joinRoom(message.toRoomId, userToSwitch.id);
                            if (joinResult) {
                                // add to new room tracking
                                if (!roomConnections.has(message.toRoomId)) {
                                    roomConnections.set(message.toRoomId, new Map());
                                }
                                roomConnections.get(message.toRoomId)!.set(message.username, ws);
                                userRooms.set(message.username, message.toRoomId);

                                // send chat history
                                const roomMessage = await roomService.getRoomMessages(message.toRoomId, 20);
                                for (const msg of roomMessage!) {
                                    ws.send({
                                        type: 'message',
                                        messageId: msg.id,
                                        username: msg.username,
                                        content: msg.content,
                                        roomId: message.toRoomId,
                                        timestamp: msg.createdAt
                                    });
                                }

                                // notify to new room
                                broadcastToRoom(message.toRoomId, {
                                    type: 'system',
                                    content: `${message.username} joined the room`,
                                    roomId: message.toRoomId
                                });

                                broadcastToRoom(message.fromRoomId, {
                                    type: 'system',
                                    content: `${message.username} left the room`,
                                    roomId: message.fromRoomId,
                                    timestamp: new Date()
                                });

                                ws.send({
                                    type: 'join_room',
                                    roomId: message.toRoomId,
                                    roomName: await getRoomName(message.toRoomId),
                                    content: 'Successfully switched room'
                                });
                            }

                        } else {
                            ws.send({
                                type: 'error',
                                content: 'Failed to join room'
                            });
                        }
                        break;

                    case 'disconnect':
                        if (message.username) {
                            await handleUserDisconnect(message.username);
                        }
                        break;

                    case 'delete_room':
                        try {
                            // validasi input
                            if (!message.roomId) {
                                ws.send({
                                    type: 'error',
                                    content: 'Room ID is required'
                                });
                                break;
                            }

                            if (message.roomId === 1) {
                                ws.send({
                                    type: 'error',
                                    content: 'Cannot delete the default room'
                                });
                                break;
                            }

                            // get user
                            const deleter = await userService.getUserByUsername(message.username);
                            if (!deleter) {
                                ws.send({
                                    type: 'error',
                                    content: 'User not found'
                                });
                                break;
                            }

                            const deletedRoom = await roomService.getRoomName(message.roomId)
                            if (!deletedRoom || 'error' in deletedRoom) {
                                ws.send({
                                    type: 'error',
                                    content: deletedRoom?.error || 'Room not found'
                                });
                                break;
                            }

                            const result = await roomService.deleteRoom(message.roomId, deleter.id);
                            if (!result || 'error' in result) {
                                ws.send({
                                    type: 'error',
                                    content: result?.error || 'Failed to delete room'
                                });
                                break;
                            }

                            // move all users from deleted room to default room
                            const roomMembers = roomConnections.get(message.roomId);
                            const defaultRoomId = 1;
                            if (roomMembers && roomMembers.size > 0) {

                                // update tracking
                                if (!roomConnections.has(defaultRoomId)) {
                                    roomConnections.set(defaultRoomId, new Map());
                                }

                                const membersArray = Array.from(roomMembers.entries());
                                for (const [username, memberWs] of membersArray) {
                                    try {
                                        roomConnections.get(defaultRoomId)!.set(username, memberWs);
                                        userRooms.set(username, defaultRoomId);

                                        // update database
                                        const memberUser = await userService.getUserByUsername(username);
                                        if (memberUser) {
                                            await roomService.joinRoom(defaultRoomId, memberUser.id);
                                        }

                                        // notify user
                                        if (memberWs.readyState === 1) {
                                            const moveMessage = {
                                                type: 'room_moved',
                                                roomId: defaultRoomId,
                                                roomName: 'General',
                                                oldRoomId: message.roomId,
                                                oldRoomName: deletedRoom.name,
                                                content: `Room "${deletedRoom.name}" was deleted. You've been moved to General room.`,
                                                timestamp: new Date()
                                            };
                                            memberWs.send(moveMessage);

                                            // send chat history
                                            const roomMessage = await roomService.getRoomMessages(defaultRoomId, 20);
                                            for (const msg of roomMessage!) {
                                                memberWs.send(JSON.stringify({
                                                    type: 'message',
                                                    messageId: msg.id,
                                                    username: msg.username,
                                                    content: msg.content,
                                                    roomId: defaultRoomId,
                                                    timestamp: msg.createdAt
                                                }));
                                            }

                                        } else {
                                            connectedUsers.delete(username);
                                            userRooms.delete(username);
                                        }

                                    } catch (error) {
                                        console.error(`Error moving user ${username}:`, error);
                                    }
                                }
                            }

                            // clean up
                            roomConnections.delete(message.roomId);

                            // notify to all users
                            broadcastToAll({
                                type: 'room_deleted',
                                roomId: message.roomId,
                                roomName: deletedRoom.name,
                                content: `Room "${deletedRoom.name}" has been deleted`,
                                deletedBy: message.username,
                                timestamp: new Date()
                            });

                            ws.send({
                                type: 'room_deleted',
                                roomId: message.roomId,
                                roomName: deletedRoom.name,
                                content: `Room "${deletedRoom.name}" deleted successfully`,
                                timestamp: new Date()
                            });

                        } catch (error) {
                            console.error('Error in deleting room', error);
                            ws.send({
                                type: 'error',
                                content: 'Internal server error while deleting room'
                            });
                        }

                        break;

                    case 'edit_message':
                        try {
                            const { messageId, newContent, username } = message;
                            if (!messageId || !newContent || !username) {
                                ws.send({
                                    type: 'error',
                                    content: 'Message ID, content, and username are required'
                                });
                                break;
                            }

                            if (newContent.trim().length === 0) {
                                ws.send({
                                    type: 'error',
                                    content: 'Message content cannot be empty'
                                });
                                break;
                            }

                            if (newContent.length > 500) {
                                ws.send({
                                    type: 'error',
                                    content: 'Message too long (Max 500 characters)'
                                });
                                break;
                            }

                            const existingMessage = await chatService.getMessageById(messageId);
                            if (!existingMessage || 'error' in existingMessage) {
                                ws.send({
                                    type: 'error',
                                    content: 'Message not found'
                                });
                                break;
                            }

                            const user = await userService.getUserById(existingMessage.userId!);
                            if (!user) {
                                ws.send({
                                    type: 'error',
                                    content: 'User not found'
                                });
                                break;
                            }

                            // only owner can edit
                            if (user.username !== username) {
                                ws.send({
                                    type: 'error',
                                    content: 'You can only edit your own messages'
                                });
                                break;
                            }

                            // check time limit (15 min)
                            const messageAge = Date.now() - new Date(existingMessage.createdAt!).getTime();
                            const limit = 15 * 60 * 1000;   // 15min

                            if (messageAge > limit) {
                                ws.send({
                                    type: 'error',
                                    content: 'Cannot edit messages older than 15 minutes'
                                });
                                break;
                            }

                            const updatedMessage = await chatService.editMessage(messageId, newContent);
                            if (!updatedMessage) {
                                ws.send({
                                    type: 'error',
                                    content: 'Failed to update message'
                                });
                                break;
                            }

                            const currentRoomId = userRooms.get(username);
                            if (currentRoomId) {
                                broadcastToRoom(currentRoomId, {
                                    type: 'message_edited',
                                    messageId: messageId,
                                    username: username,
                                    content: newContent,
                                    originalContent: existingMessage.content,
                                    roomId: currentRoomId,
                                    editedAt: new Date(),
                                    timestamp: existingMessage.createdAt
                                });
                            }

                        } catch (error) {
                            console.error('Error editing message:', error);
                            ws.send({
                                type: 'error',
                                content: 'Failed to edit message'
                            });
                        }
                        break;

                    case 'delete_message':
                        try {
                            console.log(message);
                            const { messageId, username } = message;
                            if (!messageId || !username) {
                                ws.send({
                                    type: 'error',
                                    content: 'Message Id and username are required'
                                });
                                break;
                            }

                            const existingMessage = await chatService.getMessageById(messageId);
                            if (!existingMessage || 'error' in existingMessage) {
                                ws.send({
                                    type: 'error',
                                    content: 'Message not found'
                                });
                                break;
                            }

                            const user = await userService.getUserById(existingMessage.userId!);
                            if (!user) {
                                ws.send({
                                    type: 'error',
                                    content: 'User not found'
                                });
                                break;
                            }

                            // only owner can delete message
                            if (user.username !== username) {
                                ws.send({
                                    type: 'error',
                                    content: 'You can only delete your own messages'
                                });
                                break;
                            }

                            const deleted = await chatService.deleteMessage(messageId);
                            if (!deleted) {
                                ws.send({
                                    type: 'error',
                                    content: 'Failed to delete message'
                                });
                                break;
                            }

                            const currentRoomId = userRooms.get(username);
                            if (currentRoomId) {
                                broadcastToRoom(currentRoomId, {
                                    type: 'message_deleted',
                                    messageId: messageId,
                                    username: username,
                                    roomId: currentRoomId,
                                    deletedAt: new Date()
                                });
                            }
                        } catch (error) {
                            console.error('Error deleting message:', error);
                            ws.send({
                                type: 'error',
                                content: 'Failed to delete message'
                            });
                        }
                        break;
                }
            } catch (error) {
                console.error('WebSocket error:', error);
                ws.send({
                    type: 'error',
                    content: 'An error occured processing your message'
                });
            }
        },
        // handle close connection
        close: async (ws) => {
            // find and remove user from all tracking maps
            for (const [username, socket] of connectedUsers.entries()) {
                if (socket === ws) {
                    await handleUserDisconnect(username);
                    break;
                }
            }
        }
    })
    .listen(3000);

console.log(`🚀 Server running at http://localhost:3000`);
console.log(`📚 Swagger documentation at http://localhost:3000/swagger`);
console.log(`🔌 WebSocket endpoint at ws://localhost:3000/ws`);
console.log(`🧪 Test page at http://localhost:3000/test`);

export type App = typeof app;
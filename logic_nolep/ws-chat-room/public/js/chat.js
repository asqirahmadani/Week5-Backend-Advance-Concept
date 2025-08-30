// public/js/chat.js
class ChatApp {
    constructor() {
        this.ws = null;
        this.currentUser = '';
        this.currentRoomId = 1;
        this.currentRoomName = 'General';
        this.rooms = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupAfterDOMReady();
            });
        } else {
            this.setupAfterDOMReady();
        }
    }

    setupAfterDOMReady() {
        this.loadRooms();
        this.setupEventListeners();
        this.setupInfiniteScroll();
        this.setupScrollToBottom();
        this.setupMessageActionListeners();
    }

    setupEventListeners() {
        // Enter key listeners
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        document.getElementById('newRoomName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });

        // Button listeners
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('deleteRoomBtn').addEventListener('click', () => this.deleteCurrentRoom());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }

    async loadRooms() {
        try {
            this.showLoading('roomList');
            const response = await fetch('/rooms');

            if (!response.ok) {
                throw new Error('Failed to fetch rooms');
            }

            this.rooms = await response.json();
            this.updateRoomList();
        } catch (error) {
            console.error('Failed to load rooms:', error);
            this.showError('Failed to load rooms. Please refresh the page.');
        } finally {
            this.hideLoading('roomList');
        }
    }

    updateRoomList() {
        const roomList = document.getElementById('roomList');
        roomList.innerHTML = '';

        this.rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = `room-item ${room.id === this.currentRoomId ? 'active' : ''}`;
            roomElement.innerHTML = `
                <div style="font-weight: bold;">${this.escapeHtml(room.name)}</div>
                <small style="opacity: 0.8;">${room.isPrivate ? '🔒 Private' : '🌍 Public'}</small>
            `;
            roomElement.onclick = () => this.switchRoom(room.id, room.name);
            roomList.appendChild(roomElement);
        });
    }

    login() {
        const username = document.getElementById('username').value.trim();
        const errorDiv = document.getElementById('loginError');

        // Validation
        if (!username) {
            this.showError('Please enter a username', 'loginError');
            return;
        }

        if (username.length < 2) {
            this.showError('Username must be at least 2 characters', 'loginError');
            return;
        }

        if (username.length > 20) {
            this.showError('Username must be less than 20 characters', 'loginError');
            return;
        }

        // Check for invalid characters
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            this.showError('Username can only contain letters, numbers, hyphens, and underscores', 'loginError');
            return;
        }

        this.currentUser = username;
        this.connectWebSocket();
    }

    connectWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }

        try {
            this.showLoading('loginBtn');
            this.ws = new WebSocket(`ws://${window.location.host}/ws`);

            this.ws.onopen = () => {
                console.log('Connected to WebSocket');
                this.updateConnectionStatus(true);
                this.reconnectAttempts = 0;

                // Send connect message (simplified - only one join)
                this.ws.send(JSON.stringify({
                    type: 'connect',
                    username: this.currentUser,
                    roomId: this.currentRoomId
                }));

                // Show chat interface
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('chatContainer').classList.remove('hidden');
                this.loadRooms();
                this.loadRecentMessages(this.currentRoomId);
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket connection closed', event);
                this.updateConnectionStatus(false);

                // Auto-reconnect if user is logged in
                if (this.currentUser && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => {
                        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                        this.connectWebSocket();
                    }, 3000 * this.reconnectAttempts); // Exponential backoff
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
                this.showError('Connection failed. Please try again.', 'loginError');
            };

        } catch (error) {
            console.error('Failed to connect:', error);
            this.showError('Connection failed. Please try again.', 'loginError');
        } finally {
            this.hideLoading('loginBtn');
        }
    }

    handleMessage(message) {
        console.log('📨 RAW MESSAGE RECEIVED:', message);
        console.log('📨 MESSAGE TYPE:', message.type);
        switch (message.type) {
            case 'message':
                this.displayMessage(message);
                break;

            case 'message_edited':
                this.updateEditedMessage(message);
                break;

            case 'message_deleted':
                this.updateDeletedMessage(message);
                break;

            case 'system':
                this.displaySystemMessage(message.content);
                break;

            case 'room_created':
                this.displaySystemMessage(message.message);
                this.loadRooms().then(() => {
                    if (message.createdBy === this.currentUser && message.roomId) {
                        this.currentRoomId = message.roomId;
                        this.currentRoomName = message.roomName;
                        this.updateCurrentRoom();
                        this.clearMessages();
                    }
                });
                break;

            case 'room_joined':
                this.displaySystemMessage(message.message);
                this.currentRoomId = message.roomId;
                this.updateCurrentRoom();
                break;

            case 'room_left':
                this.displaySystemMessage(message.message);
                break;

            case 'room_moved':
                this.displaySystemMessage(message.content)
                if (message.oldRoomId === this.currentRoomId) {
                    this.currentRoomId = message.roomId;
                    this.currentRoomName = message.roomName;
                    this.updateCurrentRoom();
                    this.clearMessages();

                    this.loadRooms();
                    this.displaySystemMessage(`You have been moved to ${message.roomName} room!`);
                }
                break;

            case 'room_deleted':
                this.displaySystemMessage(message.content);
                this.loadRooms();
                if (message.roomId === this.currentRoomId) {
                    this.currentRoomId = 1;
                    this.currentRoomName = 'General';
                    this.updateCurrentRoom();
                    this.clearMessages();
                }
                break;

            case 'error':
                this.displaySystemMessage('Error: ' + message.content);
                break;

            case 'user_list':
                this.updateOnlineUsers(message.users);
                break;

            default:
                console.log('Unknown message type:', message.type, message);
        }
    }

    displayMessage(message, autoScroll = true) {
        const messagesDiv = document.getElementById('messages');
        if (!messagesDiv) {
            console.error('Messages div not found when trying to display message');
            return;
        }

        const wasNearBottom = this.isNearBottom();
        const messageElement = this.createMessageElement(message);
        messagesDiv.appendChild(messageElement);

        if (autoScroll && wasNearBottom) this.scrollToBottom();
    }

    async loadRecentMessages(roomId, limit = 20) {
        if (this.isLoadingMessages) return;

        try {
            this.isLoadingMessages = true;
            this.showLoadingMessages();

            const response = await fetch(`/rooms/${roomId}/messages?limit=${limit}&sort=desc`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const messages = await response.json();
            this.clearMessages();

            messages.forEach(message => {
                const formattedMessage = {
                    id: message.id,
                    content: message.content,
                    username: message.username,
                    roomId: roomId,
                    timestamp: message.createdAt,
                    isEdited: message.isEdited || false

                }
                this.displayMessage(formattedMessage, false);
            });

            this.scrollToBottom();

        } catch (error) {
            console.error('Failed to load recent messages:', error);
            this.displaySystemMessage('Failed to load recent messages. Please try again.');
        } finally {
            this.isLoadingMessages = false;
            this.hideLoadingMessages();
        }
    }

    async loadMoreMessages(roomId, beforeMessageId, limit = 20) {
        if (this.isLoadingMessages) return;

        try {
            this.isLoadingMessages = true;
            this.showLoadingMessages();

            const response = await fetch(`/rooms/${roomId}/messages?limit=${limit}&before=${beforeMessageId}&sort=desc`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const messages = await response.json();

            if (messages.length === 0) {
                this.displaySystemMessage('No more messages to load');
                return;
            }

            // get current scroll position
            const messagesDiv = document.getElementById('messages');
            const scrollHeight = messagesDiv.scrollHeight;
            const scrollTop = messagesDiv.scrollTop;

            // prepend messages
            messages.reverse().forEach(message => {
                const formattedMessage = {
                    id: message.id,
                    content: message.content,
                    username: message.username,
                    roomId: roomId,
                    timestamp: message.createdAt,
                    isEdited: message.isEdited || false
                };
                this.prependMessage(formattedMessage);
            });

            const newScrollHeight = messagesDiv.scrollHeight;
            messagesDiv.scrollTop = scrollTop + (newScrollHeight - scrollHeight);
        } catch (error) {
            console.error('Failed to load more messages:', error);
            this.displaySystemMessage('Failed to load more messages.');
        } finally {
            this.isLoadingMessages = false;
            this.hideLoadingMessages();
        }
    }

    prependMessage(message) {
        const messageDiv = document.getElementById('messages');
        const messageElement = this.createMessageElement(message);

        // insert at beginning
        messageDiv.insertBefore(messageElement, messageDiv.firstChild);
    }

    createMessageElement(message) {
        const messageElement = document.createElement('div');
        const isOwn = message.username === this.currentUser;

        messageElement.className = `message ${isOwn ? 'own' : 'other'}`;

        let messageId = message.id || message.messageId;
        messageElement.setAttribute('data-message-id', messageId);

        const time = new Date(message.timestamp).toLocaleTimeString();
        const editedIndicator = message.isEdited || message.is_edited ?
            `<span class="edited-indicator">(edited)</span>` : '';

        const actionsHTML = (isOwn && messageId && messageId !== 'undefined') ?
            this.createMessageActions(messageId) : '';

        messageElement.innerHTML = `
            ${!isOwn ? `<div class="message-header">${this.escapeHtml(message.username)}</div>` : ''}
            <div class="message-content">${this.escapeHtml(message.content)}</div>
            <div class="message-footer">
                <span class="message-time">${time} ${editedIndicator}</span>
                ${actionsHTML}
            </div>
        `;

        return messageElement;
    }

    displaySystemMessage(content) {
        const messagesDiv = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.innerHTML = `
            <div>${this.escapeHtml(content)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        messagesDiv.appendChild(messageElement);
        this.scrollToBottom();
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        if (content.length > 500) {
            this.showError('Message too long (max 500 characters)');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'message',
            username: this.currentUser,
            content: content,
            roomId: this.currentRoomId
        }));

        input.value = '';
    }

    editMessage(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const existingEditForm = messageElement.querySelector('.edit-form');
        if (existingEditForm) {
            console.log('Edit form already exists, focusing input');
            const input = existingEditForm.querySelector('.edit-input');
            if (input) input.focus();
            return; // Jangan buat form baru
        }

        const contentDiv = messageElement.querySelector('.message-content');
        const currentContent = contentDiv.textContent;

        // create edit form
        const editForm = document.createElement('div');
        editForm.className = 'edit-form';
        editForm.innerHTML = `
            <input type="text" class="edit-input" value="${this.escapeHtml(currentContent)}" maxlength="500">
            <div class="edit-actions">
                <button class="btn-small save-btn">Save</button>
                <button class="btn-small cancel-btn">Cancel</button>
            </div>
        `

        contentDiv.setAttribute('data-original', currentContent);
        contentDiv.style.display = 'none';

        // insert edit form
        contentDiv.parentNode.insertBefore(editForm, contentDiv.nextSibling);

        const saveBtn = editForm.querySelector('.save-btn');
        const cancelBtn = editForm.querySelector('.cancel-btn');
        const input = editForm.querySelector('.edit-input');

        saveBtn.addEventListener('click', () => this.saveEdit(messageId));
        cancelBtn.addEventListener('click', () => this.cancelEdit(messageId));

        // focus on input
        input.focus();
        input.select();

        // handle enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveEdit(messageId);
            if (e.key === 'Escape') this.cancelEdit(messageId);
        });
    }

    saveEdit(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        const editForm = messageElement.querySelector('.edit-form');
        const input = editForm.querySelector('.edit-input');
        const newContent = input.value.trim();

        if (!newContent) {
            this.showError('Message cannot be empty');
            return;
        }

        if (newContent.length > 500) {
            this.showError('Message too long (max 500 characters)');
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'edit_message',
                messageId: messageId,
                newContent: newContent,
                username: this.currentUser
            }));
        }
        // remove edit form
        this.cancelEdit(messageId);
    }

    cancelEdit(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        const contentDiv = messageElement.querySelector('.message-content');
        const editForm = messageElement.querySelector('.edit-form');

        contentDiv.style.display = 'block';
        if (editForm) editForm.remove();
    }

    deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message?')) return;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const payload = {
                type: 'delete_message',
                messageId: messageId,
                username: this.currentUser
            };

            this.ws.send(JSON.stringify(payload));
        }
    }

    updateEditedMessage(message) {
        const messageElement = document.querySelector(`[data-message-id="${message.messageId}"]`);
        if (messageElement) {
            const contentDiv = messageElement.querySelector('.message-content');
            const timeSpan = messageElement.querySelector('.message-time');

            contentDiv.textContent = message.content;
            timeSpan.innerHTML = `${timeSpan.textContent.split(' (edited)')[0]} <span class="edited-indicator">(edited)</span>`;
        }
    }

    updateDeletedMessage(message) {
        const messageElement = document.querySelector(`[data-message-id="${message.messageId}"]`);
        if (messageElement) {
            const contentDiv = messageElement.querySelector('.message-content');
            const actionsDiv = messageElement.querySelector('.message-actions');

            contentDiv.textContent = 'This message was deleted';
            contentDiv.style.fontStyle = 'italic';
            contentDiv.style.opacity = '0.6';

            if (actionsDiv) actionsDiv.remove();
        }
    }

    switchRoom(roomId, roomName) {
        if (roomId === this.currentRoomId || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.ws.send(JSON.stringify({
            type: 'switch_room',
            username: this.currentUser,
            fromRoomId: this.currentRoomId,
            toRoomId: roomId
        }));

        this.currentRoomId = roomId;
        this.currentRoomName = roomName;
        this.updateCurrentRoom();
        this.loadRecentMessages(roomId);
    }

    async createRoom() {
        const roomNameInput = document.getElementById('newRoomName');
        const roomName = roomNameInput.value.trim();

        if (!roomName) {
            this.showError('Please enter a room name');
            return;
        }

        if (roomName.length > 30) {
            this.showError('Room name too long (max 30 characters)');
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('Not connected to server');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'create_room',
            username: this.currentUser,
            roomName: roomName,
            isPrivate: false
        }));

        roomNameInput.value = '';
    }

    deleteCurrentRoom() {
        if (this.currentRoomId === 1) {
            this.showError('Cannot delete the default room');
            return;
        }

        if (!confirm(`Are you sure you want to delete room "${this.currentRoomName}"?`)) return;

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('Not connected to server');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'delete_room',
            username: this.currentUser,
            roomId: this.currentRoomId
        }));
    }

    disconnect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'disconnect',
                username: this.currentUser
            }));
            this.ws.close();
        }
    }

    logout() {
        this.disconnect();

        // Reset UI
        document.getElementById('chatContainer').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('username').value = '';
        this.clearMessages();

        // Reset state
        this.currentUser = '';
        this.currentRoomId = 1;
        this.currentRoomName = 'General';
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(false);
    }

    // Utility methods
    createMessageActions(messageId) {
        if (!messageId) {
            console.warn('⚠️ Message ID is null/undefined:', messageId);
            return '';
        }

        const html = `
        <div class="message-actions">
            <button class="action-btn edit-btn" data-message-id="${messageId}" data-action="edit" title="Edit message">
                ✏️
            </button>
            <button class="action-btn delete-btn" data-message-id="${messageId}" data-action="delete" title="Delete message">
                🗑️
            </button>
        </div>
    `;

        return html;
    }

    setupMessageActionListeners() {
        const messageDiv = document.getElementById('messages');

        messageDiv.addEventListener('click', (e) => {
            const button = e.target.closest('.action-btn');
            if (button) {
                const messageId = button.getAttribute('data-message-id');
                const action = button.getAttribute('data-action');

                console.log('Button clicked:', { messageId, action, button })

                if (!messageId || messageId === null || messageId === 'undefined') {
                    console.error('Invalid message ID:', messageId);
                    this.showError('Cannot perform action: Invalid message ID');
                    return;
                }

                if (action === 'edit') {
                    this.editMessage(messageId);
                } else if (action === 'delete') {
                    this.deleteMessage(messageId);
                }
            }
        })
    }

    setupScrollToBottom() {
        const messagesDiv = document.getElementById('messages');
        const chatArea = document.querySelector('.chat-area');

        // create scroll to bottom button
        const scrollBtn = document.createElement('button');
        scrollBtn.className = 'scroll-to-bottom hidden';
        scrollBtn.innerHTML = '↓';
        scrollBtn.title = 'Scroll to bottom';
        chatArea.appendChild(scrollBtn);

        // show/hide button based on scroll position
        messagesDiv.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = messagesDiv;
            const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

            if (isNearBottom) {
                scrollBtn.classList.add('hidden');
            } else {
                scrollBtn.classList.remove('hidden');
            }
        });

        // scroll to bottom when clicked
        scrollBtn.addEventListener('click', () => {
            this.scrollToBottom();
        });
    }

    updateCurrentRoom() {
        document.getElementById('currentRoomName').textContent = this.currentRoomName;
        this.updateRoomList();
    }

    updateConnectionStatus(isOnline) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
    }

    updateOnlineUsers(users) {
        document.getElementById('onlineCount').textContent = users.length;
    }

    clearMessages() {
        const messagesDiv = document.getElementById('messages');
        if (!messagesDiv) {
            console.error('Messages div not found when trying to clear');
            return;
        }
        messagesDiv.innerHTML = '';
    }

    scrollToBottom() {
        const messagesDiv = document.getElementById('messages');
        if (!messagesDiv) {
            console.error('Messages div not found when trying to scroll');
            return;
        }
        messagesDiv.scrollTo({
            top: messagesDiv.scrollHeight,
            behavior: 'smooth'
        });
    }

    setupInfiniteScroll() {
        const messagesDiv = document.getElementById('messages');
        messagesDiv.addEventListener('scroll', () => {
            // load more when scrolled to top
            if (messagesDiv.scrollTop === 0 && !this.isLoadingMessages) {
                const firstMessage = messagesDiv.querySelector('[data-message-id]');
                if (firstMessage) {
                    const firstMessageId = firstMessage.getAttribute('data-message-id');
                    // Only load if it's not a temporary message
                    if (!firstMessageId.startsWith('temp_')) {
                        this.loadMoreMessages(this.currentRoomId, firstMessageId);
                    }
                }
            }
        });
    }

    isNearBottom() {
        const messagesDiv = document.getElementById('messages');
        const { scrollTop, scrollHeight, clientHeight } = messagesDiv;
        return scrollTop + clientHeight >= scrollHeight - 100;
    }

    showLoadingMessages() {
        const messagesDiv = document.getElementById('messages');
        let loadingDiv = document.getElementById('messages-loading');

        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'messages-loading';
            loadingDiv.className = 'loading-messages';
            loadingDiv.innerHTML = `
                <div class="loading-indicator">
                    <div class="loading"></div>
                    <span>Loading messages...</span>
                </div>
            `;
            messagesDiv.insertBefore(loadingDiv, messagesDiv.firstChild);
        }
    }

    hideLoadingMessages() {
        const loadingDiv = document.getElementById('messages-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message, elementId = null) {
        if (elementId) {
            const errorElement = document.getElementById(elementId);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
        } else {
            this.displaySystemMessage('Error: ' + message);
        }
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading"></div>';
        }
    }

    hideLoading(elementId) {
        // This will be handled by updateRoomList() or other methods
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    window.chatApp = new ChatApp();

    window.chatApp.setupMessageActionListeners();

    // Update online users periodically
    setInterval(async function () {
        if (window.chatApp.currentUser) {
            try {
                const response = await fetch('/users/active');
                if (response.ok) {
                    const activeUsers = await response.json();
                    document.getElementById('onlineCount').textContent = activeUsers.length;
                }
            } catch (error) {
                console.error('Failed to fetch active users:', error);
            }
        }
    }, 10000); // Every 10 seconds

    // Handle page unload
    window.addEventListener('beforeunload', function () {
        if (window.chatApp && window.chatApp.currentUser) {
            window.chatApp.disconnect();
        }
    });
});
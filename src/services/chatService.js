import apiClient from './apiClient';

/**
 * Get or create a chat room document for a session
 */
export async function getOrCreateChat(sessionId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID');

  const response = await apiClient.get(`/chats/${sessionId}`);
  const chat = response.chat || {};
  return {
    id: chat.id || chat._id || sessionId,
    ...chat,
  };
}

/**
 * Send a message in a session chat room
 */
export async function sendMessage(sessionId, senderId, senderName, text, recipientId) {
  if (!sessionId) throw new Error('Invalid session ID');
  const cleanText = (text || '').trim();
  if (!cleanText) throw new Error('Message cannot be empty.');
  if (cleanText.length > 1000) throw new Error('Message cannot exceed 1000 characters.');

  const response = await apiClient.post(`/chats/${sessionId}`, {
    text: cleanText,
  });

  const newMsg = response.message || response;

  window.dispatchEvent(new Event('study_chat_messages_updated'));

  return {
    id: newMsg.id || newMsg._id,
    ...newMsg,
  };
}

/**
 * Polling adapter for real-time chat messages
 * Polls approximately every 3 seconds while chat is mounted
 */
export function subscribeToMessages(sessionId, callback) {
  if (!sessionId) return () => {};

  let active = true;
  let isFetching = false;

  const fetchMessages = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const response = await apiClient.get(`/chats/${sessionId}`);
      if (active && response?.messages) {
        const list = response.messages.map((m) => ({
          id: m.id || m._id,
          ...m,
        }));
        callback(list);
      }
    } catch (err) {
      console.error('Error polling chat messages:', err);
    } finally {
      isFetching = false;
    }
  };

  fetchMessages();

  // Poll every 3 seconds
  const intervalId = setInterval(fetchMessages, 3000);

  const handleUpdate = () => {
    fetchMessages();
  };
  window.addEventListener('study_chat_messages_updated', handleUpdate);

  return () => {
    active = false;
    clearInterval(intervalId);
    window.removeEventListener('study_chat_messages_updated', handleUpdate);
  };
}

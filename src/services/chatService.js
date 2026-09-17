import { db, isFirebaseConfigured } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { createNotification } from './notificationService';

const MOCK_CHATS_KEY = 'study_buddy_mock_chats';
const MOCK_MESSAGES_KEY = 'study_buddy_mock_messages';

function getMockChats() {
  try {
    const data = localStorage.getItem(MOCK_CHATS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveMockChats(chats) {
  try {
    localStorage.setItem(MOCK_CHATS_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error("Failed to save mock chats", err);
  }
}

function getMockMessages() {
  try {
    const data = localStorage.getItem(MOCK_MESSAGES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveMockMessages(msgs) {
  try {
    localStorage.setItem(MOCK_MESSAGES_KEY, JSON.stringify(msgs));
    window.dispatchEvent(new Event('study_chat_messages_updated'));
  } catch (err) {
    console.error("Failed to save mock messages", err);
  }
}

/**
 * Get or create a chat document for a session
 */
export async function getOrCreateChat(sessionId, sessionData) {
  if (!sessionId) throw new Error("Invalid session ID");

  if (isFirebaseConfigured && db) {
    const chatRef = doc(db, "chats", sessionId);
    const snap = await getDoc(chatRef);

    if (!snap.exists()) {
      const learnerId = sessionData?.learnerId || sessionData?.requesterId;
      const helperId = sessionData?.helperId;
      const payload = {
        sessionId,
        learnerId,
        helperId,
        participantIds: [learnerId, helperId].filter(Boolean),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        lastMessageAt: serverTimestamp()
      };
      await setDoc(chatRef, payload);
      return { id: sessionId, ...payload };
    }
    return { id: snap.id, ...snap.data() };
  } else {
    // Demo Mode
    const mockChats = getMockChats();
    if (!mockChats[sessionId]) {
      const learnerId = sessionData?.learnerId || sessionData?.requesterId;
      const helperId = sessionData?.helperId;
      mockChats[sessionId] = {
        id: sessionId,
        sessionId,
        learnerId,
        helperId,
        participantIds: [learnerId, helperId].filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: '',
        lastMessageAt: new Date().toISOString()
      };
      saveMockChats(mockChats);
    }
    return mockChats[sessionId];
  }
}

/**
 * Send a message in a session chat and notify recipient
 */
export async function sendMessage(sessionId, senderId, senderName, text, recipientId) {
  if (!sessionId) throw new Error("Invalid session ID");
  const cleanText = (text || '').trim();
  if (!cleanText) throw new Error("Message cannot be empty.");
  if (cleanText.length > 1000) throw new Error("Message cannot exceed 1000 characters.");

  const payload = {
    senderId,
    senderName: senderName || 'User',
    text: cleanText,
    createdAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString()
  };

  let newMsg = null;
  if (isFirebaseConfigured && db) {
    const messagesRef = collection(db, "chats", sessionId, "messages");
    const msgDoc = await addDoc(messagesRef, payload);
    newMsg = { id: msgDoc.id, ...payload };

    // Update last message in parent chat doc
    const chatRef = doc(db, "chats", sessionId);
    await updateDoc(chatRef, {
      lastMessage: cleanText,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    // Demo Mode
    const allMsgs = getMockMessages();
    if (!allMsgs[sessionId]) {
      allMsgs[sessionId] = [];
    }
    newMsg = {
      id: 'msg-' + Date.now(),
      ...payload
    };
    allMsgs[sessionId].push(newMsg);
    saveMockMessages(allMsgs);

    // Update parent mock chat
    const mockChats = getMockChats();
    if (mockChats[sessionId]) {
      mockChats[sessionId].lastMessage = cleanText;
      mockChats[sessionId].lastMessageAt = new Date().toISOString();
      mockChats[sessionId].updatedAt = new Date().toISOString();
      saveMockChats(mockChats);
    }
  }

  // Trigger Notification for the message recipient
  if (recipientId && recipientId !== senderId) {
    const shortPreview = cleanText.length > 80 ? cleanText.substring(0, 80) + '...' : cleanText;
    createNotification({
      recipientId,
      senderId,
      senderName: senderName || 'Buddy',
      type: 'new_message',
      title: `New Message from ${senderName || 'Buddy'}`,
      message: `"${shortPreview}"`,
      relatedSessionId: sessionId
    });
  }

  return newMsg;
}

/**
 * Subscribe in real time to chat messages for a session
 */
export function subscribeToMessages(sessionId, callback) {
  if (!sessionId) return () => {};

  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "chats", sessionId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(list);
    }, (err) => {
      console.error("Chat messages snapshot error:", err);
    });
  } else {
    // Demo Mode
    const handler = () => {
      const allMsgs = getMockMessages();
      const list = allMsgs[sessionId] || [];
      callback(list);
    };
    handler();
    window.addEventListener('study_chat_messages_updated', handler);
    return () => window.removeEventListener('study_chat_messages_updated', handler);
  }
}

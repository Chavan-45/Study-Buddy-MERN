import { db, isFirebaseConfigured } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  writeBatch, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  limit
} from 'firebase/firestore';

const MOCK_NOTIFICATIONS_KEY = 'study_buddy_mock_notifications';

function getMockNotifications() {
  try {
    const data = localStorage.getItem(MOCK_NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMockNotifications(list) {
  try {
    localStorage.setItem(MOCK_NOTIFICATIONS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('study_notifications_updated'));
  } catch (err) {
    console.error("Failed to save mock notifications", err);
  }
}

/**
 * Safely create a notification in Firestore or LocalStorage.
 * Never throws errors to block main actions!
 */
export async function createNotification(notifData) {
  if (!notifData?.recipientId || !notifData?.title) return null;
  
  // Never notify self
  if (notifData.senderId && notifData.recipientId === notifData.senderId) {
    return null;
  }

  const payload = {
    recipientId: notifData.recipientId,
    senderId: notifData.senderId || 'system',
    senderName: notifData.senderName || 'System',
    type: notifData.type || 'general',
    title: notifData.title,
    message: notifData.message || '',
    relatedRequestId: notifData.relatedRequestId || null,
    relatedSessionId: notifData.relatedSessionId || null,
    isRead: false,
    createdAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString()
  };

  try {
    if (isFirebaseConfigured && db) {
      const colRef = collection(db, "notifications");
      const docRef = await addDoc(colRef, payload);
      return { id: docRef.id, ...payload };
    } else {
      const list = getMockNotifications();
      const newNotif = {
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        ...payload
      };
      list.unshift(newNotif);
      saveMockNotifications(list);
      return newNotif;
    }
  } catch (err) {
    console.error("Non-fatal notification creation error:", err);
    return null;
  }
}

/**
 * Real-time subscriber for recipient's notifications
 */
export function subscribeToNotifications(recipientId, callback) {
  if (!recipientId) return () => {};

  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", recipientId),
      orderBy("createdAt", "desc"),
      limit(40)
    );

    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(list);
    }, (err) => {
      console.error("Notifications snapshot error:", err);
    });
  } else {
    const handler = () => {
      const list = getMockNotifications();
      const userList = list.filter(n => n.recipientId === recipientId);
      userList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(userList.slice(0, 40));
    };
    handler();
    window.addEventListener('study_notifications_updated', handler);
    return () => window.removeEventListener('study_notifications_updated', handler);
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId) {
  if (!notificationId) return;

  try {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, "notifications", notificationId);
      await updateDoc(docRef, { isRead: true });
    } else {
      const list = getMockNotifications();
      const item = list.find(n => n.id === notificationId);
      if (item) {
        item.isRead = true;
        saveMockNotifications(list);
      }
    }
  } catch (err) {
    console.error("Error marking notification read:", err);
  }
}

/**
 * Mark all unread notifications for a user as read
 */
export async function markAllNotificationsAsRead(recipientId) {
  if (!recipientId) return;

  try {
    if (isFirebaseConfigured && db) {
      const q = query(
        collection(db, "notifications"),
        where("recipientId", "==", recipientId),
        where("isRead", "==", false)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        batch.update(docSnap.ref, { isRead: true });
      });
      await batch.commit();
    } else {
      const list = getMockNotifications();
      let updated = false;
      list.forEach(n => {
        if (n.recipientId === recipientId && !n.isRead) {
          n.isRead = true;
          updated = true;
        }
      });
      if (updated) {
        saveMockNotifications(list);
      }
    }
  } catch (err) {
    console.error("Error marking all notifications read:", err);
  }
}

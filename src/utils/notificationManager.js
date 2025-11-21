import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Use your existing Firebase config from your firebase.js file
// Make sure to import it properly or define it here
const firebaseConfig = {
  // Your existing Firebase config from src/firebase.js
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

class NotificationManager {
  constructor() {
    this.isSupported = this.checkSupport();
    this.permission = null;
    this.fcmToken = null;
    this.messaging = null;
    
    if (this.isSupported) {
      try {
        const app = initializeApp(firebaseConfig, 'notifications');
        this.messaging = getMessaging(app);
      } catch (error) {
        console.error('Error initializing Firebase for notifications:', error);
        this.isSupported = false;
      }
    }
  }

  checkSupport() {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  // Request notification permission
  async requestPermission(adminUid) {
    if (!this.isSupported || !this.messaging) {
      console.log('Notifications not supported');
      return false;
    }

    try {
      this.permission = await Notification.requestPermission();
      
      if (this.permission === 'granted') {
        console.log('Notification permission granted.');
        await this.getFCMToken(adminUid);
        await this.setupMessageListener();
        return true;
      } else {
        console.log('Unable to get permission to notify.');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Get FCM token
  async getFCMToken(adminUid) {
    if (!this.messaging) return null;

    try {
      // VAPID key - you need to get this from Firebase Console
      // Firebase Console > Project Settings > Cloud Messaging > Web configuration
      const vapidKey = "YOUR_VAPID_KEY_HERE"; // Replace with your actual VAPID key
      
      this.fcmToken = await getToken(this.messaging, { vapidKey });
      
      if (this.fcmToken) {
        // Store the token in Firestore for this admin
        await setDoc(doc(db, 'adminTokens', adminUid), {
          fcmToken: this.fcmToken,
          updatedAt: new Date().toISOString(),
          enabled: true
        }, { merge: true });
        
        console.log('FCM token stored:', this.fcmToken);
        return this.fcmToken;
      } else {
        console.log('No registration token available.');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Listen for foreground messages
  async setupMessageListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received: ', payload);
      
      this.showLocalNotification(
        payload.notification?.title || 'New Request',
        payload.notification?.body || 'You have a new request pending'
      );
    });
  }

  // Show local notification
  showLocalNotification(title, body) {
    if (this.permission === 'granted') {
      const options = {
        body: body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'admin-notification',
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View'
          }
        ]
      };

      // Check if we can use the Notification API
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, options);

        notification.onclick = () => {
          window.focus();
          notification.close();
          // Navigate to relevant page
          if (title.includes('OT') || title.includes('Overtime')) {
            window.location.href = '/admin/ot-approvals';
          } else if (title.includes('Advance')) {
            window.location.href = '/admin/advances';
          }
        };
      }
    }
  }

  // Check current permission status
  getPermissionStatus() {
    return Notification.permission;
  }

  // Check if notifications are supported and permitted
  checkNotificationSupport() {
    return this.isSupported && this.permission === 'granted';
  }
}

export const notificationManager = new NotificationManager();
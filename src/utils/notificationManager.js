// notificationManager.js
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const firebaseConfig = {
  apiKey: "AIzaSyBrOI8XqyYzWgE-sKMEjJMdeGtoKz7Pt2o",
  authDomain: "cafe-pirana-attendance.firebaseapp.com",
  projectId: "cafe-pirana-attendance",
  storageBucket: "cafe-pirana-attendance.appspot.com",
  messagingSenderId: "1009772109491",
  appId: "1:1009772109491:web:5d0d28f9495e016567dac6",
  measurementId: "G-QQB2PXFPWK"
};

// ⚠️ MUST ADD YOUR REAL VAPID KEY HERE
const vapidKey = "REPLACE_WITH_YOUR_REAL_VAPID_KEY_HERE";

class NotificationManager {
  constructor() {
    this.isSupported = this.checkSupport();
    this.permission = Notification.permission;
    this.fcmToken = null;
    this.messaging = null;

    if (this.isSupported) {
      try {
        const app = initializeApp(firebaseConfig, "notifications");
        this.messaging = getMessaging(app);
        console.log("Notifications supported.");
      } catch (error) {
        console.error("Error initializing Firebase notifications:", error);
        this.isSupported = false;
      }
    } else {
      console.warn("Notifications NOT supported on this device/browser.");
    }
  }

  // iOS-compatible support check
  checkSupport() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  // Request permission from user
  async requestPermission(adminUid) {
    if (!this.isSupported || !this.messaging) return false;

    try {
      const status = await Notification.requestPermission();
      this.permission = status;

      if (status !== 'granted') {
        console.log("Notification permission denied.");
        return false;
      }

      console.log("Notification permission granted.");

      await this.getFCMToken(adminUid);
      this.setupForegroundListener();

      return true;

    } catch (err) {
      console.error("Permission request error:", err);
      return false;
    }
  }

  // Get and store FCM token
  async getFCMToken(adminUid) {
    try {
      const token = await getToken(this.messaging, { vapidKey });

      if (!token) {
        console.warn("FCM token is null. User may need to allow notifications.");
        return null;
      }

      this.fcmToken = token;

      await setDoc(doc(db, "adminTokens", adminUid), {
        fcmToken: token,
        updatedAt: new Date().toISOString(),
        enabled: true
      }, { merge: true });

      console.log("FCM token stored:", token);
      return token;

    } catch (error) {
      console.error("Error getting FCM token:", error);
      return null;
    }
  }

  // Foreground notifications
  setupForegroundListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log("Foreground message:", payload);

      if (payload.notification) {
        this.showLocalNotification(
          payload.notification.title,
          payload.notification.body
        );
      }
    });
  }

  // Display local system notification
  showLocalNotification(title, body) {
    if (Notification.permission !== "granted") return;

    const n = new Notification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/badge-72x72.png",
      tag: "admin-alert"
    });

    n.onclick = () => {
      n.close();
      window.focus();
    };
  }
}

export const notificationManager = new NotificationManager();

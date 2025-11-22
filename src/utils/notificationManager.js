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

class NotificationManager {
  constructor() {
    this.isSupported = this.checkSupport();
    this.permission = this.getPermissionStatus();
    this.fcmToken = null;
    this.messaging = null;

    if (this.isSupported) {
      try {
        this.messaging = getMessaging();
        console.log("Firebase Messaging initialized");
      } catch (error) {
        console.error("Error initializing Firebase messaging:", error);
        this.isSupported = false;
      }
    }
  }

  // Safe support check for iOS
  checkSupport() {
    try {
      // Check if we're in a browser environment with Notification API
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return false;
      }
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (isIOS && isSafari) {
        console.log("iOS Safari detected - using limited notification support");
        // iOS Safari supports basic notifications but not FCM
        return true;
      }
      
      return 'serviceWorker' in navigator && 'PushManager' in window;
    } catch (error) {
      console.error("Error checking notification support:", error);
      return false;
    }
  }

  // Safe permission status check
  getPermissionStatus() {
    try {
      if (typeof Notification !== 'undefined') {
        return Notification.permission;
      }
      return 'denied';
    } catch (error) {
      return 'denied';
    }
  }

  // Safe permission request
  async requestPermission(adminUid) {
    if (!this.isSupported) {
      console.log("Notifications not supported in this environment");
      return false;
    }

    try {
      // Double-check Notification exists
      if (typeof Notification === 'undefined') {
        console.log("Notification API not available");
        return false;
      }

      this.permission = await Notification.requestPermission();
      
      if (this.permission !== 'granted') {
        console.log("Notification permission denied:", this.permission);
        return false;
      }

      console.log("Notification permission granted");

      // Only try FCM on supported browsers (not iOS Safari)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (!(isIOS && isSafari)) {
        await this.getFCMToken(adminUid);
      } else {
        console.log("Skipping FCM token on iOS Safari - storing basic notification preference");
        // Store that notifications are enabled, even without FCM
        await setDoc(doc(db, "adminTokens", adminUid), {
          notificationsEnabled: true,
          updatedAt: new Date().toISOString(),
          platform: 'ios_safari'
        }, { merge: true });
      }
      
      this.setupForegroundListener();
      return true;

    } catch (err) {
      console.error("Permission request error:", err);
      return false;
    }
  }

  // Get FCM token with better error handling
  async getFCMToken(adminUid) {
    if (!this.messaging) {
      console.log("Messaging not available");
      return null;
    }

    try {
      // You need to replace this with your actual VAPID key
      const vapidKey = "YOUR_VAPID_KEY_HERE";
      const token = await getToken(this.messaging, { vapidKey });

      if (!token) {
        console.log("No FCM token available");
        return null;
      }

      this.fcmToken = token;
      console.log("FCM token obtained");

      await setDoc(doc(db, "adminTokens", adminUid), {
        fcmToken: token,
        updatedAt: new Date().toISOString(),
        enabled: true,
        userAgent: navigator.userAgent
      }, { merge: true });

      return token;

    } catch (error) {
      console.error("Error getting FCM token:", error);
      return null;
    }
  }

  // Safe foreground listener setup
  setupForegroundListener() {
    if (!this.messaging) return;

    try {
      onMessage(this.messaging, (payload) => {
        console.log("Foreground message received:", payload);

        if (payload.notification) {
          this.showLocalNotification(
            payload.notification.title,
            payload.notification.body
          );
        }
      });
    } catch (error) {
      console.error("Error setting up foreground listener:", error);
    }
  }

  // Safe local notification
  showLocalNotification(title, body) {
    try {
      if (typeof Notification === 'undefined') {
        console.log("Notification API not available");
        return;
      }

      if (Notification.permission !== "granted") {
        console.log("Notification permission not granted");
        return;
      }

      const options = {
        body: body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        tag: "admin-alert"
      };

      const notification = new Notification(title, options);

      notification.onclick = () => {
        notification.close();
        window.focus();
        
        if (title.includes('OT') || title.includes('Overtime')) {
          window.location.href = '/admin/ot-approvals';
        } else if (title.includes('Advance')) {
          window.location.href = '/admin/advances';
        }
      };

      setTimeout(() => {
        notification.close();
      }, 5000);

    } catch (error) {
      console.error("Error showing notification:", error);
    }
  }

  // Check if we can show notifications
  canShowNotifications() {
    try {
      return this.isSupported && this.permission === 'granted';
    } catch (error) {
      return false;
    }
  }
}

export const notificationManager = new NotificationManager();
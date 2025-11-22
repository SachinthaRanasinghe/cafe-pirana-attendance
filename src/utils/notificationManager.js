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

// Use this VAPID key (replace with your actual key from Firebase Console)
const vapidKey = "kCzc_zKcKD9gZMXnHDYvo5AJ_xgk28RZaxwXoWxIfEQ";

class NotificationManager {
  constructor() {
    this.isSupported = this.checkSupport();
    this.permission = Notification.permission;
    this.fcmToken = null;
    this.messaging = null;

    if (this.isSupported) {
      try {
        // Use the same app instance as your main app to avoid conflicts
        this.messaging = getMessaging();
        console.log("Firebase Messaging initialized for notifications");
      } catch (error) {
        console.error("Error initializing Firebase messaging:", error);
        this.isSupported = false;
      }
    }
  }

  // Enhanced iOS support check
  checkSupport() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // iOS Safari has limited push notification support
    if (isIOS && isSafari) {
      console.log("iOS Safari detected - push notifications may be limited");
      return 'Notification' in window;
    }
    
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  // Enhanced permission request for iOS
  async requestPermission(adminUid) {
    if (!this.isSupported) {
      console.log("Notifications not supported on this device");
      return false;
    }

    try {
      // For iOS, we need to request permission in a user interaction context
      this.permission = await Notification.requestPermission();
      
      if (this.permission !== 'granted') {
        console.log("Notification permission denied:", this.permission);
        return false;
      }

      console.log("Notification permission granted");

      // Only try to get FCM token if not on iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (!(isIOS && isSafari)) {
        await this.getFCMToken(adminUid);
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
      const token = await getToken(this.messaging, { vapidKey });

      if (!token) {
        console.log("No FCM token available - user may need to allow notifications");
        return null;
      }

      this.fcmToken = token;
      console.log("FCM token obtained:", token);

      // Store token in Firestore
      await setDoc(doc(db, "adminTokens", adminUid), {
        fcmToken: token,
        updatedAt: new Date().toISOString(),
        enabled: true,
        userAgent: navigator.userAgent
      }, { merge: true });

      return token;

    } catch (error) {
      console.error("Error getting FCM token:", error);
      
      // Check if it's an iOS Safari limitation
      if (error.code === 'messaging/unsupported-browser') {
        console.log("FCM not supported in this browser");
      }
      
      return null;
    }
  }

  // Foreground notifications
  setupForegroundListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log("Foreground message received:", payload);

      if (payload.notification) {
        this.showLocalNotification(
          payload.notification.title,
          payload.notification.body
        );
      }
    });
  }

  // Enhanced local notification for iOS
  showLocalNotification(title, body) {
    if (Notification.permission !== "granted") {
      console.log("Notification permission not granted");
      return;
    }

    try {
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
        
        // Navigate based on notification content
        if (title.includes('OT') || title.includes('Overtime')) {
          window.location.href = '/admin/ot-approvals';
        } else if (title.includes('Advance')) {
          window.location.href = '/admin/advances';
        }
      };

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

    } catch (error) {
      console.error("Error showing notification:", error);
    }
  }

  // Check if we can show notifications
  canShowNotifications() {
    return this.isSupported && this.permission === 'granted';
  }
}

export const notificationManager = new NotificationManager();
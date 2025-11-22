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
    this.hasRequested = false; // Track if we've already asked

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

  checkSupport() {
    try {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return false;
      }
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      console.log("Device detected - iOS:", isIOS, "Safari:", isSafari);
      
      // iOS Safari supports basic notifications but not service workers/push
      return true; // Always return true for basic Notification API
    } catch (error) {
      console.error("Error checking notification support:", error);
      return false;
    }
  }

  getPermissionStatus() {
    try {
      if (typeof Notification !== 'undefined') {
        return Notification.permission;
      }
      return 'default'; // Use 'default' instead of 'denied' for initial state
    } catch (error) {
      return 'default';
    }
  }

  // New method: Check if we should show the enable button
  shouldShowEnableButton() {
    return this.isSupported && this.permission === 'default' && !this.hasRequested;
  }

  // New method: Check if notifications are enabled
  areNotificationsEnabled() {
    return this.isSupported && this.permission === 'granted';
  }

  // New method: Get status message for UI
  getStatusMessage() {
    if (!this.isSupported) {
      return {
        type: 'error',
        message: '❌ Notifications not supported on this device',
        showEnable: false
      };
    }

    switch (this.permission) {
      case 'granted':
        return {
          type: 'success', 
          message: '✅ Notifications enabled',
          showEnable: false
        };
      case 'denied':
        return {
          type: 'error',
          message: '❌ Notifications blocked. Enable in Settings → Safari → Notifications',
          showEnable: false
        };
      case 'default':
        return {
          type: 'info',
          message: this.hasRequested ? 
            '⏳ Waiting for permission...' : 
            '🔔 Enable notifications to get alerts for new requests',
          showEnable: !this.hasRequested
        };
      default:
        return {
          type: 'info',
          message: '🔔 Enable push notifications',
          showEnable: true
        };
    }
  }

  async requestPermission(adminUid) {
    if (!this.isSupported) {
      console.log("Notifications not supported");
      return false;
    }

    // Don't request again if already denied
    if (this.permission === 'denied') {
      console.log("Notifications already denied by user");
      return false;
    }

    // Mark that we've requested permission
    this.hasRequested = true;

    try {
      console.log("Requesting notification permission...");
      
      // On iOS, this must be called from a direct user interaction
      this.permission = await Notification.requestPermission();
      
      console.log("Notification permission result:", this.permission);

      if (this.permission === 'granted') {
        console.log("✅ Notification permission granted");

        // Store preference in Firestore
        await setDoc(doc(db, "adminTokens", adminUid), {
          notificationsEnabled: true,
          permission: this.permission,
          updatedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          platform: 'web'
        }, { merge: true });

        // Try to get FCM token for non-iOS devices
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (!(isIOS && isSafari) && this.messaging) {
          await this.getFCMToken(adminUid);
        }

        return true;
      } else {
        console.log("Notification permission not granted:", this.permission);
        
        // Store the denial
        await setDoc(doc(db, "adminTokens", adminUid), {
          notificationsEnabled: false,
          permission: this.permission,
          updatedAt: new Date().toISOString(),
          userAgent: navigator.userAgent
        }, { merge: true });

        return false;
      }

    } catch (err) {
      console.error("Error requesting notification permission:", err);
      this.hasRequested = false; // Reset on error
      return false;
    }
  }

  async getFCMToken(adminUid) {
    if (!this.messaging) return null;

    try {
      const vapidKey = "YOUR_VAPID_KEY_HERE"; // Replace with actual key
      const token = await getToken(this.messaging, { vapidKey });

      if (token) {
        await setDoc(doc(db, "adminTokens", adminUid), {
          fcmToken: token,
          hasFCM: true
        }, { merge: true });
        return token;
      }
      return null;
    } catch (error) {
      console.error("Error getting FCM token:", error);
      return null;
    }
  }

  setupForegroundListener() {
    if (!this.messaging) return;

    try {
      onMessage(this.messaging, (payload) => {
        console.log("Foreground message:", payload);
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

  showLocalNotification(title, body) {
    try {
      if (this.permission !== 'granted') return;

      const notification = new Notification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        tag: "admin-alert"
      });

      notification.onclick = () => {
        notification.close();
        window.focus();
        if (title.includes('OT')) window.location.href = '/admin/ot-approvals';
        else if (title.includes('Advance')) window.location.href = '/admin/advances';
      };

      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error("Error showing notification:", error);
    }
  }
}

export const notificationManager = new NotificationManager();
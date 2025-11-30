import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

class NotificationManager {
  constructor() {
    this.isIOS = this.checkIfIOS();
    this.isSupported = this.checkSupport();
    this.permission = this.getPermissionStatus();
    this.fcmToken = null;
    this.messaging = null;
    this.hasRequested = false;
    this.pendingRequests = { ot: 0, advance: 0 };

    console.log("Notification Manager initialized:", {
      isIOS: this.isIOS,
      isSupported: this.isSupported,
      permission: this.permission,
      userAgent: navigator.userAgent
    });

    if (this.isSupported && !this.isIOS) {
      try {
        this.messaging = getMessaging();
        console.log("Firebase Messaging initialized for non-iOS devices");
      } catch (error) {
        console.error("Error initializing Firebase messaging:", error);
      }
    }

    // Note: setupRequestListeners will be called after user login with email
  }

  checkIfIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  checkSupport() {
    try {
      // iOS Safari doesn't support Notification API in web apps
      if (this.isIOS) {
        return false; // Explicitly false for iOS web apps
      }
      
      // For other browsers, check normal support
      return typeof Notification !== 'undefined' && 
             'serviceWorker' in navigator && 
             'PushManager' in window;
    } catch (error) {
      return false;
    }
  }

  getPermissionStatus() {
    try {
      if (typeof Notification !== 'undefined') {
        return Notification.permission;
      }
      return 'unsupported';
    } catch (error) {
      return 'unsupported';
    }
  }

  // Set up Firestore listeners to track pending requests
  setupRequestListeners(userEmail) {
    // Only set up listeners for admin users
    if (userEmail !== 'admin@cafepiranha.com') {
      console.log('Skipping request listeners - not admin user');
      return;
    }

    try {
      // Listen for OT requests
      const otQuery = query(
        collection(db, 'adjustmentRequests'),
        where('status', '==', 'pending')
      );

      const otUnsubscribe = onSnapshot(otQuery, 
        (snapshot) => {
          this.pendingRequests.ot = snapshot.size;
          console.log(`Pending OT requests: ${snapshot.size}`);
          this.updateUI();
        },
        (error) => {
          console.error('Error listening to OT requests:', error);
        }
      );

      // Listen for advance requests
      const advanceQuery = query(
        collection(db, 'advanceRequests'),
        where('status', '==', 'pending')
      );

      const advanceUnsubscribe = onSnapshot(advanceQuery,
        (snapshot) => {
          this.pendingRequests.advance = snapshot.size;
          console.log(`Pending Advance requests: ${snapshot.size}`);
          this.updateUI();
        },
        (error) => {
          console.error('Error listening to advance requests:', error);
        }
      );

      // Store unsubscribe functions
      this.unsubscribeListeners = [otUnsubscribe, advanceUnsubscribe];
    } catch (error) {
      console.error('Error setting up request listeners:', error);
    }
  }

  // Update UI when request counts change
  updateUI() {
    // This will be called by the React component
    if (this.onPendingRequestsUpdate) {
      this.onPendingRequestsUpdate(this.pendingRequests);
    }
  }

  // Set callback for React component
  setPendingRequestsCallback(callback) {
    this.onPendingRequestsUpdate = callback;
    // Call immediately with current state
    callback(this.pendingRequests);
  }

  // Get status for UI display
  getStatusInfo() {
    if (this.isIOS) {
      return {
        type: 'ios',
        title: '📱 iOS Device',
        message: 'Push notifications are not available in Safari. Use a different browser or check this dashboard regularly.',
        showEnable: false,
        showRefresh: true
      };
    }

    if (!this.isSupported) {
      return {
        type: 'unsupported',
        title: '❌ Not Supported',
        message: 'Your browser does not support push notifications.',
        showEnable: false,
        showRefresh: false
      };
    }

    switch (this.permission) {
      case 'granted':
        return {
          type: 'enabled',
          title: '✅ Enabled',
          message: 'You will receive notifications for new requests.',
          showEnable: false,
          showRefresh: false
        };
      case 'denied':
        return {
          type: 'denied',
          title: '❌ Blocked',
          message: 'Notifications are blocked. Please enable them in your browser settings.',
          showEnable: false,
          showRefresh: true
        };
      case 'default':
        return {
          type: 'default',
          title: '🔔 Notifications',
          message: 'Enable to get alerts for new OT and Advance requests.',
          showEnable: true,
          showRefresh: false
        };
      default:
        return {
          type: 'unknown',
          title: '🔔 Notifications',
          message: 'Enable push notifications for alerts.',
          showEnable: true,
          showRefresh: false
        };
    }
  }

  async requestPermission(adminUid) {
    if (!this.isSupported || this.isIOS) {
      console.log("Notifications not supported on this device");
      return false;
    }

    if (this.permission === 'denied') {
      console.log("Notifications already denied");
      return false;
    }

    this.hasRequested = true;

    try {
      this.permission = await Notification.requestPermission();
      
      if (this.permission === 'granted') {
        console.log("✅ Notifications enabled");
        
        await setDoc(doc(db, "adminTokens", adminUid), {
          notificationsEnabled: true,
          permission: this.permission,
          updatedAt: new Date().toISOString(),
          userAgent: navigator.userAgent
        }, { merge: true });

        // Get FCM token for supported browsers
        if (this.messaging) {
          await this.getFCMToken(adminUid);
        }

        return true;
      }
      
      return false;
    } catch (err) {
      console.error("Error requesting permission:", err);
      return false;
    }
  }

  async getFCMToken(adminUid) {
    if (!this.messaging) return null;

    try {
      const vapidKey = "YOUR_VAPID_KEY_HERE";
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

  // Clean up listeners
  cleanup() {
    if (this.unsubscribeListeners) {
      this.unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    }
  }

  // Get current pending requests
  getPendingRequests() {
    return this.pendingRequests;
  }
}

export const notificationManager = new NotificationManager();
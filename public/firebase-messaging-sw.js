// Firebase Service Worker for Background Notifications
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js");

// Load Firebase configuration from generated config file
importScripts("/firebase-config.js");

// Initialize Firebase with config from environment variables
firebase.initializeApp(self.FIREBASE_CONFIG || {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Request';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new request pending',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'request-notification',
    requireInteraction: true
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window exists, open one
      if (clients.openWindow) {
        let url = '/admin';
        
        // Navigate to specific page based on notification
        if (event.notification.title.includes('OT')) {
          url = '/admin/ot-approvals';
        } else if (event.notification.title.includes('Advance')) {
          url = '/admin/advances';
        }
        
        return clients.openWindow(url);
      }
    })
  );
});
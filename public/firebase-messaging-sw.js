importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBrOI8XqyYzWgE-sKMEjJMdeGtoKz7Pt2o",
  authDomain: "cafe-pirana-attendance.firebaseapp.com",
  projectId: "cafe-pirana-attendance",
  storageBucket: "cafe-pirana-attendance.appspot.com",
  messagingSenderId: "1009772109491",
  appId: "1:1009772109491:web:5d0d28f9495e016567dac6"
});

const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Notification";
  const body = payload.notification?.body || "You have a new message";

  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png"
  });
});

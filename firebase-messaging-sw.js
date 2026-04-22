importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAi3vb0pmOynFIqFgL3t9LkSlpqCXcVIK4",
    authDomain: "filmak-app-ed34b.firebaseapp.com",
    projectId: "filmak-app-ed34b",
    storageBucket: "filmak-app-ed34b.firebasestorage.app",
    messagingSenderId: "779263085850",
    appId: "1:779263085850:web:0887102ce0e150dae9b0a3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'صور/logo.jpg',
        badge: 'صور/logo.jpg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

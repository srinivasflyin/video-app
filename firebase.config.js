// src/firebaseConfig.js

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config here
  apiKey: "AIzaSyB9zWlBsV5EMCiB-pFD6S300QZWdcStXQQ",
  authDomain: "test-video-a6aea.firebaseapp.com",
  projectId: "test-video-a6aea",
  storageBucket: "test-video-a6aea.firebasestorage.app",
  messagingSenderId: "376578543344",
  appId: "1:376578543344:web:e0ff4a870fcb60d80cfc35"
};

// Initialize Firebase app if it's not already initialized
const firebaseApp = getApps().length
  ? getApp() // Get the already initialized app
  : initializeApp(firebaseConfig); // Initialize a new app

// Get Firestore instance
const firestore = getFirestore(firebaseApp);

export { firestore };

// src/firebaseConfig.js

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config here
  apiKey: "AIzaSyAPs_CgegiTL8V6DOtExxfl9Qz7hOKaqZw",
  authDomain: "test-firebase-fa21c.firebaseapp.com",
  projectId: "test-firebase-fa21c",
  storageBucket: "test-firebase-fa21c.firebasestorage.app",
  messagingSenderId: "1093304565669",
  appId: "1:1093304565669:web:c454fcc5651f6436c5324c"
};

// Initialize Firebase app if it's not already initialized
const firebaseApp = getApps().length
  ? getApp() // Get the already initialized app
  : initializeApp(firebaseConfig); // Initialize a new app

// Get Firestore instance
const firestore = getFirestore(firebaseApp);

export { firestore };

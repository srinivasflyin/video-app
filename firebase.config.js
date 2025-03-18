// src/firebaseConfig.js

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase config here
  apiKey: "AIzaSyCxjoy2q2dGt6bP-2TPhIwiHXsK4UPugJQ",
  authDomain: "test-video-12a1c.firebaseapp.com",
  projectId: "test-video-12a1c",
  storageBucket: "test-video-12a1c.firebasestorage.app",
  messagingSenderId: "310458221430",
  appId: "1:310458221430:web:e494c62857c470f19b3057"
};

// Initialize Firebase app if it's not already initialized
const firebaseApp = getApps().length
  ? getApp() // Get the already initialized app
  : initializeApp(firebaseConfig); // Initialize a new app

// Get Firestore instance
const firestore = getFirestore(firebaseApp);

export { firestore };

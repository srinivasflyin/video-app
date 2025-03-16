import firebase from 'firebase/app';
import 'firebase/firestore';

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyAPs_CgegiTL8V6DOtExxfl9Qz7hOKaqZw",
  authDomain: "test-firebase-fa21c.firebaseapp.com",
  projectId: "test-firebase-fa21c",
  storageBucket: "test-firebase-fa21c.firebasestorage.app",
  messagingSenderId: "1093304565669",
  appId: "1:1093304565669:web:c454fcc5651f6436c5324c"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

// Elements
const createMeetingButton = document.getElementById("createMeetingButton");
const joinMeetingButton = document.getElementById("joinMeetingButton");
const meetingIdInput = document.getElementById("meetingIdInput");

// Create meeting logic
createMeetingButton.onclick = async () => {
  const meetingId = generateMeetingId();
  localStorage.setItem("meetingId", meetingId);
  alert(`Meeting created with ID: ${meetingId}`);

  // Create a new document in Firestore for the meeting
  const callDoc = firestore.collection('calls').doc(meetingId);
  await callDoc.set({});

  // Redirect to meeting page
  window.location.href = `meeting.html?meetingId=${meetingId}`;
};

// Join meeting logic
joinMeetingButton.onclick = async () => {
  const meetingId = meetingIdInput.value;
  if (meetingId) {
    localStorage.setItem("meetingId", meetingId);
    window.location.href = `meeting.html?meetingId=${meetingId}`;
  } else {
    alert("Please enter a valid meeting ID.");
  }
};

// Generate random meeting ID
function generateMeetingId() {
  return Math.random().toString(36).substr(2, 9);
}

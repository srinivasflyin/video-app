import './style.css';
import { firestore } from './firebase.config';
import { collection, getDocs, doc, setDoc, onSnapshot, updateDoc, query, where, addDoc, getDoc, deleteDoc } from 'firebase/firestore';

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
  iceCandidatePoolSize: 10,
};

// Global state variables
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let dataChannel = null;

// DOM elements
const hangupButton = document.getElementById('hangupButton');
const userListDiv = document.getElementById('userList');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const notificationContainer = document.getElementById('notificationContainer');
// Get references to the login elements
const loginPopup = document.getElementById('loginPopup');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const errorMessage = document.getElementById('errorMessage');
// Get online users from Firestore
// Get online users from Firestore excluding the current user
async function getUsers() {
  const userListRef = collection(firestore, 'users');
  const querySnapshot = await getDocs(userListRef);

  // Get the current user ID from localStorage (or wherever it's stored)
  const currentUserId = localStorage.getItem('currentUserId');

  userListDiv.innerHTML = ''; // Clear the previous list

  querySnapshot.forEach(doc => {
    const userData = doc.data();

    // Skip the current user from the list
    if (doc.id === currentUserId) {
      return; // Don't add the current user to the list
    }

    const userItem = document.createElement('div');
    userItem.classList.add('user-item');
    userItem.textContent = `Call to: ${userData.username}`;
    userItem.onclick = () => initiateCall(currentUserId, doc.id);
    userListDiv.appendChild(userItem);
  });
}



// Logic to remove the document based on targetUserId
async function removeNotification(targetUserId) {
  const notificationElement = document.getElementById('notificationContainer');
  notificationElement.style.display = 'none';
 // Reference to the specific user's notifications document
 const incomingCallsRef = collection(firestore, 'notifications', targetUserId, 'incomingCalls');
 // Check if the document exists
const querySnapshot = await getDocs(incomingCallsRef);

// Loop through each document and delete it
querySnapshot.forEach(async (documentSnapshot) => {
  const docRef = doc(incomingCallsRef, documentSnapshot.id);  // Get reference to the document
  console.log(`Document with callId: ${targetUserId} removed successfully.`);
  await deleteDoc(docRef);  // Delete the document
});

}


async function initiateCall(currentUserId, targetUserId) {
  // Generate a unique call ID based on the two users' IDs
  const currentCallId = `${currentUserId}-${targetUserId}`;

  // Reference to the Firestore document for this specific call
  const callDocRef = doc(firestore, 'calls', currentCallId); // Firestore document for this call
  const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
  // Set up ICE candidates for the call
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidatesRef, event.candidate.toJSON());
    }
  };

  // Store the call document with the offer information
  const offerDescription = await pc.createOffer();

  // Save offer to Firestore
  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };
  setLocalDescriptionSafely(offerDescription);

  await setDoc(callDocRef, { offer, callerId: currentUserId });

  // // Listen for remote answer
  onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // // // When answered, add candidates to the peer connection
  onSnapshot(answerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
  // Notify the callee about the incoming call (via Firestore)
  sendMessageToCallee(targetUserId, currentUserId, currentCallId);  // Notify target user about the call

  console.log(`Call initiated with call ID: ${currentCallId}`);
}


function sendMessageToCallee(targetUserId, currentUserId, currentCallId) {
  console.log('hhhhhhhhhhhhhhh', targetUserId, currentCallId, currentCallId);
  // Store the call notification in Firestore for the target user
  const notificationsRef = collection(firestore, 'notifications', targetUserId, 'incomingCalls');
  addDoc(notificationsRef, {
    callerId: currentUserId,
    callId: currentCallId,
    targetUserId,
    timestamp: new Date(),
  });

  console.log(`Call notification sent to user ${targetUserId}`);
}

// Set local media
async function setupLocalMedia() {
  remoteVideo.style.display = 'none';
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  localVideo.srcObject = localStream;
  //remoteVideo.srcObject = remoteStream;
}

// Create data channel
function createDataChannel() {
  dataChannel = pc.createDataChannel('messageChannel');
  dataChannel.onmessage = (event) => {
    console.log('Message received: ', event.data);
    showNotification(event.data);
  };

  dataChannel.onopen = () => {
    console.log('Data channel is open');
  };

  dataChannel.onerror = (error) => {
    console.error('Data channel error:', error);
  };

  dataChannel.onclose = () => {
    console.log('Data channel is closed');
  };
}

// Send message via data channel
function sendMessage(message) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(message);
  }
}

// Show notification
function showNotification(message) {
  notificationContainer.textContent = message;
  notificationContainer.style.display = 'block';
}

// Setup the remote stream
pc.ontrack = (event) => {
  remoteVideo.style.display = 'block';
  remoteStream = event.streams[0];
  remoteVideo.srcObject = remoteStream;
};

// Hangup the call
hangupButton.onclick = () => {
  localStream.getTracks().forEach(track => track.stop());
  remoteStream.getTracks().forEach(track => track.stop());
  pc.close();
  hangupButton.style.display = 'none';
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
};


async function listenForIncomingCall(targetUserId) {
  // Listen for incoming calls from the 'notifications' collection
  const notificationsRef = collection(firestore, 'notifications', targetUserId, 'incomingCalls');
  onSnapshot(notificationsRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added') {
        const callData = change.doc.data();
        const { callerId, callId, targetUserId } = callData;

        // Notify the callee about the incoming call (e.g., show an "Answer" button)
        showIncomingCallNotification(callerId, callId, targetUserId);
      }
    });
  });
}


function showIncomingCallNotification(callerId, callId, targetUserId) {
  const notificationElement = document.getElementById('notificationContainer');
  notificationElement.style.display = 'block';
  const incomingCallMessageElement = document.getElementById('incomingCallMessage');
  incomingCallMessageElement.textContent = `Incoming call from ${callerId}`;
  const answerButton = document.getElementById('answerButton');
  console.log('hhhhhhhhhhhhh', answerButton);
  answerButton.disabled = false;
  answerButton.onclick = () => answerCall(callId, targetUserId);
}



async function answerCall(callId, targetUserId) {
  const callDocRef = doc(firestore, 'calls', callId);
  const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates');

  const callDocSnap = await getDoc(callDocRef);
  const callData = callDocSnap.data();
  const offerDescription = callData.offer;

  // Get candidates for the callee (answerer), save to Firestore
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidatesRef, event.candidate.toJSON());
    }
  };
  // Set the remote description (offer) from the caller
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  // Create the answer and send it back to Firestore
  const answerDescription = await pc.createAnswer();
  setLocalDescriptionSafely(answerDescription);

  // Prepare the answer to send back
  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  // Send the answer back to Peer A through the signaling server
  await updateDoc(callDocRef, { answer });

  // Send the answer back to Firestore
  await updateDoc(callDocRef, { answer: answerDescription });

  // Listen for incoming ICE candidates from the caller
  onSnapshot(offerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  // Start the data channel after answering
  // createDataChannel();
  // sendMessage('Call accepted');
  removeNotification(targetUserId);
  hangupButton.style.display = 'block';
}

// Show the login popup when the app loads (can replace this with your logic to show/hide the popup)
window.onload = () => {
  loginPopup.style.display = 'flex';  // Show login popup on app load
};

// Handle the login process
loginButton.addEventListener('click', async () => {
  hangupButton.style.display = 'none';
  const username = usernameInput.value;
  const password = passwordInput.value;

  if (username === '' || password === '') {
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Please fill out all fields.';
    return;
  }

  try {
    // Query Firestore to check if the username exists
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // No user found with the given username
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Invalid username or password.';
      return;
    }

    // Assuming there's only one user with the given username
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // Check if the password matches
    if (userData.password === password) {
      // Successful login, save user ID (or any other user info you need)
      const currentUserId = userDoc.id;  // Firebase document ID as the user ID

      // Store the current user ID in localStorage or in memory
      localStorage.setItem('currentUserId', currentUserId);

      // Close the login popup
      loginPopup.style.display = 'none';

      // Proceed with the app, maybe load user data or move to the next screen
      console.log('Login successful, user ID:', currentUserId);
      // Fetch the list of users and set up local video
      setupLocalMedia();
      listenForIncomingCall(currentUserId);
      getUsers();
    } else {
      // Password does not match
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Invalid username or password.';
    }
  } catch (error) {
    console.error('Error during login:', error);
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'An error occurred, please try again.';
  }
});


function setLocalDescriptionSafely(description) {
  console.log("Setting local description:", description, pc.signalingState);
  if (pc.signalingState === 'stable') {
    // It's safe to set an offer in 'stable' state
    pc.setLocalDescription(description)
      .then(() => {
        console.log("Local description set successfully.");
      })
      .catch((error) => {
        console.error(`Error setting local description:${pc.signalingState}, ${error}`);
      });
  } else if (pc.signalingState === 'have-remote-offer' && description.type === 'answer') {
    // It's safe to set an answer if the signaling state is 'have-remote-offer'
    pc.setLocalDescription(description)
      .then(() => {
        console.log("Local answer set successfully.");
      })
      .catch((error) => {
        console.error(`Error setting local answer:${pc.signalingState}, error`);
      });
  } else if (pc.signalingState === 'have-remote-offer' && description.type === 'offer') {
    // Step 1: Set the remote description (offer)
    pc.setRemoteDescription(new RTCSessionDescription(description))

  } else {
    console.log(`Cannot set local description in current signaling state:${pc.signalingState}`);
  }
}


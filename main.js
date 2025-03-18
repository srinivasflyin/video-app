import './style.css';
import {
  updateDoc,
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";

import { firestore } from "./firebase.config";

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let meetingId = '';
let dataChannel = null; // Data channel for messaging

// Create the data channel and set up the message sending/receiving logic
function createDataChannel() {
  // Create the data channel for sending and receiving messages
  dataChannel = pc.createDataChannel('messageChannel');

  // Handle messages received on the data channel
  dataChannel.onmessage = (event) => {
    console.log('Message received: ', event.data);
    showNotification(event.data);  // Display the received message
  };

  // Handle open state of the data channel
  dataChannel.onopen = () => {
    console.log('Data channel is open');
  };

  // Handle error in the data channel
  dataChannel.onerror = (error) => {
    console.error('Data channel error:', error);
  };

  // Handle close event of the data channel
  dataChannel.onclose = () => {
    console.log('Data channel is closed');
  };
}

// Send message function
function sendMessage(message) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(message);  // Send the message through the data channel
    console.log('Message sent: ', message);
  } else {
    console.log('Data channel is not open');
  }
}

// Function to display notifications
function showNotification(message) {
  const notificationContainer = document.getElementById('notificationContainer');
  notificationContainer.textContent = message;
  notificationContainer.style.display = 'block';

  // Hide notification after 5 seconds
  setTimeout(() => {
    notificationContainer.style.display = 'none';
  }, 5000);
}


// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// Generate a unique call ID
function generateUniqueCallId() {
  return Math.random().toString(36).substr(2, 9); // Generate a random 9-character call ID
}

function setLocalDescriptionSafely(description) {
  console.log("Setting local description:", description, pc.signalingState);
  if (pc.signalingState === 'stable') {
    pc.setLocalDescription(description)
      .then(() => {
        console.log("Local description set successfully.");
      })
      .catch((error) => {
        console.error(`Error setting local description:${pc.signalingState}`, error);
      });
  } else if (pc.signalingState === 'have-remote-offer' && description.type === 'answer') {
    pc.setLocalDescription(description)
      .then(() => {
        console.log("Local answer set successfully.");
      })
      .catch((error) => {
        console.error(`Error setting local answer:${pc.signalingState}`, error);
      });
  } else if (pc.signalingState === 'have-remote-offer' && description.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(description))
  } else {
    console.log(`Cannot set local description in current signaling state:${pc.signalingState}`, pc.signalingState);
  }
}

// 1. Setup media sources
webcamButton.onclick = async () => {
  pc = new RTCPeerConnection(servers);
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

callButton.onclick = async () => {
  // Generate a new document reference in the 'calls' collection
  meetingId = generateUniqueCallId();
  const callDocRef = doc(firestore, 'calls', meetingId);
  const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates');

  // Display the call document ID in the input
  callInput.value = callDocRef.id;

  // Get candidates for the caller, save to Firestore
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidatesRef, event.candidate.toJSON());
    }
  };

  // Create the offer
  const offerDescription = await pc.createOffer();

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  setLocalDescriptionSafely(offerDescription);

  // Set the offer in Firestore (create the document with offer data)
  await setDoc(callDocRef, { offer });

  // Listen for remote answer
  onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidates to the peer connection
  onSnapshot(answerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  createDataChannel();
  // Send a message through the data channel to notify the callee
  sendMessage('Call initiated');

  hangupButton.disabled = false;
}

answerButton.onclick = async () => {
  const callId = callInput.value;
  if (callId === '') {
    alert('Please enter a valid call ID.');
  }

  if (callId === meetingId) {
    alert('Please enter a valid call ID.');
  }

  // Reference the specific call document
  const callDocRef = doc(firestore, 'calls', callId);
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
  const offerCandidatesRef = collection(callDocRef, 'offerCandidates');

  // Get candidates for the callee (answerer), save to Firestore
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidatesRef, event.candidate.toJSON());
    }
  };

  // Get the call document data (the offer)
  const callDocSnap = await getDoc(callDocRef);
  const callData = callDocSnap.data();
  const callDocOfferDescription = callData.offer;

  // Set the remote description (the offer) to establish the connection
  await pc.setRemoteDescription(new RTCSessionDescription(callDocOfferDescription));

  // Create an answer
  const answerDescription = await pc.createAnswer();

  // Set the local description (the answer) and send it back to Peer A
  setLocalDescriptionSafely(answerDescription);

  // Prepare the answer to send back
  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  // Send the answer back to Peer A through Firestore
  await updateDoc(callDocRef, { answer });

  // Listen for offer candidates and add them to the peer connection
  onSnapshot(offerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });

  // Listen for the remote stream after the connection is established
  pc.ontrack = (event) => {
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = event.streams[0];
  };

  // Disable buttons after establishing the connection
  callButton.disabled = true;
  answerButton.disabled = true;
  webcamButton.disabled = true;
  hangupButton.disabled = false;
  createDataChannel();  // Create the data channel on the answerer's side
  sendMessage('Call accepted');  // Notify the caller

};

// Function to end the call
hangupButton.onclick = async () => {
  // Stop all local media tracks (audio/video)
  const localStream = pc.getLocalStreams()[0];
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // Stop the remote stream (if applicable)
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  // Close the RTCPeerConnection
  if (pc) {
    pc.close();
    console.log("Peer connection closed");
  }

  // Optionally: Close the signaling connection (e.g., WebSocket)
  // signalingSocket.close(); // Uncomment this if you want to close the signaling channel.

  // Optionally: Clean up UI, such as hiding video elements or showing a disconnected message
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  const localVideo = document.getElementById('localVideo');
  if (localVideo) {
    localVideo.srcObject = null;
  }

  console.log("Call ended and resources cleaned up");

  webcamButton.disabled = false;
}

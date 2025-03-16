import firebase from 'firebase/app';
import 'firebase/firestore';

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

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

let localStream;
let pc;
let remoteStreams = {};

const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('remoteVideos');
const hangupButton = document.getElementById('hangupButton');

// Get the meeting ID from the URL (for this particular meeting)
const params = new URLSearchParams(window.location.search);
const meetingId = params.get("meetingId");

// Start the local video stream (audio/video)
async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    hangupButton.disabled = false;
  } catch (error) {
    console.error("Error accessing local media devices:", error);
  }
}

// Function to initiate the peer connection for a remote participant
async function startPeerConnection(remoteId) {
  // Initialize a new RTCPeerConnection for each remote peer
  const peerConnection = new RTCPeerConnection(servers);

  // Add the local stream tracks to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // When remote stream is added, display the video
  peerConnection.ontrack = (event) => {
    if (!remoteStreams[remoteId]) {
      const remoteVideo = document.createElement("video");
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.autoplay = true;
      remoteVideo.playsinline = true;
      remoteVideosContainer.appendChild(remoteVideo);
      remoteStreams[remoteId] = remoteVideo;
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      firestore.collection('calls').doc(meetingId)
        .collection('offerCandidates')
        .add(event.candidate.toJSON());
    }
  };

  // Create an offer and send it to Firestore
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const callDoc = firestore.collection('calls').doc(meetingId);
  await callDoc.set({
    offer: {
      sdp: offer.sdp,
      type: offer.type,
    },
  });

  // Listen for an answer from the other participant
  callDoc.onSnapshot(async (snapshot) => {
    const data = snapshot.data();
    if (data && data.answer && peerConnection) {
      const answerDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(answerDescription);
    }
  });

  return peerConnection;
}

// Listen for remote candidates and add them to the peer connection
function listenForRemoteCandidates(peerConnection) {
  const callDoc = firestore.collection('calls').doc(meetingId);
  const answerCandidates = callDoc.collection('answerCandidates');

  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });
}

// Listen for incoming offers (from other participants)
function listenForIncomingOffers() {
  const callDoc = firestore.collection('calls').doc(meetingId);

  callDoc.onSnapshot(async (snapshot) => {
    const data = snapshot.data();
    if (data && data.offer && !pc) {
      // Start a peer connection for the remote participant
      const remoteId = "remote-peer-id"; // In a real application, generate unique IDs for each participant
      pc = await startPeerConnection(remoteId);

      // Set the received offer as the remote description
      const offerDescription = new RTCSessionDescription(data.offer);
      await pc.setRemoteDescription(offerDescription);

      // Create and send an answer back to the caller
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await callDoc.update({
        answer: {
          sdp: answer.sdp,
          type: answer.type,
        },
      });
    }
  });
}

// Start the local stream and set up remote participants
startLocalStream();
listenForRemoteCandidates();
listenForIncomingOffers();

// Hangup button handler
hangupButton.onclick = () => {
  // Stop all local stream tracks
  localStream.getTracks().forEach(track => track.stop());

  // Close the peer connection if it exists
  if (pc) pc.close();

  // Clear the remote streams
  Object.values(remoteStreams).forEach(remoteVideo => remoteVideo.srcObject = null);
  remoteStreams = {};

  // Redirect to the homepage after hanging up
  window.location.href = 'index.html';
};

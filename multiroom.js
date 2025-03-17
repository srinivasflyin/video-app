//import { initializeApp, getApp, getApps } from 'firebase/app';
import { doc, setDoc, updateDoc, collection, onSnapshot, addDoc, query, orderBy, limit, getDocs   } from 'firebase/firestore';
//import { collection, doc, onSnapshot, addDoc } from 'firebase/firestore';  // Modular SDK functions
import { firestore } from './firebase.config';
// const firebaseConfig = {
//   // Your Firebase config here
//   apiKey: "AIzaSyAPs_CgegiTL8V6DOtExxfl9Qz7hOKaqZw",
//   authDomain: "test-firebase-fa21c.firebaseapp.com",
//   projectId: "test-firebase-fa21c",
//   storageBucket: "test-firebase-fa21c.firebasestorage.app",
//   messagingSenderId: "1093304565669",
//   appId: "1:1093304565669:web:c454fcc5651f6436c5324c"
// };

// const app = initializeApp(firebaseConfig);
// const firestore = getFirestore(app);

// Initialize Firebase app if it's not already initialized
// const firebaseApp = getApps().length
//   ? getApp() // Get the already initialized app
//   : initializeApp(firebaseConfig); // Initialize a new app
// // Get Firestore instance

// const firestore = getFirestore(firebaseApp);


const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

let localStream;
let peerConnections = {}; // A collection of peer connections
let remoteStreams = {}; // A collection of remote video elements

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
async function startPeerConnection(participantId) {
    console.log('startPeerConnection:', participantId);
  // Initialize a new RTCPeerConnection for each remote peer
  const peerConnection = new RTCPeerConnection(servers);

  // Add the local stream tracks to the peer connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // When remote stream is added, display the video
  peerConnection.ontrack = (event) => {
    console.log('peerConnection.ontrack:', event);
    if (!remoteStreams[participantId]) {
      const remoteVideo = document.createElement("video");
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.autoplay = true;
      remoteVideo.playsinline = true;
      remoteVideosContainer.appendChild(remoteVideo);
      remoteStreams[participantId] = remoteVideo;
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(collection(doc(firestore, 'calls', meetingId), 'offerCandidates'), event.candidate.toJSON());
    }
  };

  // Create an offer and send it to Firestore
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const callDocRef = doc(firestore, 'calls', meetingId);
  await setDoc(callDocRef, {
    offer: {
      sdp: offer.sdp,
      type: offer.type,
    },
  });

  // Listen for an answer from the other participant
  onSnapshot(callDocRef, async (snapshot) => {
    console.log('onSnapshot(callDocRef', snapshot);
    const data = snapshot.data();
    if (data && data.answer && peerConnection) {
      const answerDescription = new RTCSessionDescription(data.answer);
      await peerConnection.setRemoteDescription(answerDescription);
    }
  });

  peerConnections[participantId] = peerConnection; // Store the peer connection by participantId
  console.log('onSnapshot(peerConnections[participantId] = peerConnection;', peerConnection);
  return peerConnection;
}

// Listen for remote candidates and add them to the peer connection
function listenForRemoteCandidates(participantId, peerConnection) {
    console.log('listenForRemoteCandidates:participantId', participantId);
    console.log('listenForRemoteCandidates:peerConnection', peerConnection);
    // const callDoc = firestore.collection('calls').doc(meetingId);
    // const answerCandidates = callDoc.collection('answerCandidates');
    const callDocRef = doc(firestore, 'calls', meetingId);
    // Get reference to the 'answerCandidates' collection within the call document
    const answerCandidates = collection(callDocRef, 'answerCandidates');
   
  onSnapshot(answerCandidates, snapshot => {
    console.log('onSnapshot(answerCandidates:snapshot', snapshot);
    snapshot.docChanges().forEach((change) => {
        console.log('snapshot.docChanges()', change);
      if (change.type === 'added') {
        console.log('change.type === :added', change);
        const candidate = new RTCIceCandidate(change.doc.data());
        console.log('remoteStreams[participantId]', remoteStreams[participantId]);
        //peerConnection.addIceCandidate(candidate);
        if (remoteStreams[participantId]) {
            peerConnection.addIceCandidate(candidate);
          }
      }
    });
  });
}


// Fetch the latest participant (the one who joined last) based on 'joinedAt' field
async function getLastAddedParticipant(meetingId) {
    console.log('getLastAddedParticipant:meetingId:', meetingId);
    // const participantsRef = firestore.collection('calls').doc(meetingId).collection('participants');
  
    // // Sort by 'joinedAt' in descending order to get the most recent participant
    // const snapshot = await participantsRef.orderBy('joinedAt', 'desc').limit(1).get();
    //import { getFirestore, doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Get Firestore instance
//const db = getFirestore();

// Get a reference to the participants collection within the specific call document
const participantsRef = collection(doc(firestore, 'calls', meetingId), 'participants');

// Create a query to order by 'joinedAt' in descending order and limit to 1 result
const participantsQuery = query(participantsRef, orderBy('joinedAt', 'desc'), limit(1));
console.log('participantsQuery:participantsQuery:', participantsQuery);
// Get the snapshot of the query results
const snapshot = await getDocs(participantsQuery);
console.log('participantsQuery:result:snapshot:', snapshot);
if (!snapshot.empty) {
  // Handle the non-empty snapshot
//}

    //if (!snapshot.empty) {
      const participantDoc = snapshot.docs[0]; // Get the most recent participant (first doc)
      const participantId = participantDoc.id; // participantId is the document ID
      //const participantData = participantDoc.data(); // Get the data (status, joinedAt, etc.)
      
      console.log("Fetched last added participant:", participantId);
      return participantId; // You can use this participantId in your WebRTC connection logic
    } else {
      console.log("No participants found.");
      return null;
    }
  }
  
  // Example usage
  //const meetingId = new URLSearchParams(window.location.search).get('meetingId');

//   getLastAddedParticipant(meetingId).then(participantId => {
//     if (participantId) {
//       // Proceed with WebRTC logic using participantId
//       console.log("Start WebRTC with participantId:", participantId);
//     }
//   });

// Start the meeting and get the participantId
// async function getParticipantId() {
//   const participantId = await getLastAddedParticipant(meetingId);

//   if (participantId) {
//     // Continue with the WebRTC setup, pass participantId where necessary
//     console.log("Start WebRTC with participantId:", participantId);
//   } else {
//     alert("No participants found.");
//   }
// }

// Call the startMeeting function when you are ready to start the WebRTC connection
//getPartId();


// Listen for incoming offers (from other participants)
async function listenForIncomingOffers() {
  const partId = await getLastAddedParticipant(meetingId);
  console.log('listenForIncomingOffers:partId:', partId);
  // check if latest partcipant id is available
  if (partId) {
    console.log('listenForIncomingOffers:if:partId:', partId);
  //const callDocRef = doc(firestore, 'calls', meetingId);
  //const participantsRef = collection(callDocRef, 'participants');

  // Listen for changes to the participants list
// Get a reference to the specific call document
const callDocRef = doc(firestore, 'calls', meetingId);
// Listen for real-time updates on the call document
//onSnapshot(callDocRef, (snapshot) => {

  onSnapshot(callDocRef, async (snapshot) => {
    console.log('onSnapshot(callDocRef:snapshot:', snapshot);
    const data = snapshot.data();
    if (data && data.offer) {
      // In a real application, generate unique IDs for each participant
      // Start a peer connection for the remote participant
      const pc = await startPeerConnection(partId);
      console.log('await startPeerConnection:pc', pc);
      listenForRemoteCandidates(partId, pc); // Listen for remote candidates for this peer connection
      console.log('listenForRemoteCandidates:pc', pc);
      // Set the received offer as the remote description
      const offerDescription = new RTCSessionDescription(data.offer);
      await pc.setRemoteDescription(offerDescription);

      // Create and send an answer back to the caller
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(callDocRef, {
        answer: {
          sdp: answer.sdp,
          type: answer.type,
        },
      });
    }
  });

}
}

// Start the local stream and set up remote participants
async function init() {
await startLocalStream();
listenForIncomingOffers();
}
// Hangup button handler
hangupButton.onclick = () => {
  // Stop all local stream tracks
  localStream.getTracks().forEach(track => track.stop());

  // Close all peer connections
  Object.values(peerConnections).forEach((peerConnection) => {
    peerConnection.close();
  });

  // Clear the remote streams
  Object.values(remoteStreams).forEach(remoteVideo => remoteVideo.srcObject = null);
  remoteStreams = {};

  // Redirect to the homepage after hanging up
  window.location.href = 'index.html';
};

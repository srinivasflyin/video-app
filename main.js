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
// const firebaseConfig = {
//   apiKey: "AIzaSyAPs_CgegiTL8V6DOtExxfl9Qz7hOKaqZw",
//   authDomain: "test-firebase-fa21c.firebaseapp.com",
//   projectId: "test-firebase-fa21c",
//   storageBucket: "test-firebase-fa21c.firebasestorage.app",
//   messagingSenderId: "1093304565669",
//   appId: "1:1093304565669:web:c454fcc5651f6436c5324c"
// };

// if (!firebase.apps.length) {
//   firebase.initializeApp(firebaseConfig);
// }
// const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

function setLocalDescriptionSafely(description) {
  console.log("Setting local description:", description, pc.signalingState);
  if (pc.signalingState === 'stable') {
    // It's safe to set an offer in 'stable' state
    pc.setLocalDescription(description)
      .then(() => {
        console.log("Local description set successfully.");
      })
      .catch((error) => {
        console.error(`Error setting local description:${pc.signalingState}`, error);
      });
  } else if (pc.signalingState === 'have-remote-offer' && description.type === 'answer') {
    // It's safe to set an answer if the signaling state is 'have-remote-offer'
    pc.setLocalDescription(description)
      .then(() => {
        console.log("Local answer set successfully.");
      })
      .catch((error) => {
        console.error(`Error setting local answer:${pc.signalingState}`, error);
      });
  } else if (pc.signalingState === 'have-remote-offer' && description.type === 'offer') {
    // Step 1: Set the remote description (offer)
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
  console.log('gggggggggggggggggggggggggggggggggggggggggggggg');
  // Generate a new document reference in the 'calls' collection
  const callDocRef = doc(collection(firestore, 'calls')); // New doc in 'calls' collection
  const offerCandidatesRef = collection(firestore, 'calls', callDocRef.id, 'offerCandidates');
  const answerCandidatesRef = collection(firestore, 'calls', callDocRef.id, 'answerCandidates');

  // Display the call document ID in the input
  callInput.value = callDocRef.id;

  // Get candidates for the caller, save to Firestore
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // Add offer candidate to Firestore
      addDoc(offerCandidatesRef, event.candidate.toJSON());
    }
  };

  // // Create the offer
  // const offerDescription = await pc.createOffer();
  // setLocalDescriptionSafely(offerDescription);

  // const offer = {
  //   sdp: offerDescription.sdp,
  //   type: offerDescription.type,
  // };

  // // Set the offer in Firestore (create the document with offer data)
  // await setDoc(callDocRef, { offer });

  // // Listen for remote answer
  // onSnapshot(callDocRef, (snapshot) => {
  //   const data = snapshot.data();
  //   if (!pc.currentRemoteDescription && data?.answer) {
  //     const answerDescription = new RTCSessionDescription(data.answer);
  //     pc.setRemoteDescription(answerDescription);
  //   }
  // });

  // // When answered, add candidates to the peer connection
  // onSnapshot(answerCandidatesRef, (snapshot) => {
  //   snapshot.docChanges().forEach((change) => {
  //     if (change.type === 'added') {
  //       const candidate = new RTCIceCandidate(change.doc.data());
  //       pc.addIceCandidate(candidate);
  //     }
  //   });
  // });

}


// Initialize Firestore
//const firestore = getFirestore();

answerButton.onclick = async () => {
  const callId = callInput.value;

  // Reference the specific call document
  const callDocRef = doc(firestore, 'calls', callId);
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
  const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
  // Create the offer
  const offerDescription = await pc.createOffer();
  setLocalDescriptionSafely(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

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
    console.log('ggggggggggggggggggggggggggggggggggg');
  // Prepare the answer to send back
  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  // Send the answer back to Peer A through the signaling server
  // await updateDoc(callDocRef, { answer });

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
};


// Function to end the call
hangupButton.onclick = async () => {
  // Stop all local media tracks (audio/video)
  const localStream = pc.getLocalStreams()[0];  // Assuming you have only one local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop()); // Stop all tracks (audio/video)
  }

  // Stop the remote stream (if applicable)
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  // Clear the video elements
  webcamVideo.srcObject = null;
  remoteVideo.srcObject = null;


  // Close the RTCPeerConnection
  if (pc) {
    pc.close();  // Close the peer connection
    console.log("Peer connection closed");
  }

  // Optionally: Close the signaling connection (e.g., WebSocket)
  // signalingSocket.close(); // Uncomment this if you want to close the signaling channel.

  // Optionally: Clean up UI, such as hiding video elements or showing a disconnected message
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo) {
    remoteVideo.srcObject = null;  // Clear the remote video stream
  }

  const localVideo = document.getElementById('localVideo');
  if (localVideo) {
    localVideo.srcObject = null;  // Clear the local video stream
  }

  // Reset signaling state (if needed)
  // You can reset some variables if you want to handle the next call.
  console.log("Call ended and resources cleaned up");

  webcamButton.disabled = false;
}
















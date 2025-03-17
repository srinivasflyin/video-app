import './style.css';

//import firebase from 'firebase/app';
//import 'firebase/firestore';
import {
  doc, setDoc, updateDoc,
  collection, onSnapshot, addDoc,
  getDoc
} from 'firebase/firestore';

//import { collection, doc, onSnapshot, addDoc } from 'firebase/firestore';  // Modular SDK functions
import { firestore } from './firebase.config';
// const firebaseConfig = {
//   apiKey: "AIzaSyAPs_CgegiTL8V6DOtExxfl9Qz7hOKaqZw",
//   authDomain: "test-firebase-fa21c.firebaseapp.com",
//   projectId: "test-firebase-fa21c",
//   storageBucket: "test-firebase-fa21c.firebasestorage.app",
//   messagingSenderId: "1093304565669",
//   appId: "1:1093304565669:web:c454fcc5651f6436c5324c"
// };

// 

//const firestore = firebase.firestore();

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


// Generate random meeting ID
function generateMeetingId() {
  return Math.random().toString(36).substr(2, 9);
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
    console.log('hhhhhhhhhhhhhhhhhhhhhhhhhhhh', event);
    event.streams[0].getTracks().forEach((track) => {
      console.log('track===============');
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer
// callButton.onclick = async () => {
//   // Reference Firestore collections for signaling
//   //const callDoc = firestore.collection('calls').doc();
//   const meetingId = generateMeetingId
//   const callDoc = doc(collection(firestore, 'calls'))
//   console.log('ffffffffffffffffff', callDoc);
//   //const offerCandidates = callDoc.collection('offerCandidates');
//   //const answerCandidates = callDoc.collection('answerCandidates');
//   const answerCandidates = collection(callDoc, 'answerCandidates');
//   //const offerCandidates = collection(callDoc, 'offerCandidates');
//   callInput.value = callDoc.id;

//   // Get candidates for caller, save to db
//   pc.onicecandidate = (event) => {
//     //event.candidate && offerCandidates.add(event.candidate.toJSON());
//     if (event.candidate) {
//       addDoc(collection(doc(firestore, 'calls'), 'offerCandidates'), event.candidate.toJSON());
//     }
//   };

//   // Create offer
//   const offerDescription = await pc.createOffer();
//   //await pc.setLocalDescription(offerDescription);
//   setLocalDescriptionSafely(offerDescription);

//   // const offer = {
//   //   sdp: offerDescription.sdp,
//   //   type: offerDescription.type,
//   // };

//   // await callDoc.set({ offer });
//   // callDoc.setDoc
//   await setDoc(callDoc, {
//     offer: {
//       sdp: offerDescription.sdp,
//       type: offerDescription.type,
//     },
//   });
//   console.log('ppppppppppppppppppppppp');
//   // Listen for remote answer
//   onSnapshot(callDoc, (snapshot) => {
//     const data = snapshot.data();
//     if (!pc.currentRemoteDescription && data?.answer) {
//       const answerDescription = new RTCSessionDescription(data.answer);
//       pc.setRemoteDescription(answerDescription);
//     }
//   });

//   // When answered, add candidate to peer connection
//   onSnapshot(answerCandidates, snapshot => {
//     snapshot.docChanges().forEach((change) => {
//       if (change.type === 'added') {
//         const candidate = new RTCIceCandidate(change.doc.data());
//         pc.addIceCandidate(candidate);
//       }
//     });
//   });

//   //hangupButton.disabled = false;
// };

// 3. Answer the call with the unique ID
// answerButton.onclick = async () => {
//   const callId = callInput.value;
//   const callDoc = firestore.collection('calls').doc(callId);
//   const answerCandidates = callDoc.collection('answerCandidates');
//   const offerCandidates = callDoc.collection('offerCandidates');

//   pc.onicecandidate = (event) => {
//     event.candidate && answerCandidates.add(event.candidate.toJSON());
//   };

//   const callData = (await callDoc.get()).data();

//   const offerDescription = callData.offer;
//   await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

//   const answerDescription = await pc.createAnswer();
//   //await pc.setLocalDescription(answerDescription);
//   setLocalDescriptionSafely(offerDescription);
//   const answer = {
//     type: answerDescription.type,
//     sdp: answerDescription.sdp,
//   };

//   await callDoc.update({ answer });

//   offerCandidates.onSnapshot((snapshot) => {
//     snapshot.docChanges().forEach((change) => {
//       console.log(change);
//       if (change.type === 'added') {
//         let data = change.doc.data();
//         pc.addIceCandidate(new RTCIceCandidate(data));
//       }
//     });
//   });
// };

answerButton.onclick = async () => {
  const callId = callInput.value;
  //const callDoc = firestore.collection('calls').doc(callId);
  //const answerCandidates = callDoc.collection('answerCandidates');
  //const offerCandidates = callDoc.collection('offerCandidates');


  const callDoc = doc(firestore, 'calls', callId);
  //const callDocRef = doc(firestore, 'calls', meetingId);
  //const offerCandidates = callDoc.collection('offerCandidates');
  //const answerCandidates = callDoc.collection('answerCandidates');
  const answerCandidates = collection(callDoc, 'answerCandidates');
  const offerCandidates = collection(callDoc, 'offerCandidates');
  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

 // const callData = (await callDoc.get()).data();
  const callDocSnapshot = await getDoc(callDoc); // Fetch the document snapshot
  const callData = callDocSnapshot.data(); // Get the document data
  const offerDescription = callData.offer;

  // Set the remote description (the offer) to establish the connection
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  // Create an answer
  const answerDescription = await pc.createAnswer();
  // Set the local description (the answer) and send it back to Peer A
  setLocalDescriptionSafely(answerDescription);

  // Send the answer to the signaling server
  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  // Send the answer back to Peer A through the signaling server
  //callDoc.update({ answer: answer });
  await updateDoc(callDoc, {
    answer: {
        sdp: answer.sdp,
        type: answer.type,
    },
});

onSnapshot(offerCandidates, (snapshot) => {

    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }

    });

  });
  // Listen for remote stream after connection is established
  pc.ontrack = (event) => {
    // Assuming the remote video element is <video id="remoteVideo">
    const remoteVideo = document.getElementById('remoteVideo');
    // Attach the remote stream to the video element
    remoteVideo.srcObject = event.streams[0];
  };
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


// Function to safely set the local description (answer)
// async function setLocalDescriptionSafely(answerDescription) {
//   try {
//     await pc.setLocalDescription(answerDescription);
//   } catch (error) {
//     console.error('Error setting local description:', error);
//   }
// }
















// // 1. Setup signaling server mock (simplified version for demonstration)
// const signalingServer = {
//   sendOffer(offer) {
//     // Simulate sending the offer to Peer B
//     console.log('Offer sent:', offer);
//     setTimeout(() => {
//       signalingServer.on('offerReceived', offer); // Simulate Peer B receiving the offer
//     }, 1000);
//   },

//   sendAnswer(answer) {
//     // Simulate sending the answer to Peer A
//     console.log('Answer sent:', answer);
//     setTimeout(() => {
//       signalingServer.on('answerReceived', answer); // Simulate Peer A receiving the answer
//     }, 1000);
//   },

//   on(event, data) {
//     if (event === 'offerReceived') {
//       console.log('Peer B received offer:', data);
//       if (data && data.type && data.sdp) {
//         peerConnectionB.setRemoteDescription(new RTCSessionDescription(data))
//           .then(() => peerConnectionB.createAnswer())
//           .then(answer => {
//             peerConnectionB.setLocalDescription(answer);
//             signalingServer.sendAnswer(answer);
//           })
//           .catch(error => console.error('Error processing offer on Peer B:', error));
//       }
//     }

//     if (event === 'answerReceived') {
//       console.log('Peer A received answer:', data);
//       if (data && data.type && data.sdp) {
//         peerConnectionA.setRemoteDescription(new RTCSessionDescription(data))
//           .catch(error => console.error('Failed to set remote description on Peer A:', error));
//       }
//     }
//   }
// };

// // 2. RTCPeerConnection configuration with ICE server settings and iceCandidatePoolSize
// const peerConnectionConfig = {
//   iceServers: [
//     { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }, // Google's public STUN servers
//   ],
//   iceCandidatePoolSize: 10, // Number of ICE candidates to keep in the pool
// };

// // Create RTCPeerConnections for Peer A and Peer B
// const peerConnectionA = new RTCPeerConnection(peerConnectionConfig);
// const peerConnectionB = new RTCPeerConnection(peerConnectionConfig);

// // 3. Handle ICE candidates for both peers
// peerConnectionA.onicecandidate = (event) => {
//   if (event.candidate) {
//     console.log('Peer A - New ICE Candidate:', event.candidate);
//     // Send the ICE candidate to Peer B (via signaling)
//   } else {
//     console.log('Peer A - All ICE candidates have been gathered');
//   }
// };

// peerConnectionB.onicecandidate = (event) => {
//   if (event.candidate) {
//     console.log('Peer B - New ICE Candidate:', event.candidate);
//     // Send the ICE candidate to Peer A (via signaling)
//   } else {
//     console.log('Peer B - All ICE candidates have been gathered');
//   }
// };

// // 4. Handle UI buttons
// document.getElementById('startOffer').onclick = () => {
//   // Peer A creates an offer and sends it
//   peerConnectionA.createOffer()
//     .then(offer => {
//       return peerConnectionA.setLocalDescription(offer);
//     })
//     .then(() => {
//       signalingServer.sendOffer(peerConnectionA.localDescription); // Send offer to Peer B
//       document.getElementById('status').textContent = 'Offer sent, waiting for answer from Peer B...';
//     })
//     .catch(error => {
//       console.error('Error creating offer:', error);
//     });
// };

// document.getElementById('startAnswer').onclick = () => {
//   // Peer B will start responding to the offer (only enabled after the offer is received)
//   document.getElementById('status').textContent = 'Peer B is responding...';
// };

// // 5. Handle Peer B's response to the offer
// signalingServer.on('offerReceived', (offer) => {
//   console.log('Peer B received offer:', offer);

//   // Set the offer from Peer A as the remote description for Peer B
//   peerConnectionB.setRemoteDescription(new RTCSessionDescription(offer))
//     .then(() => peerConnectionB.createAnswer())
//     .then(answer => {
//       return peerConnectionB.setLocalDescription(answer);
//     })
//     .then(() => {
//       signalingServer.sendAnswer(peerConnectionB.localDescription); // Send answer back to Peer A
//       document.getElementById('startAnswer').disabled = true;
//     })
//     .catch(error => {
//       console.error('Error processing the offer on Peer B:', error);
//     });
// });

// // 6. Handle Peer A receiving the answer
// signalingServer.on('answerReceived', (answer) => {
//   console.log('Peer A received answer:', answer);
//   peerConnectionA.setRemoteDescription(new RTCSessionDescription(answer))
//     .then(() => {
//       document.getElementById('status').textContent = 'Connection established!';
//     })
//     .catch(error => {
//       console.error('Failed to set remote description on Peer A:', error);
//     });
// });

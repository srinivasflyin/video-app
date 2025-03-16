import './style.css';

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

// Global State
const pc = new RTCPeerConnection(servers);
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

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  //await pc.setLocalDescription(offerDescription);
  setLocalDescriptionSafely(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  //await pc.setLocalDescription(answerDescription);
  setLocalDescriptionSafely(offerDescription);
  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};















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

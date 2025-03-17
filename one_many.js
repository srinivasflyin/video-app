// Import Firebase functions
import { collection, doc, setDoc, updateDoc, addDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from './firebase.config';

// DOM elements
const broadcasterNameInput = document.getElementById('broadcasterName');
const viewerNameInput = document.getElementById('viewerName');
const localVideo = document.getElementById('localVideo');
const startBroadcastButton = document.getElementById('startBroadcastButton');
const joinBroadcastButton = document.getElementById('joinBroadcastButton');
const callIdInput = document.getElementById('callIdInput');
const localStreamContainer = document.getElementById('localStreamContainer');
const remoteStreamsContainer = document.getElementById('remoteStreams');
const broadcasterNameDisplay = document.getElementById('broadcasterNameDisplay');
const callIdDisplay = document.getElementById('callIdDisplay');
const remoteVideosContainer = document.getElementById('remoteVideos');

// Global variables
let localStream;
let callId = ''; // Generate a unique call ID for the broadcaster

// Enable "Start Broadcast" button when the broadcaster enters a name
broadcasterNameInput.oninput = () => {
    callIdDisplay.style.display = broadcasterNameInput.value ? 'block' : 'none';
    startBroadcastButton.disabled = !broadcasterNameInput.value;
};

// Enable "Join Broadcast" button when the viewer enters a name and call ID
viewerNameInput.oninput = () => {
    joinBroadcastButton.disabled = !(viewerNameInput.value && callIdInput.value);
};
callIdInput.oninput = () => {
    joinBroadcastButton.disabled = !(viewerNameInput.value && callIdInput.value);
};

// Hide local video stream until the broadcast starts
localStreamContainer.style.display = 'none';
callIdDisplay.style.display = 'none';

// Generate a unique call ID
function generateUniqueCallId() {
    return Math.random().toString(36).substr(2, 9); // Generate a random 9-character call ID
}

// Broadcaster (Host) starts the broadcast
async function startBroadcast() {
    const broadcasterName = broadcasterNameInput.value;
    if (!broadcasterName) return;

    callId = generateUniqueCallId(); // Generate a new unique call ID for each broadcast
    const callDocRef = doc(firestore, 'calls', callId);

    try {
        broadcasterNameDisplay.innerText = broadcasterName;
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localStreamContainer.style.display = 'block'; // Show video container
        callIdDisplay.innerText = callId; // Display the unique call ID for viewers to join
        callIdDisplay.style.display = 'block';
        console.log("Broadcast started with Call ID:", callId);

        // Add the name of the broadcaster and an empty offer to Firestore
        await setDoc(callDocRef, {
            broadcasterName,
            viewerIds: [],
            offer: null
        });

        // Create and send the WebRTC offer
        const peerConnection = new RTCPeerConnection();
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        // Save the WebRTC offer in Firestore
        await updateDoc(callDocRef, {
            offer: {
                sdp: offerDescription.sdp,
                type: offerDescription.type,
            }
        });

        // Listen for viewers joining
        listenForViewers(peerConnection);

    } catch (error) {
        console.error("Error starting broadcast:", error);
    }
}

startBroadcastButton.onclick = startBroadcast;

// Listener for viewers joining
function listenForViewers(peerConnection) {
    const callDocRef = doc(firestore, 'calls', callId);
    const offerCandidatesRef = collection(callDocRef, 'offerCandidates');

    onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (data) {
            if (data.broadcasterName) {
                broadcasterNameDisplay.innerText = data.broadcasterName;
            }

            // Listen for ICE candidates from viewers
            onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate);
                    }
                });
            });
        }
    });
}

// Viewer (Remote participant) joins the broadcast
async function joinBroadcast() {
    const viewerName = viewerNameInput.value;
    const enteredCallId = callIdInput.value;

    if (!enteredCallId || !viewerName) {
        alert('Please enter a valid Call ID and your name.');
        return;
    }

    if (enteredCallId === callId) {
        alert('You cannot join your own broadcast as a viewer.');
        return;
    }

    const callDocRef = doc(firestore, 'calls', enteredCallId);
    const callDocSnapshot = await getDoc(callDocRef);

    if (!callDocSnapshot.exists()) {
        alert('Invalid Call ID. Please enter a valid Call ID.');
        return;
    }

    const callData = callDocSnapshot.data();

    // Create the peer connection for the viewer
    const peerConnection = new RTCPeerConnection();

    peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = remoteStream;
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;
        remoteVideosContainer.appendChild(remoteVideo);
    };

    // Handle WebRTC offer from broadcaster
    if (callData.offer) {
        const offerDescription = new RTCSessionDescription(callData.offer);
        await peerConnection.setRemoteDescription(offerDescription);

        const answerDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerDescription);

        // Save the WebRTC answer in Firestore
        await updateDoc(callDocRef, {
            answer: {
                sdp: answerDescription.sdp,
                type: answerDescription.type,
            },
            viewerName
        });
    }

    const answerCandidatesRef = collection(callDocRef, 'answerCandidates');

    // Send ICE candidates to Firestore
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(answerCandidatesRef, event.candidate.toJSON());
        }
    };

    // Listen for ICE candidates from the broadcaster
    const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
    onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    });
}

joinBroadcastButton.onclick = joinBroadcast;

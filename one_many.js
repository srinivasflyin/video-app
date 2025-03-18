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

callIdDisplay.style.display = 'none';
localStreamContainer.style.display = 'none';

// Generate a unique call ID
function generateUniqueCallId() {
    return Math.random().toString(36).substr(2, 9); // Generate a random 9-character call ID
}


// Example of calling createOffer and setting local description (this triggers candidate gathering)
async function createOffer() {
    try {
        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        console.log('Created offer and set local description.');

        // Optional: Log the local description
        console.log('Local Description: ', peerConnection.localDescription);
    } catch (error) {
        console.error('Error creating offer: ', error);
    }
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
        // Create the peer connection for the viewer
        // Monitor ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state change: ', peerConnection.iceConnectionState);

            // Check for specific ICE connection states
            if (peerConnection.iceConnectionState === 'failed') {
                console.error('ICE connection failed. Attempting to reconnect...');
                // Handle reconnection logic if needed or alert the user
            }
            else if (peerConnection.iceConnectionState === 'connected') {
                console.log('ICE connection established successfully');
            }
        };

        // Handle ICE candidates (for the viewer)
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate: ', event.candidate);
                // If you're sending it somewhere like Firestore:
                addDoc(answerCandidatesRef, event.candidate.toJSON());
            } else {
                console.log('All ICE candidates have been gathered.');
            }
        };

        // Call this function to start the process
        createOffer(peerConnection);

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // const offerDescription = await peerConnection.createOffer();
        // await peerConnection.setLocalDescription(offerDescription);

        // Save the WebRTC offer in Firestore
        await updateDoc(callDocRef, {
            offer: {
                sdp: offerDescription.sdp,
                type: offerDescription.type,
            }
        });
              console.log('updddddddddddddddddddddddddd');
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
    
    // First, listen for the call document changes
    onSnapshot(callDocRef, async (snapshot) => {
        console.log('callDocRef data:', snapshot.data());
        const data = snapshot.data();

        if (data) {
            if (data.broadcasterName) {
                broadcasterNameDisplay.innerText = data.broadcasterName;
            }

            // If we haven't already attached the ICE candidates listener, do it now
            // You only need to do this once, so check if it's already set
            if (!window.iceCandidatesListenerSet) {
                window.iceCandidatesListenerSet = true;

                onSnapshot(offerCandidatesRef, (snapshot) => {
                    console.log('ICE candidate changes:', snapshot.docChanges());
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const candidate = new RTCIceCandidate(change.doc.data());
                            peerConnection.addIceCandidate(candidate);
                        }
                    });
                });
            }
        }
    });
}



async function createOffer(peerConnection) {
    try {
        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);

        console.log('Created offer and set local description.');

        // Optional: Log the local description
        console.log('Local Description: ', peerConnection.localDescription);
    } catch (error) {
        console.error('Error creating offer: ', error);
    }
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
    console.log('callDataffffffffffff', callData);
    // Create the peer connection for the viewer
    const peerConnection = new RTCPeerConnection();

    // Monitor ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state change: ', peerConnection.iceConnectionState);

        // Check for specific ICE connection states
        if (peerConnection.iceConnectionState === 'failed') {
            console.error('ICE connection failed. Attempting to reconnect...');
            // Handle reconnection logic if needed or alert the user
        }
        else if (peerConnection.iceConnectionState === 'connected') {
            console.log('ICE connection established successfully');
        }
    };

    // Handle ICE candidates (for the viewer)
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('New ICE candidate: ', event.candidate);
            // If you're sending it somewhere like Firestore:
            addDoc(answerCandidatesRef, event.candidate.toJSON());
        } else {
            console.log('All ICE candidates have been gathered.');
        }
    };

    // Example of calling createOffer and setting local description (this triggers candidate gathering)

    // Call this function to start the process
    createOffer(peerConnection);

    // Handle the viewer's local stream (even if they are just watching)
    let localViewerStream;
    try {
        localViewerStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localViewerVideo = document.createElement('video');
        localViewerVideo.srcObject = localViewerStream;
        localViewerVideo.autoplay = true;
        localViewerVideo.playsInline = true;
        remoteVideosContainer.appendChild(localViewerVideo); // Add to remoteVideosContainer
    } catch (error) {
        console.error('Error accessing viewer local stream:', error);
    }

    peerConnection.ontrack = (event) => {
        console.log('000000000000000000000000000000000000000000000');
        const remoteStream = event.streams[0];
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = remoteStream;
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;

        // Only add the remote video once
        if (!remoteVideosContainer.querySelector(`video[data-remote-id="${event.streams[0].id}"]`)) {
            remoteVideo.setAttribute('data-remote-id', event.streams[0].id);
            remoteVideosContainer.appendChild(remoteVideo); // Add remote stream to UI
        }
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

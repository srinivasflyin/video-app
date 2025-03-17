//import { initializeApp, getApp, getApps } from 'firebase/app';
import { setDoc, collection, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { firestore } from './firebase.config';
import toastr from 'toastr';
import 'toastr/build/toastr.min.css'; // Import Toastr's CSS
//import './style.css';

// Firebase setup
// const firebaseConfig = {
//   apiKey: "AIzaSyAPs_CgegiTL8V6DOtExxfl9Qz7hOKaqZw",
//   authDomain: "test-firebase-fa21c.firebaseapp.com",
//   projectId: "test-firebase-fa21c",
//   storageBucket: "test-firebase-fa21c.firebasestorage.app",
//   messagingSenderId: "1093304565669",
//   appId: "1:1093304565669:web:c454fcc5651f6436c5324c"
// };


// if (!apps.length) {
//     initializeApp(firebaseConfig);
//   }
//   const firestore = firestore();

// Initialize Firebase app if it's not already initialized
// const firebaseApp = getApps().length
//   ? getApp() // Get the already initialized app
//   : initializeApp(firebaseConfig); // Initialize a new app
// // Get Firestore instance

// const firestore = getFirestore(firebaseApp);
// function showToast(message, type = 'success') {
//     // Display the toaster notification
//     toastr[type](message);
// }

// A flag to ensure that only one toast message is shown at a time
let isToastVisible = false;

function showToast(message, type = 'success', closeDuration = 5000) {
    console.log('closeDuration', closeDuration);
    // Only show a new toast if one isn't already visible
    if (!isToastVisible) {
        // Mark the toast as visible
        isToastVisible = true;

        // Toastr options including the close button and duration
        const toastrOptions = {
            //closeButton: true,          // Show the close button
            //timeOut: closeDuration,     // The duration before the toast is dismissed (in ms)
            extendedTimeOut: closeDuration, // Time for the toast to stay visible when hovering
            progressBar: false,          // Show progress bar (optional)
            positionClass: 'toast-top-right', // Position where the toast appears
            onHidden: function () {
                isToastVisible = false;
            }
        };

        // Show the toaster message with the given options
        toastr[type](message, '', toastrOptions);

        // After the toast is dismissed (by default, after the timeout), reset the flag
        setTimeout(() => {
            isToastVisible = false;
        }, closeDuration);
    }
}


// Elements
const createMeetingButton = document.getElementById("createMeetingButton");
const joinMeetingButton = document.getElementById("joinMeetingButton");
const meetingIdInput = document.getElementById("meetingIdInput");
const messageDivElement = document.getElementById('message');
// Create meeting logic
createMeetingButton.onclick = async () => {
    const meetingId = generateMeetingId();
    localStorage.setItem("meetingId", meetingId);
    console.log('gggggggggggggg', window.location.href);
    `Meeting created with ID: ${meetingId}
Meeting Link: ${window.location.href}meeting.html?meetingId=${meetingId}`;
    //     alert(`Meeting created with ID: ${meetingId}
    // Meeting Link: ${window.location.href}meeting.html?meetingId=${meetingId}`);

    //     showToast(`<span style="color: green;">Meeting ID:</span> <span style="color: blue;">${meetingId}</span>
    // <span style="color: green;"><br/>Meeting Link:</span> <span style="color: blue;">${window.location.href}meeting.html?meetingId=${meetingId}</span>`,'success', 50000);
    // messageDivElement.innerHTML = `<div><span style="color: green;">Meeting ID:</span> <span style="color: blue;">${meetingId}</span></div>
    // <div><span style="color: green;"><br/>Meeting Link:</span> <span style="color: blue;">${window.location.href}meeting.html?meetingId=${meetingId}</span></div>`;
    messageDivElement.innerHTML = `
  <div style="text-align: left;">
  <span id='meetingTitle'>Meeting ID:</span> <span id='meetingText'>${meetingId}</span>
 </div>
 <div style="text-align: left;">
 <span style="white-space: nowrap;">
 <span id='meetingTitle'>Meeting Link:</span><span id='meetingText'> ${window.location.href}meeting.html?meetingId=${meetingId}</span>
</div>
`
    // Create a new document in Firestore for the meeting
    //const callDoc = collection(doc(firestore, 'calls', meetingId));
    const callDoc = doc(firestore, 'calls', meetingId);
    //await callDoc.set({});
    // Set an empty document
    await setDoc(callDoc, {});
    // Redirect to meeting page
    //window.location.href = `meeting.html?meetingId=${meetingId}`;
};

// Join meeting logic
joinMeetingButton.onclick = async () => {
    const meetingId = meetingIdInput.value;
    if (meetingId) {
        localStorage.setItem("meetingId", meetingId);

        // Generate unique participantId for the participant joining the meeting
        const participantId = generateParticipantId(meetingId);

        // Save the participant's participantId in Firestore (optional)
        //   const meetingDocRef = collection('calls').doc(meetingId);
        //   const participantsCollectionRef = meetingDocRef.collection('participants');
        //   await participantsCollectionRef.doc(participantId).set({
        //     joinedAt: FieldValue.serverTimestamp(),
        //     status: 'joined', // Optional: you can maintain participant status (e.g., 'joined', 'left', etc.)

        //   });
        // Get the Firestore instance
        //const db = getFirestore();

        // Get a reference to the meeting document and participants collection
        // const meetingDocRef = doc(firestore, 'calls', meetingId);

        // Get a reference to the meeting document
        const meetingDocRef = doc(firestore, 'calls', meetingId);

        // Check if the meeting document exists
        const snapshot = await getDoc(meetingDocRef);

        if (snapshot.exists()) {
            // Document exists
            console.log('Meeting document is available');
        } else {
            // Document does not exist
            console.log('Meeting document does not exist');
            //alert(`Meeting ID: ${meetingId} is not available`);
            showToast(`Meeting ID: ${meetingId} is not available`, 'error', 1000);
            return;
        }

        const participantsCollectionRef = collection(meetingDocRef, 'participants');

        // Set data for the participant
        await setDoc(doc(participantsCollectionRef, participantId), {
            joinedAt: serverTimestamp(),
            status: 'joined', // Optional: you can maintain participant status (e.g., 'joined', 'left', etc.)
        });


        // Redirect to meeting page with the generated participantId
        window.location.href = `meeting.html?meetingId=${meetingId}`;
    } else {
        //alert("Please enter a valid meeting ID.");
        showToast("Please enter a valid meeting ID.", 'error', 1000);
    }
};

// Generate random meeting ID
function generateMeetingId() {
    return Math.random().toString(36).substr(2, 9);
}

// Generate a unique participantId for each participant
function generateParticipantId(meetingId) {
    const timestamp = Date.now(); // Use timestamp to ensure uniqueness
    const randomString = Math.random().toString(36).substr(2, 9); // Generate random string
    return `${meetingId}-${timestamp}-${randomString}`; // Concatenate meetingId with timestamp and random string for uniqueness
}

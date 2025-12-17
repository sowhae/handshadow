// Elements
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const hintIcon = document.getElementById('hint-icon');
const gestureIcons = document.getElementById('gesture-icons');
const puppetImage = document.getElementById('puppet-image');
const puppetVideo = document.getElementById('puppet-video');
const loading = document.getElementById('loading');

// Gesture state
let currentGesture = null;
let gestureHoldStart = null;
let isAnimationPlaying = false;
const HOLD_DURATION = 2000; // 2 seconds to trigger animation

// Gesture smoothing to reduce glitchiness
let lastDetectedGesture = null;
let gestureConfirmCount = 0;
const CONFIRMATION_FRAMES = 1; // Need 1 frame to confirm gesture change (instant response)

// Gesture assets mapping
const GESTURES = {
    wolf: {
        image: 'ixp gestures/wolf1.PNG',
        video: 'ixp gestures/wolf move.mp4',
        cssAnimation: false
    },
    butterfly: {
        image: 'ixp gestures/butterfly1.PNG',
        video: 'ixp gestures/butterfly move.mp4',
        cssAnimation: false
    },
    rabbit: {
        image: 'ixp gestures/rabbit1.PNG',
        video: 'ixp gestures/rabbit move.mp4',
        cssAnimation: false
    },
    elephant: {
        image: 'ixp gestures/elephant1.PNG',
        video: 'ixp gestures/elephant move.mp4',
        cssAnimation: false
    }
};

// Hint icon toggle
let hintsVisible = false;
hintIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHints();
});

// Close gesture icons when clicked anywhere on screen
document.addEventListener('click', (e) => {
    // If gesture icons are visible and click is not on hint icon, hide them
    if (hintsVisible && !hintIcon.contains(e.target)) {
        hideHints();
    }
});

function toggleHints() {
    if (hintsVisible) {
        hideHints();
    } else {
        showHints();
    }
}

function showHints() {
    gestureIcons.classList.remove('hidden');
    hintsVisible = true;
}

function hideHints() {
    gestureIcons.classList.add('hidden');
    hintsVisible = false;
}

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.3,
    minTrackingConfidence: 0.3
});

hands.onResults(onHandResults);

// Start camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 1280, height: 720 }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            loading.classList.add('hidden');
        };
    } catch (err) {
        console.error('Error accessing camera:', err);
        loading.textContent = 'Error: Camera access denied';
    }
}

// Process hand results
function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const handedness = results.multiHandedness[0].label; // 'Left' or 'Right'

        console.log('Hand detected!'); // Debug log

        // Recognize gesture
        const detectedGesture = recognizeGesture(landmarks, handedness);

        if (detectedGesture) {
            console.log('Gesture detected:', detectedGesture); // Debug log
            handleGestureDetected(detectedGesture);
        } else {
            handleNoGesture();
        }
    } else {
        handleNoGesture();
    }
}

// Gesture recognition based on hand landmarks
function recognizeGesture(landmarks, handedness) {
    // Analyze hand shape to determine gesture
    const fingers = getFingersState(landmarks);
    const palmOrientation = getPalmOrientation(landmarks);
    const handShape = getHandShape(landmarks);

    // Rabbit: Two fingers up (index and middle) - peace sign/bunny ears
    if (fingers.index && fingers.middle) {
        return 'rabbit';
    }

    // Wolf: Pinch position (thumb and index close together, forming circle)
    const thumbIndexDistance = getThumbIndexDistance(landmarks);
    if (thumbIndexDistance < 0.08) { // More lenient distance
        return 'wolf';
    }

    // Elephant: Hand pointing down like trunk (all fingers pointing down)
    const handPointingDown = isHandPointingDown(landmarks);
    if (handPointingDown) {
        return 'elephant';
    }

    // Butterfly: Open palm facing camera (all fingers extended and spread)
    if (fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
        return 'butterfly';
    }

    return null;
}

// Helper: Determine which fingers are extended
function getFingersState(landmarks) {
    const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
    const pips = [6, 10, 14, 18];

    // Very lenient detection with large buffer
    const buffer = 0.05;

    const fingers = {
        thumb: landmarks[4].y < landmarks[3].y + buffer, // Thumb up (very lenient)
        index: landmarks[8].y < landmarks[6].y + buffer, // Index extended (very lenient)
        middle: landmarks[12].y < landmarks[10].y + buffer, // Middle extended (very lenient)
        ring: landmarks[16].y < landmarks[14].y + buffer, // Ring extended (very lenient)
        pinky: landmarks[20].y < landmarks[18].y + buffer // Pinky extended (very lenient)
    };

    return fingers;
}

// Helper: Get palm orientation
function getPalmOrientation(landmarks) {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];

    return {
        dx: middleMcp.x - wrist.x,
        dy: middleMcp.y - wrist.y
    };
}

// Helper: Get hand shape metrics
function getHandShape(landmarks) {
    const wrist = landmarks[0];
    const middleTip = landmarks[12];

    const palmLength = Math.sqrt(
        Math.pow(middleTip.x - wrist.x, 2) +
        Math.pow(middleTip.y - wrist.y, 2)
    );

    return { palmLength };
}

// Helper: Get finger spread
function getFingersSpread(landmarks) {
    const indexTip = landmarks[8];
    const pinkyTip = landmarks[20];

    const spread = Math.sqrt(
        Math.pow(pinkyTip.x - indexTip.x, 2) +
        Math.pow(pinkyTip.y - indexTip.y, 2)
    );

    return spread;
}

// Helper: Get distance between thumb and index finger
function getThumbIndexDistance(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const distance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2)
    );

    return distance;
}

// Helper: Check if hand is pointing down (for elephant trunk)
function isHandPointingDown(landmarks) {
    const wrist = landmarks[0];
    const middleTip = landmarks[12];

    // Check if fingers are pointing down (middle finger tip below wrist)
    const pointingDown = middleTip.y > wrist.y + 0.05; // More lenient

    return pointingDown;
}

// Handle detected gesture with smoothing
function handleGestureDetected(gesture) {
    // Smooth gesture detection - require multiple consecutive frames
    if (gesture !== lastDetectedGesture) {
        lastDetectedGesture = gesture;
        gestureConfirmCount = 1;
        return; // Don't change yet, wait for confirmation
    } else {
        gestureConfirmCount++;

        // Only change gesture after confirmation frames
        if (gestureConfirmCount < CONFIRMATION_FRAMES) {
            return;
        }
    }

    // Gesture confirmed
    if (gesture !== currentGesture) {
        // New gesture detected and confirmed
        currentGesture = gesture;
        gestureHoldStart = Date.now();
        isAnimationPlaying = false;
        showPuppetImage(gesture);
    } else {
        // Same gesture held
        const holdTime = Date.now() - gestureHoldStart;

        if (holdTime > HOLD_DURATION && !isAnimationPlaying) {
            // Play animation
            playPuppetAnimation(gesture);
        }
    }
}

// Handle no gesture detected
function handleNoGesture() {
    // Reset smoothing
    lastDetectedGesture = null;
    gestureConfirmCount = 0;

    // Only hide if we had a gesture before
    if (currentGesture !== null) {
        currentGesture = null;
        gestureHoldStart = null;
        isAnimationPlaying = false;
        hidePuppet();
    }
}

// Show puppet static image
function showPuppetImage(gesture) {
    puppetVideo.classList.add('hidden');
    puppetVideo.pause();

    // Remove all animation classes
    puppetImage.className = '';

    puppetImage.src = GESTURES[gesture].image;
    puppetImage.classList.remove('hidden');
}

// Play puppet animation
function playPuppetAnimation(gesture) {
    isAnimationPlaying = true;

    const gestureData = GESTURES[gesture];

    if (gestureData.cssAnimation) {
        // Use CSS animation
        puppetVideo.classList.add('hidden');
        puppetVideo.pause();

        puppetImage.className = '';
        puppetImage.src = gestureData.image;
        puppetImage.classList.remove('hidden');
        puppetImage.classList.add(`animate-${gesture}`);
    } else if (gestureData.video) {
        // Use video
        puppetImage.classList.add('hidden');

        puppetVideo.src = gestureData.video;
        puppetVideo.classList.remove('hidden');
        puppetVideo.play();
    }
}

// Hide puppet
function hidePuppet() {
    puppetImage.className = 'hidden';
    puppetVideo.classList.add('hidden');
    puppetVideo.pause();
}

// Camera loop
async function cameraLoop() {
    await hands.send({ image: video });
    requestAnimationFrame(cameraLoop);
}

// Initialize
async function init() {
    await startCamera();
    cameraLoop();
}

// Start when page loads
init();

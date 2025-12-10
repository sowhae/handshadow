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
const CONFIRMATION_FRAMES = 3; // Need 3 consecutive frames to confirm gesture change

// Gesture assets mapping
const GESTURES = {
    wolf: {
        image: 'ixp gestures/wolf.PNG',
        video: null, // Use CSS animation instead
        cssAnimation: true
    },
    butterfly: {
        image: 'ixp gestures/butterfly.PNG',
        video: null, // Use CSS animation instead
        cssAnimation: true
    },
    rabbit: {
        image: 'ixp gestures/rabbit.PNG',
        video: 'ixp gestures/rabbit move.mp4',
        cssAnimation: false
    },
    elephant: {
        image: 'ixp gestures/elephant.PNG',
        video: null, // Use CSS animation instead
        cssAnimation: true
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
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
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

        // Recognize gesture
        const detectedGesture = recognizeGesture(landmarks, handedness);

        if (detectedGesture) {
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

    // Wolf: Index and pinky extended, others folded (like rock horns)
    if (fingers.index && fingers.pinky && !fingers.middle && !fingers.ring && !fingers.thumb) {
        return 'wolf';
    }

    // Butterfly: Both hands would be needed, but for single hand - thumbs up with fingers spread
    if (fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
        const spread = getFingersSpread(landmarks);
        if (spread > 0.15) { // Fingers well spread
            return 'butterfly';
        }
    }

    // Rabbit: Index and middle extended, others folded (peace sign / bunny ears)
    if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky && !fingers.thumb) {
        return 'rabbit';
    }

    // Elephant: Fist with thumb between index and middle (elephant trunk)
    if (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
        const thumbPos = getThumbPosition(landmarks);
        if (thumbPos === 'extended') {
            return 'elephant';
        }
    }

    return null;
}

// Helper: Determine which fingers are extended
function getFingersState(landmarks) {
    const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
    const pips = [6, 10, 14, 18];

    const fingers = {
        thumb: landmarks[4].y < landmarks[3].y, // Thumb up
        index: landmarks[8].y < landmarks[6].y, // Index extended
        middle: landmarks[12].y < landmarks[10].y, // Middle extended
        ring: landmarks[16].y < landmarks[14].y, // Ring extended
        pinky: landmarks[20].y < landmarks[18].y // Pinky extended
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

// Helper: Get thumb position
function getThumbPosition(landmarks) {
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    const indexBase = landmarks[5];

    const distFromPalm = Math.abs(thumbTip.x - indexBase.x);

    if (distFromPalm > 0.1) {
        return 'extended';
    }
    return 'folded';
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

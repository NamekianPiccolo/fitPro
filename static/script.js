// 1. DOM Elements & State Initialization
// -------------------------------------------------------------------------
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

// UI Badges & Statuses
const webcamStatusDot = document.querySelector('#webcam-status .status-dot');
const webcamStatusText = document.querySelector('#webcam-status .status-text');

// Overlays
const videoPlaceholder = document.getElementById('video-placeholder');
const loadingSpinner = document.getElementById('loading-spinner');
const calibrationOverlay = document.getElementById('calibration-overlay');
const calibShoulders = document.getElementById('calib-shoulders');
const calibHips = document.getElementById('calib-hips');
const calibKnees = document.getElementById('calib-knees');
const calibAnkles = document.getElementById('calib-ankles');

// Controls
const btnStartCamera = document.getElementById('btn-start-camera');
const btnStopCamera = document.getElementById('btn-stop-camera');
const btnToggleSkeleton = document.getElementById('btn-toggle-skeleton');
const btnResetReps = document.getElementById('btn-reset-reps');

// Metrics
const predictedLabel = document.getElementById('predicted-label');
const confidenceText = document.getElementById('confidence-text');
const confidenceBar = document.getElementById('prediction-confidence-bar');
const confidenceRingBar = document.getElementById('confidence-bar');
const activeSideText = document.getElementById('active-side');
const repCounterText = document.getElementById('rep-counter');
const repStateText = document.getElementById('rep-state');
const formQualityText = document.getElementById('form-quality');
const spineStatusText = document.getElementById('spine-status');
const spineBarFill = document.getElementById('bar-spine');
const spineValueText = document.getElementById('val-spine');

// Form Feedback List
const formFeedbackList = document.getElementById('form-feedback-list');

// Application State Variables
let cameraActive = false;
let showSkeleton = true;
let cameraInstance = null;

// Repetition Counting State
let repCount = 0;
let repStage = 'up'; // 'up' or 'down' for squats/pushups, 'close' or 'open' for jacks
let activeExercise = 'None';
let currentRepIsGood = true;
let trainingMode = 'Squats'; // 'Squats', 'Push Ups'

// Strict quality tracking variables
let minKneeAngle = 180;
let minElbowAngle = 180;
let minHipAngle = 180;
let minSpineAngle = 180; // Untuk squat: deteksi lower back rounding
let maxShoulderAngle = 0;
let maxElbowAngle = 0;
let hasReachedDepth = false;
let hasReachedPeak = false;

// Camera Positioning Guide Elements
const cameraGuide = document.getElementById('camera-guide');
const guideText = document.getElementById('guide-text');

// Throttle ML Predictions to prevent overloading backend (5 times per second)
let lastPredictionTime = 0;
const PREDICTION_INTERVAL = 200; // ms

// Initialize Canvas Dimensions on window resize
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// -------------------------------------------------------------------------
// Audio Unlock (WAJIB untuk Android WebView)
// Android memblokir audio sampai ada user gesture pertama kali
// -------------------------------------------------------------------------
let _audioUnlocked = false;

function unlockAudio() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;

    console.log('[FitAI] Unlocking audio for mobile...');

    // 1. Unlock Web Audio API (AudioContext)
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const buf = audioCtx.createBuffer(1, 1, 22050);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.start(0);
    } catch (e) {
        console.warn('[FitAI] AudioContext unlock warning:', e);
    }

    // 2. Unlock HTML5 Audio element (#tts-audio)
    const tts = document.getElementById('tts-audio');
    if (tts) {
        try {
            // Play a brief silent sound to allow future programmatic playback
            tts.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
            tts.play().then(() => {
                tts.pause();
                console.log('[FitAI] HTML5 tts-audio element unlocked successfully');
            }).catch(e => {
                console.warn('[FitAI] HTML5 tts-audio element unlock failed:', e);
            });
        } catch (e) {
            console.warn('[FitAI] HTML5 tts-audio exception:', e);
        }
    }

    // 3. Unlock Web Speech API (speechSynthesis)
    if (window.speechSynthesis) {
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            u.lang = 'id-ID';
            window.speechSynthesis.speak(u);
            console.log('[FitAI] WebSpeech speechSynthesis unlocked');
        } catch (e) {
            console.warn('[FitAI] WebSpeech unlock exception:', e);
        }
    }
}

// Register unlock listeners on first user gesture
['touchstart', 'touchend', 'click', 'pointerdown'].forEach(evt => {
    document.addEventListener(evt, unlockAudio, { once: false, passive: true });
});

// -------------------------------------------------------------------------
// Audio & TTS Functions
// -------------------------------------------------------------------------

let audioCtx = null;
let lastSpokenTime = 0;
const VOICE_THROTTLE_MS = 2500;

// Warm up speech synthesizer voices on load
let ttsVoices = [];
function loadVoices() {
    ttsVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}

function playSound(type) {
    const toggleSfx = document.getElementById('toggle-sfx');
    if (toggleSfx && !toggleSfx.checked) return;

    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;

        if (type === 'success') {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            osc1.frequency.setValueAtTime(783.99, now + 0.08);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(523.25, now);
            osc2.frequency.setValueAtTime(783.99, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
            osc1.start(now); osc2.start(now);
            osc1.stop(now + 0.35); osc2.stop(now + 0.35);
        } else if (type === 'warning') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.18);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, now);
            osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.25);
        } else if (type === 'beep') {
            // Fallback beep untuk TTS
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.15);
        }
    } catch (e) { console.error('Audio error:', e); }
}

// TTS state
let _ttsAudioQueue = [];
let _ttsSpeaking = false;

function speakText(text) {
    const toggleVoice = document.getElementById('toggle-voice');
    if (toggleVoice && !toggleVoice.checked) return;

    // Deteksi apakah dijalankan di web/Flask (bukan Tauri app)
    const isFlask = !(window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core));

    if (isFlask) {
        // Di Flask: gunakan proxy /tts via audio element
        try {
            const url = `/tts?text=${encodeURIComponent(text)}&lang=id`;
            const tts = document.getElementById('tts-audio');
            if (tts) {
                tts.src = url;
                tts.play().catch(() => androidWebViewTTS(text));
            } else {
                androidWebViewTTS(text);
            }
        } catch (e) {
            androidWebViewTTS(text);
        }
    } else {
        // Di Tauri/Android: gunakan strategi berlapis
        androidWebViewTTS(text);
    }
}

// Strategi TTS khusus untuk Android WebView - berlapis
function androidWebViewTTS(text) {
    // Jika online, prioritaskan Google Translate TTS (suara jauh lebih jernih dan konsisten)
    if (navigator.onLine) {
        ttsViaGoogleAudio(text);
    } else {
        // Jika offline, gunakan Web Speech API (speechSynthesis)
        fallbackWebSpeech(text);
    }
}

function ttsViaGoogleAudio(text) {
    try {
        // Potong teks jika terlalu panjang (Google TTS max ~200 char)
        const shortText = text.length > 200 ? text.substring(0, 200) : text;
        const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke || window.__TAURI_INVOKE__;

        if (invoke && audioCtx && audioCtx.state !== 'suspended') {
            // Tauri Native Fetch (Bypass CORS & Android WebView Media limitations)
            invoke('fetch_tts_audio', { text: shortText }).then((data) => {
                const uint8Array = new Uint8Array(data);
                return audioCtx.decodeAudioData(uint8Array.buffer);
            }).then((decodedBuffer) => {
                const src = audioCtx.createBufferSource();
                src.buffer = decodedBuffer;
                src.connect(audioCtx.destination);
                src.start(0);
                console.log('[FitAI] Google TTS berhasil diputar via Native Rust + AudioCtx');
            }).catch((e) => {
                console.warn('[FitAI] Native TTS fetch gagal:', e);
                fallbackWebSpeech(text);
            });
            return;
        }

        // Gunakan translate.googleapis.com (CORS-friendly, tidak memblokir WebView)
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=id&client=gtx&q=${encodeURIComponent(shortText)}`;

        const tts = document.getElementById('tts-audio');
        if (tts) {
            // Jangan diset crossOrigin karena akan memicu CORS preflight
            tts.removeAttribute('crossorigin');
            tts.src = url;
            tts.volume = 1.0;
            tts.play().then(() => {
                console.log('Google TTS berhasil diputar via tts-audio');
            }).catch((e) => {
                console.warn('Google TTS tts-audio gagal, fallback ke WebSpeech:', e);
                fallbackWebSpeech(text);
            });
        } else {
            const audio = new Audio();
            audio.src = url;
            audio.volume = 1.0;
            audio.play().then(() => {
                console.log('Google TTS berhasil diputar via dynamic Audio');
            }).catch((e) => {
                console.warn('Google TTS dynamic Audio gagal, fallback ke WebSpeech:', e);
                fallbackWebSpeech(text);
            });
        }
    } catch (e) {
        console.warn('Google Audio exception, fallback ke WebSpeech:', e);
        fallbackWebSpeech(text);
    }
}

// Fallback Web Speech API (speechSynthesis)
function fallbackWebSpeech(text) {
    if (window.speechSynthesis) {
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'id-ID';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Coba temukan suara bahasa Indonesia jika tersedia
            let voices = window.speechSynthesis.getVoices();
            const idVoice = voices.find(v =>
                v.lang === 'id-ID' || v.lang.startsWith('id') ||
                v.name.toLowerCase().includes('indonesia') ||
                v.name.toLowerCase().includes('google')
            );
            if (idVoice) utterance.voice = idVoice;

            window.speechSynthesis.speak(utterance);

            utterance.onerror = (e) => {
                console.warn('Fallback WebSpeech gagal, bip:', e.error);
                ttsViaBeep(text);
            };
        } catch (e) {
            console.warn('Fallback WebSpeech exception, bip:', e);
            ttsViaBeep(text);
        }
    } else {
        ttsViaBeep(text);
    }
}

// Fallback terakhir: suara beep sebagai indikator
function ttsViaBeep(text) {
    console.info('TTS fallback: beep untuk:', text);
    playSound('beep');
}

function webSpeechTTS(text) {
    androidWebViewTTS(text);
}

function speakCorrection(text) {
    const now = Date.now();
    if (now - lastSpokenTime > VOICE_THROTTLE_MS) {
        speakText(text);
        lastSpokenTime = now;
    }
}

// -------------------------------------------------------------------------

// 2. Mathematical Utility Functions
// -------------------------------------------------------------------------

// Calculate the 2D joint angle between three points: A (start), B (mid/joint), C (end)
function calculateAngle(pA, pB, pC) {
    if (!pA || !pB || !pC) return 0;

    let radians = Math.atan2(pC.y - pB.y, pC.x - pB.x) - Math.atan2(pA.y - pB.y, pA.x - pB.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
        angle = 360.0 - angle;
    }
    return angle;
}

// Calculate ground-plane angle sign: 90.0 if pointing "down" else -90.0
// Standardizing on screen coordinates (Y increases downwards)
function calculateGroundAngle(pStart, pEnd) {
    if (!pStart || !pEnd) return 90.0;
    // If the end joint has a greater Y, it's lower on the screen (pointing downwards)
    return (pEnd.y >= pStart.y) ? 90.0 : -90.0;
}

// -------------------------------------------------------------------------

// 3. ML Prediction (Offline - model berjalan langsung di JavaScript)
// -------------------------------------------------------------------------
function predictExercise(features) {
    if (typeof score === 'undefined') return { prediction: 'None', confidence: 0 };

    // 1. Standard scaler transformation
    let scaledInput = new Array(features.length);
    for (let i = 0; i < features.length; i++) {
        scaledInput[i] = (features[i] - SCALER_MEAN[i]) / SCALER_SCALE[i];
    }

    // 2. Predict
    let probs = score(scaledInput);

    // 3. Find argmax
    let maxProb = -1;
    let maxIdx = 0;
    for (let i = 0; i < probs.length; i++) {
        if (probs[i] > maxProb) {
            maxProb = probs[i];
            maxIdx = i;
        }
    }

    // 4. Return result as object
    const predictedEx = LABEL_CLASSES[maxIdx];

    return {
        prediction: predictedEx,
        confidence: maxProb
    };
}

// -------------------------------------------------------------------------
// 4. Repetition Counter Algorithm
// -------------------------------------------------------------------------

function trackRepetitions(predictedExercise, kneeAngle, elbowAngle, shoulderAngle, hipAngle, spineAngle, landmarks) {
    // 1. If no exercise is active, try to initiate one based on ML prediction or selected training mode
    if (activeExercise === 'None') {
        if (predictedExercise === 'Squats' && kneeAngle < 115) {
            activeExercise = 'Squats';
            repStage = 'down';
            currentRepIsGood = true;

            // Reset tracking stats
            minKneeAngle = kneeAngle;
            minHipAngle = hipAngle;
            minSpineAngle = spineAngle;
            hasReachedDepth = false;

            repStateText.textContent = "Turun...";
            repStateText.className = "info-val highlight";
            formQualityText.textContent = "Target kedalaman < 90°";
            formQualityText.className = "info-val highlight";
        } else if (predictedExercise === 'Push Ups' && elbowAngle < 110) {
            activeExercise = 'Push Ups';
            repStage = 'down';
            currentRepIsGood = true;

            // Reset tracking stats
            minElbowAngle = elbowAngle;
            minHipAngle = hipAngle;
            hasReachedDepth = false;

            repStateText.textContent = "Turun...";
            repStateText.className = "info-val highlight";
            formQualityText.textContent = "Target kedalaman < 95°";
            formQualityText.className = "info-val highlight";
        } else {
            // Keep idle / standard text
            repStateText.textContent = "Tahan Posisi";
            repStateText.className = "info-val";
            formQualityText.textContent = "-";
            formQualityText.className = "info-val";
        }
        return;
    }

    // 2. If an exercise is locked, ignore ML predictions and trace the angles
    if (activeExercise === 'Squats') {
        // Track peak performance
        minKneeAngle = Math.min(minKneeAngle, kneeAngle);
        minSpineAngle = Math.min(minSpineAngle, spineAngle);

        if (kneeAngle < 90) {
            hasReachedDepth = true;
        }

        // === REAL-WORLD SQUAT BACK CHECK ===
        // Standar nyata: punggung BOLEH condong ke depan (natural forward lean)
        // Yang DILARANG: lower back melengkung/bulat (spineAngle < 115°)
        // spineAngle 115-145° = condong ke depan wajar saat squat ✅
        // spineAngle < 115°  = lower back rounding berbahaya ❌
        if (spineAngle < 115) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Lower Back Melengkung!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Tegakkan dada");
        } else {
            if (!currentRepIsGood) {
                formQualityText.textContent = "Punggung Tidak Aman! Rep ditolak.";
                formQualityText.className = "info-val highlight-red";
            } else if (hasReachedDepth) {
                formQualityText.textContent = `Kedalaman OK! (${Math.round(kneeAngle)}°) 🎯`;
                formQualityText.className = "info-val highlight-green";
            } else {
                formQualityText.textContent = `Turun lebih dalam... (${Math.round(kneeAngle)}°)`;
                formQualityText.className = "info-val highlight";
            }
        }

        // Check for completion (berdiri kembali ~165°)
        if (kneeAngle > 165) {
            if (!hasReachedDepth) {
                repStateText.textContent = "Rep Ditolak!";
                repStateText.className = "info-val highlight-red";
                formQualityText.textContent = "Gagal: Kurang Dalam (target < 90°)";
                formQualityText.className = "info-val highlight-red";
                playSound('warning');
                speakCorrection("Jongkok kurang dalam");
            } else if (!currentRepIsGood || minSpineAngle < 115) {
                repStateText.textContent = "Rep Ditolak!";
                repStateText.className = "info-val highlight-red";
                formQualityText.textContent = "Gagal: Lower Back Melengkung";
                formQualityText.className = "info-val highlight-red";
                playSound('warning');
                speakCorrection("Punggung melengkung");
            } else {
                repCount++;
                repCounterText.textContent = repCount;
                repStateText.textContent = "Rep Selesai!";
                repStateText.className = "info-val highlight-green";
                formQualityText.textContent = "Sempurna! Netral Spine ✅ (+1)";
                formQualityText.className = "info-val highlight-green";
                triggerHapticFeedback();
                playSound('success');
                speakText(repCount.toString());
            }

            // Release lock & reset states
            activeExercise = 'None';
            hasReachedDepth = false;
            minSpineAngle = 180;
        }
    } else if (activeExercise === 'Push Ups') {
        // Track peak performance
        minElbowAngle = Math.min(minElbowAngle, elbowAngle);
        minHipAngle = Math.min(minHipAngle, hipAngle);

        if (elbowAngle < 95) {
            hasReachedDepth = true;
        }

        // Real-time posture check and feedback (Hip alignment & Knee flexion check)
        if (hipAngle < 160) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Pinggang dan Bahu Kurang Sejajar!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Luruskan punggung");
        } else if (kneeAngle < 150) {
            currentRepIsGood = false;
            formQualityText.textContent = "Bad: Lutut Menempel/Menekuk!";
            formQualityText.className = "info-val highlight-red";
            speakCorrection("Luruskan kaki");
        } else {
            if (!currentRepIsGood) {
                formQualityText.textContent = "Form Buruk! Rep akan ditolak.";
                formQualityText.className = "info-val highlight-red";
            } else if (hasReachedDepth) {
                formQualityText.textContent = `Kedalaman OK! (${Math.round(elbowAngle)}°)`;
                formQualityText.className = "info-val highlight-green";
            } else {
                formQualityText.textContent = `Turun lagi... (${Math.round(elbowAngle)}°)`;
                formQualityText.className = "info-val highlight";
            }
        }

        // Check for completion (push up extension)
        if (elbowAngle > 155) {
            if (!hasReachedDepth) {
                repStateText.textContent = "Rep Ditolak!";
                repStateText.className = "info-val highlight-red";
                formQualityText.textContent = "Gagal: Kurang Rendah";
                formQualityText.className = "info-val highlight-red";
                playSound('warning');
                speakCorrection("Turun kurang dalam");
            } else if (!currentRepIsGood || minHipAngle < 160) {
                repStateText.textContent = "Rep Ditolak!";
                repStateText.className = "info-val highlight-red";
                formQualityText.textContent = "Gagal: Pinggang & Bahu Tidak Sejajar";
                formQualityText.className = "info-val highlight-red";
                playSound('warning');
                speakCorrection("Luruskan punggung");
            } else {
                repCount++;
                repCounterText.textContent = repCount;
                repStateText.textContent = "Rep Selesai!";
                repStateText.className = "info-val highlight-green";
                formQualityText.textContent = "Sempurna (+1)";
                formQualityText.className = "info-val highlight-green";
                triggerHapticFeedback();
                playSound('success');
                speakText(repCount.toString());
            }

            // Release lock & reset states
            activeExercise = 'None';
            hasReachedDepth = false;
        }
    }
}

function triggerHapticFeedback() {
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
}

// -------------------------------------------------------------------------

// 5. UI Updating
// -------------------------------------------------------------------------

function updateUIWithPrediction(label, confidence) {
    // Display Label
    predictedLabel.textContent = label;
    predictedLabel.className = ""; // Remove placeholder style

    // Display Confidence percentage
    const confPercent = Math.round(confidence * 100);
    confidenceText.textContent = `${confPercent}%`;

    // Update linear progress bar
    confidenceBar.style.width = `${confPercent}%`;

    // Update glowing ring SVG (Dasharray = 213.6 for 34 radius)
    const offset = 213.6 - (213.6 * confPercent) / 100;
    confidenceRingBar.style.strokeDashoffset = offset;

    // Customize glowing ring color based on confidence level
    if (confPercent > 80) {
        confidenceRingBar.style.stroke = "var(--success)";
        confidenceBar.style.background = "linear-gradient(90deg, var(--success), var(--secondary))";
    } else if (confPercent > 50) {
        confidenceRingBar.style.stroke = "var(--warning)";
        confidenceBar.style.background = "linear-gradient(90deg, var(--warning), var(--primary))";
    } else {
        confidenceRingBar.style.stroke = "var(--danger)";
        confidenceBar.style.background = "var(--danger)";
    }
}

function updateFormFeedback(exercise, angles, spineAngle, landmarks) {
    if (!formFeedbackList) return;

    let feedbacks = [];

    if (exercise === 'Push Ups') {
        if (spineAngle < 150) {
            feedbacks.push({ text: "Turunkan bokongmu, punggung lurus!", good: false });
        } else {
            feedbacks.push({ text: "Punggung lurus (OK)", good: true });
        }

        if (angles.elbow > 110 && repStage === 'down') {
            feedbacks.push({ text: "Turun lebih dalam!", good: false });
        } else if (angles.elbow <= 110 && repStage === 'down') {
            feedbacks.push({ text: "Kedalaman mantap (OK)", good: true });
        }
    } else if (exercise === 'Squats') {
        if (angles.knee > 90 && repStage === 'down') {
            feedbacks.push({ text: "Jongkok lebih dalam lagi (<90°)!", good: false });
        } else if (angles.knee <= 90 && repStage === 'down') {
            feedbacks.push({ text: "Kedalaman jongkok pas (OK)", good: true });
        }

        if (spineAngle < 115) {
            feedbacks.push({ text: "Jangan membungkuk, tegakkan dada!", good: false });
        } else {
            feedbacks.push({ text: "Postur punggung aman (OK)", good: true });
        }
    } else if (exercise === 'Pull ups') {
        if (angles.elbow > 70 && repStage === 'up') {
            feedbacks.push({ text: "Tarik terus sampai dagu lewat bar!", good: false });
        } else if (angles.elbow <= 70 && repStage === 'up') {
            feedbacks.push({ text: "Tarikan mantap (OK)", good: true });
        }
        if (spineAngle < 150) {
            feedbacks.push({ text: "Jangan terlalu mengayun punggung!", good: false });
        } else {
            feedbacks.push({ text: "Postur stabil (OK)", good: true });
        }
    }

    // Render feedbacks
    if (feedbacks.length === 0) {
        formFeedbackList.innerHTML = `
                <div class="feedback-item empty">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Lakukan gerakan untuk melihat evaluasi...</span>
                </div>
            `;
        return;
    }

    formFeedbackList.innerHTML = feedbacks.map(f => `
            <div class="feedback-item ${f.good ? 'good' : 'bad'}">
                <i class="fa-solid ${f.good ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                <span>${f.text}</span>
            </div>
        `).join('');
}

// -------------------------------------------------------------------------

// 6. MediaPipe Pose Processor
// -------------------------------------------------------------------------

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Main frame callback
pose.onResults((results) => {
    // Hide loader on first frame results
    if (loadingSpinner.style.display !== 'none') {
        loadingSpinner.style.display = 'none';
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw flipped mirror webcam image on canvas
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (!results.poseLandmarks) {
        // Update UI to show no body is detected
        predictedLabel.textContent = "MENCARI TUBUH...";
        predictedLabel.className = "label-placeholder";
        confidenceText.textContent = "0%";
        confidenceBar.style.width = "0%";
        confidenceRingBar.style.strokeDashoffset = "213.6";


        // Show body search state
        repStateText.textContent = "Posisikan Tubuh";
        repStateText.className = "info-val highlight-red";

        formQualityText.textContent = "Mencari Orang...";
        formQualityText.className = "info-val highlight";

        // Reset calibration items
        if (calibShoulders) calibShoulders.classList.remove('ok');
        if (calibHips) calibHips.classList.remove('ok');
        if (calibKnees) calibKnees.classList.remove('ok');
        if (calibAnkles) calibAnkles.classList.remove('ok');

        // Safe reset of state machine in case they walked away mid-exercise
        activeExercise = 'None';
        repStage = 'up';
        currentRepIsGood = true;
        resultsReady = false;

        minKneeAngle = 180;
        minElbowAngle = 180;
        minHipAngle = 180;
        minSpineAngle = 180;
        maxShoulderAngle = 0;
        hasReachedDepth = false;
        hasReachedPeak = false;

        // Update camera positioning guide on UI
        updateCameraGuide(false, ["Bahu", "Pinggul", "Lutut", "Kaki"]);
        return;
    }

    const landmarks = results.poseLandmarks;

    // Track joint visibility (model visibility score > 0.5)
    const shouldersVisible = (landmarks[11].visibility > 0.5) || (landmarks[12].visibility > 0.5);
    const hipsVisible = (landmarks[23].visibility > 0.5) || (landmarks[24].visibility > 0.5);
    const kneesVisible = (landmarks[25].visibility > 0.5) || (landmarks[26].visibility > 0.5);
    const anklesVisible = (landmarks[27].visibility > 0.5) || (landmarks[28].visibility > 0.5);

    // Update checklist UI classes
    if (calibShoulders) {
        if (shouldersVisible) calibShoulders.classList.add('ok');
        else calibShoulders.classList.remove('ok');
    }
    if (calibHips) {
        if (hipsVisible) calibHips.classList.add('ok');
        else calibHips.classList.remove('ok');
    }
    if (calibKnees) {
        if (kneesVisible) calibKnees.classList.add('ok');
        else calibKnees.classList.remove('ok');
    }
    if (calibAnkles) {
        if (anklesVisible) calibAnkles.classList.add('ok');
        else calibAnkles.classList.remove('ok');
    }

    const bodyFullyVisible = shouldersVisible && hipsVisible && kneesVisible && anklesVisible;

    let missingParts = [];
    if (!shouldersVisible) missingParts.push("Bahu");
    if (!hipsVisible) missingParts.push("Pinggul");
    if (!kneesVisible) missingParts.push("Lutut");
    if (!anklesVisible) missingParts.push("Kaki");

    if (!bodyFullyVisible) {
        predictedLabel.textContent = "MENUNGGU KALIBRASI";
        predictedLabel.className = "label-placeholder";
        confidenceText.textContent = "0%";
        confidenceBar.style.width = "0%";
        confidenceRingBar.style.strokeDashoffset = "213.6";

        repStateText.textContent = "Posisikan Tubuh";
        repStateText.className = "info-val highlight-red";

        formQualityText.textContent = "Belum Terkalibrasi";
        formQualityText.className = "info-val highlight";

        // Show checklist and hide camera HUD during calibration
        if (calibrationOverlay) calibrationOverlay.style.display = 'flex';
        const hud = document.getElementById('camera-hud');
        if (hud) hud.style.display = 'none';

        // Safe reset of state machine
        activeExercise = 'None';
        {
            repStage = 'up';
        }
        currentRepIsGood = true;
        resultsReady = false;

        minKneeAngle = 180;
        minElbowAngle = 180;
        minHipAngle = 180;
        minSpineAngle = 180;
        maxShoulderAngle = 0;
        maxElbowAngle = 0;
        hasReachedDepth = false;
        hasReachedPeak = false;

        // Update camera positioning guide on UI
        updateCameraGuide(false, missingParts);

        // Draw skeleton anyway so user sees what is being tracked
        if (showSkeleton) {
            drawCyberSkeleton(landmarks);
        }
        return;
    }

    // Body is fully visible and calibrated! Hide checklist overlay
    if (calibrationOverlay) calibrationOverlay.style.display = 'none';

    // Determine which side of the body is more visible to be accurate
    const leftVisibility = landmarks[11].visibility + landmarks[13].visibility + landmarks[23].visibility + landmarks[25].visibility;
    const rightVisibility = landmarks[12].visibility + landmarks[14].visibility + landmarks[24].visibility + landmarks[26].visibility;

    let side = 'left';
    let sh, el, wr, hp, kn, ak, hl; // Key joint landmarks

    if (leftVisibility >= rightVisibility) {
        side = 'left';
        sh = landmarks[11]; // Shoulder
        el = landmarks[13]; // Elbow
        wr = landmarks[15]; // Wrist
        hp = landmarks[23]; // Hip
        kn = landmarks[25]; // Knee
        ak = landmarks[27]; // Ankle
        hl = landmarks[29]; // Heel
    } else {
        side = 'right';
        sh = landmarks[12];
        el = landmarks[14];
        wr = landmarks[16];
        hp = landmarks[24];
        kn = landmarks[26];
        ak = landmarks[28];
        hl = landmarks[30];
    }

    activeSideText.textContent = side.toUpperCase();

    // 1. Compute Standard 2D Joint Angles
    const shoulderAngle = calculateAngle(el, sh, hp);
    const elbowAngle = calculateAngle(sh, el, wr);
    const hipAngle = calculateAngle(sh, hp, kn);
    const kneeAngle = calculateAngle(hp, kn, ak);
    const ankleAngle = calculateAngle(kn, ak, hl);

    // ---- SPINE ANGLE: shoulder -> hip -> knee (semakin dekat 180° = semakin lurus) ----
    // Gunakan landmark bahu kiri/kanan tengah dan pinggul tengah untuk akurasi lebih baik
    const sh_l = landmarks[11]; // shoulder left
    const sh_r = landmarks[12]; // shoulder right
    const hp_l = landmarks[23]; // hip left
    const hp_r = landmarks[24]; // hip right

    let spineAngle = 180;
    if (sh_l && sh_r && hp_l && hp_r) {
        // Titik tengah bahu dan pinggul
        const midShoulder = { x: (sh_l.x + sh_r.x) / 2, y: (sh_l.y + sh_r.y) / 2 };
        const midHip = { x: (hp_l.x + hp_r.x) / 2, y: (hp_l.y + hp_r.y) / 2 };

        if (activeExercise === 'Push Ups' || trainingMode === 'Push Ups') {
            // Untuk Push Up: punggung dibilang lurus jika bahu-pinggul sejajar kaki (plank position)
            if (kn) spineAngle = calculateAngle(midShoulder, midHip, kn);
        } else {
            // Untuk selain Push Up: gunakan titik imajiner vertikal (berlaku untuk duduk & berdiri)
            const verticalRef = { x: midHip.x, y: midHip.y + 1 };
            spineAngle = calculateAngle(midShoulder, midHip, verticalRef);
        }

        if (isNaN(spineAngle)) spineAngle = 180;
    }


    const computedAngles = {
        shoulder: shoulderAngle,
        elbow: elbowAngle,
        hip: hipAngle,
        knee: kneeAngle,
        ankle: ankleAngle
    };

    // 2. Compute Segment Ground-Plane Angles (direction signs)
    const shoulderGround = calculateGroundAngle(sh, hp);
    const elbowGround = calculateGroundAngle(sh, el);
    const hipGround = calculateGroundAngle(hp, kn);
    const kneeGround = calculateGroundAngle(kn, ak);
    const ankleGround = calculateGroundAngle(ak, hl);

    // Update Form Feedback
    updateFormFeedback(activeExercise !== 'None' ? activeExercise : (predictedLabel.textContent !== 'SIAP MEDETEKSI' ? predictedLabel.textContent : 'None'), computedAngles, spineAngle, landmarks);

    // Assemble 10 feature values exactly in the order trained
    const features = [
        shoulderAngle,
        elbowAngle,
        hipAngle,
        kneeAngle,
        ankleAngle,
        shoulderGround,
        elbowGround,
        hipGround,
        kneeGround,
        ankleGround
    ];

    resultsReady = true;
    // Update camera positioning guide (successful detection)
    updateCameraGuide(true, []);

    // 3. Jalankan prediksi ML secara lokal (offline, tanpa server)
    const now = Date.now();
    if (trainingMode === 'Auto') {
        if (now - lastPredictionTime > PREDICTION_INTERVAL) {
            const mlResult = predictExercise(features);
            updateUIWithPrediction(mlResult.prediction, mlResult.confidence);
            lastPredictionTime = now;
        }
    }

    // 4. Run real-time repetition counting logic
    const exerciseToTrack = trainingMode;
    trackRepetitions(exerciseToTrack, kneeAngle, elbowAngle, shoulderAngle, hipAngle, spineAngle, landmarks);

    // Update Spinal/Alignment status on Right Panel in real-time
    if (spineStatusText) {
        if (activeExercise === 'Push Ups' || trainingMode === 'Push Ups') {
            if (spineAngle >= 150) {
                spineStatusText.textContent = "Lurus";
                spineStatusText.className = "info-val highlight-green";
            } else {
                spineStatusText.textContent = "Kurang Lurus";
                spineStatusText.className = "info-val highlight-red";
            }
        } else {
            if (spineAngle >= 160) {
                spineStatusText.textContent = "Tegak";
                spineStatusText.className = "info-val highlight-green";
            } else if (spineAngle >= 140) {
                spineStatusText.textContent = "Condong Depan";
                spineStatusText.className = "info-val highlight-yellow";
            } else {
                spineStatusText.textContent = "Membungkuk";
                spineStatusText.className = "info-val highlight-red";
            }
        }
    }

    // 5. Draw Skeleton (if enabled)
    if (showSkeleton) {
        drawCyberSkeleton(landmarks, spineAngle);
    }

    // 6. Update Camera HUD
    updateCameraHUD(spineAngle);
});

// Custom glowing futuristic skeleton rendering
function drawCyberSkeleton(landmarks, spineAngle) {
    // We draw in normal scale, but since canvas image was flipped, we must map our landmark X coordinates appropriately
    function getCanvasCoords(lm) {
        return {
            x: (1 - lm.x) * canvas.width,
            y: lm.y * canvas.height
        };
    }

    // Connections to draw
    const connections = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
        [11, 23], [12, 24], [23, 24],                    // Torso
        [23, 25], [25, 27], [24, 26], [26, 28],          // Legs
        [27, 29], [28, 30]                                // Feet
    ];

    // Draw glowing lines
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0, 242, 254, 0.8)";
    ctx.strokeStyle = "rgba(0, 242, 254, 0.75)";
    ctx.lineWidth = 4;

    connections.forEach(([i, j]) => {
        const p1 = getCanvasCoords(landmarks[i]);
        const p2 = getCanvasCoords(landmarks[j]);
        if (landmarks[i].visibility > 0.5 && landmarks[j].visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    });

    // ---- Draw SPINE line with posture color ----
    // Spine: midShoulder -> midHip -> knee (active side)
    const shL = getCanvasCoords(landmarks[11]);
    const shR = getCanvasCoords(landmarks[12]);
    const hpL = getCanvasCoords(landmarks[23]);
    const hpR = getCanvasCoords(landmarks[24]);
    const midShCanvas = { x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2 };
    const midHpCanvas = { x: (hpL.x + hpR.x) / 2, y: (hpL.y + hpR.y) / 2 };

    let spineColor;
    if (spineAngle >= 160) {
        spineColor = 'rgba(0, 230, 118, 0.9)';  // hijau
    } else if (spineAngle >= 140) {
        spineColor = 'rgba(255, 214, 0, 0.9)';  // kuning
    } else {
        spineColor = 'rgba(255, 23, 68, 0.9)';  // merah
    }

    const spineVis = (landmarks[11].visibility > 0.4 && landmarks[12].visibility > 0.4 &&
        landmarks[23].visibility > 0.4 && landmarks[24].visibility > 0.4);
    if (spineVis) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = spineColor;
        ctx.strokeStyle = spineColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(midShCanvas.x, midShCanvas.y);
        ctx.lineTo(midHpCanvas.x, midHpCanvas.y);
        ctx.stroke();

        // Label sudut punggung di canvas
        ctx.shadowBlur = 0;
        ctx.fillStyle = spineColor;
        ctx.font = 'bold 13px Outfit, sans-serif';
        ctx.fillText(`Punggung: ${Math.round(spineAngle)}°`, midHpCanvas.x + 8, midHpCanvas.y);
    }
    ctx.shadowBlur = 0;

    // Draw glowing node joints
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(138, 63, 252, 0.9)";
    ctx.fillStyle = "rgba(138, 63, 252, 0.95)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    const activeJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30];

    activeJoints.forEach(i => {
        if (landmarks[i].visibility > 0.5) {
            const pt = getCanvasCoords(landmarks[i]);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }
    });

    // Reset canvas shadow rules
    ctx.shadowBlur = 0;
}

// -------------------------------------------------------------------------
// 7. Video Access & Controls Logic
// -------------------------------------------------------------------------

async function startCamera() {
    if (cameraActive) return;

    videoPlaceholder.style.display = 'none';
    loadingSpinner.style.display = 'flex';
    if (calibrationOverlay) calibrationOverlay.style.display = 'flex';

    try {
        cameraInstance = new Camera(video, {
            onFrame: async () => {
                if (cameraActive) {
                    await pose.send({ image: video });
                }
            },
            width: 640,
            height: 480
        });

        await cameraInstance.start();
        cameraActive = true;

        // Update UI status badges
        webcamStatusDot.className = "status-dot green";
        webcamStatusText.textContent = "Webcam: Active";

        btnStartCamera.style.display = 'none';
        btnStopCamera.style.display = 'inline-flex';

    } catch (error) {
        console.error("Gagal mengakses kamera:", error);
        alert("Gagal mengakses webcam. Mohon pastikan izin kamera telah diberikan.");
        loadingSpinner.style.display = 'none';
        videoPlaceholder.style.display = 'flex';
    }
}

function stopCamera() {
    if (!cameraActive) return;

    cameraActive = false;
    if (cameraInstance) {
        cameraInstance.stop();
        cameraInstance = null;
    }

    // Reset states and canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    webcamStatusDot.className = "status-dot red";
    webcamStatusText.textContent = "Webcam: Offline";

    btnStopCamera.style.display = 'none';
    btnStartCamera.style.display = 'inline-flex';
    videoPlaceholder.style.display = 'flex';

    if (calibrationOverlay) calibrationOverlay.style.display = 'none';

    // Reset calibration items
    if (calibShoulders) calibShoulders.classList.remove('ok');
    if (calibHips) calibHips.classList.remove('ok');
    if (calibKnees) calibKnees.classList.remove('ok');
    if (calibAnkles) calibAnkles.classList.remove('ok');

    // Reset label and confidence
    predictedLabel.textContent = "SIAP MEDETEKSI";
    predictedLabel.className = "label-placeholder";
    confidenceText.textContent = "0%";
    confidenceBar.style.width = "0%";
    confidenceRingBar.style.strokeDashoffset = "213.6";

    // Reset state machine
    activeExercise = 'None';
    repStage = 'up';
    currentRepIsGood = true;
    repStateText.textContent = "Idle";
    repStateText.className = "info-val";
    formQualityText.textContent = "-";
    formQualityText.className = "info-val";

    minKneeAngle = 180;
    minElbowAngle = 180;
    minHipAngle = 180;
    maxShoulderAngle = 0;
    maxElbowAngle = 0;
    hasReachedDepth = false;
    hasReachedPeak = false;

    // Reset camera guide banner
    updateCameraGuide(false, []);

    // Hide camera HUD
    updateCameraHUD();
}

// Connect event listeners
btnStartCamera.addEventListener('click', startCamera);
document.getElementById('btn-start-camera').addEventListener('click', startCamera);
btnStopCamera.addEventListener('click', stopCamera);

btnToggleSkeleton.addEventListener('click', () => {
    showSkeleton = !showSkeleton;
    btnToggleSkeleton.querySelector('span').textContent = showSkeleton ? "Sembunyikan Skeleton" : "Tampilkan Skeleton";
    if (showSkeleton) {
        btnToggleSkeleton.className = "btn btn-secondary";
    } else {
        btnToggleSkeleton.className = "btn btn-outline";
    }
});

btnResetReps.addEventListener('click', () => {
    repCount = 0;
    repCounterText.textContent = 0;
    repStateText.textContent = "Reset";
    repStateText.className = "info-val";
    activeExercise = 'None';
    repStage = 'up';
    currentRepIsGood = true;
    formQualityText.textContent = "-";
    formQualityText.className = "info-val";

    minKneeAngle = 180;
    minElbowAngle = 180;
    minHipAngle = 180;
    maxShoulderAngle = 0;
    maxElbowAngle = 0;
    hasReachedDepth = false;
    hasReachedPeak = false;

    // Reset manual UI states
    if (trainingMode !== 'Auto') {
        predictedLabel.textContent = trainingMode.toUpperCase();
        predictedLabel.className = "highlight-green";
        confidenceText.textContent = "MANUAL";
        confidenceBar.style.width = "100%";
        confidenceRingBar.style.strokeDashoffset = "0";
        confidenceRingBar.style.stroke = "var(--success)";
    }

    // Sync to camera HUD
    updateCameraHUD();
});

// Helper: Camera positioning guide status updates
function updateCameraGuide(bodyFullyVisible, missingParts = []) {
    if (!cameraGuide || !guideText) return;

    if (!cameraActive) {
        cameraGuide.className = "guide-banner searching";
        guideText.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Harap nyalakan kamera dan posisikan tubuh Anda agar sepenuhnya terdeteksi oleh AI.';
        return;
    }

    if (!bodyFullyVisible) {
        cameraGuide.className = "guide-banner searching";
        let missingMsg = missingParts.length > 0 ? missingParts.join(', ') : "Bahu, Pinggul, Lutut, Kaki";
        guideText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <b>Posisikan Kamera</b>: Mencari tubuh... Bagian belum terlihat: <b style="color: #ff5e62;">${missingMsg}</b>. Harap mundur hingga seluruh tubuh terlihat.`;
        return;
    }

    // Customize guidance message based on chosen training mode
    cameraGuide.className = "guide-banner detected";
    if (trainingMode === 'Auto') {
        guideText.innerHTML = '<i class="fa-solid fa-circle-check"></i> <b>Tubuh Terdeteksi!</b> Lakukan gerakan apa saja, AI akan mendeteksinya secara otomatis.';
    } else if (trainingMode === 'Squats') {
        guideText.innerHTML = '<i class="fa-solid fa-circle-check"></i> <b>Latihan Squats Aktif!</b> Harap hadap ke samping agar AI dapat mendeteksi sudut lutut dan punggung Anda.';
    } else if (trainingMode === 'Push Ups') {
        guideText.innerHTML = '<i class="fa-solid fa-circle-check"></i> <b>Latihan Push Ups Aktif!</b> Harap posisikan kamera dari arah samping badan Anda.';
    } else if (trainingMode === 'Jumping Jacks') {
        guideText.innerHTML = '<i class="fa-solid fa-circle-check"></i> <b>Latihan Jumping Jacks Aktif!</b> Harap hadap lurus ke arah kamera.';
    
    }
}

// Connect Exercise Mode Selector listeners
const btnModes = document.querySelectorAll('.btn-mode');
btnModes.forEach(btn => {
    btn.addEventListener('click', () => {
        btnModes.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        trainingMode = btn.getAttribute('data-mode');

        // Reset repetition count and state machine upon changing mode
        repCount = 0;
        repCounterText.textContent = 0;
        activeExercise = 'None';
        {
            repStage = 'up';
        }
        currentRepIsGood = true;
        repStateText.textContent = "Mode Diubah";
        repStateText.className = "info-val highlight";
        formQualityText.textContent = "-";
        formQualityText.className = "info-val";

        minKneeAngle = 180;
        minElbowAngle = 180;
        minHipAngle = 180;
        maxShoulderAngle = 0;
        maxElbowAngle = 0;
        hasReachedDepth = false;
        hasReachedPeak = false;

        // Update UI elements based on selected mode
        if (true) {
            predictedLabel.textContent = trainingMode.toUpperCase();
            predictedLabel.className = "highlight-green";
            confidenceText.textContent = "MANUAL";
            confidenceBar.style.width = "100%";
            confidenceRingBar.style.strokeDashoffset = "0";
            confidenceRingBar.style.stroke = "var(--success)";
        } else {
            predictedLabel.textContent = "SIAP MEDETEKSI";
            predictedLabel.className = "label-placeholder";
            confidenceText.textContent = "0%";
            confidenceBar.style.width = "0%";
            confidenceRingBar.style.strokeDashoffset = "213.6";
            confidenceRingBar.style.stroke = "var(--danger)";
        }

        // Force guidance message updates immediately
        updateCameraGuide(cameraActive && resultsReady, cameraActive && !resultsReady ? ["Bahu", "Pinggul", "Lutut", "Kaki"] : []);
    });
});

// -------------------------------------------------------------------------
// 8. Camera HUD Synchronization
// -------------------------------------------------------------------------
function updateCameraHUD(spineAngle) {
    const hud = document.getElementById('camera-hud');
    if (!hud) return;

    if (!cameraActive) {
        hud.style.display = 'none';
        return;
    }

    hud.style.display = 'flex';

    // 1. Sync Reps
    const hudRepCounter = document.getElementById('hud-rep-counter');
    if (hudRepCounter) {
        hudRepCounter.textContent = repCounterText.textContent;
    }

    // 2. Sync Rep Stage/State
    const hudRepState = document.getElementById('hud-rep-state');
    if (hudRepState) {
        const state = repStateText.textContent;
        hudRepState.textContent = state;

        hudRepState.className = "hud-reps-state";
        if (state.toLowerCase().includes("turun") || state.toLowerCase().includes("condong") || state.toLowerCase().includes("putar")) {
            hudRepState.classList.add("active-down");
        } else if (state.toLowerCase().includes("selesai") || state.toLowerCase().includes("sempurna") || state.toLowerCase().includes("ok")) {
            hudRepState.classList.add("active-up");
        }
    }

    // 3. Sync Predicted Exercise
    const hudPredictedLabel = document.getElementById('hud-predicted-label');
    if (hudPredictedLabel) {
        hudPredictedLabel.textContent = predictedLabel.textContent;
    }

    // 4. Sync Form Feedback
    const hudFormFeedback = document.getElementById('hud-form-feedback');
    if (hudFormFeedback) {
        const feedbackText = formQualityText.textContent;
        hudFormFeedback.textContent = feedbackText !== "-" ? feedbackText : "SIAP MENDETEKSI";

        hudFormFeedback.className = "hud-feedback-text";
        if (formQualityText.className.includes("highlight-green")) {
            hudFormFeedback.classList.add("success");
        } else if (formQualityText.className.includes("highlight-red")) {
            hudFormFeedback.classList.add("danger");
        } else if (formQualityText.className.includes("highlight")) {
            hudFormFeedback.classList.add("warning");
        }
    }

    // 5. Sync Spinal/Alignment status or secondary info
    const hudSpineFeedback = document.getElementById('hud-spine-feedback');
    if (hudSpineFeedback) {
        const side = activeSideText.textContent;
        const spine = spineStatusText ? spineStatusText.textContent : "—";
        hudSpineFeedback.innerHTML = `Sisi: <span style="color:var(--secondary)">${side}</span> | Punggung: ${spine}`;
    }
}

let resultsReady = false;
window.addEventListener('error', function(event) { alert('JS Error: ' + event.message + ' at ' + event.filename + ':' + event.lineno); });

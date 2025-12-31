import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

// Error if key is missing to prevent silent failures in production
if (!import.meta.env.VITE_DEEPGRAM_API_KEY) {
    console.error("CRITICAL: Deepgram API Key is missing. Check .env file.");
}
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

let deepgramConnection = null;
let audioQueue = [];
let keepAliveInterval = null;

/**
 * Initializes the Deepgram WebSocket connection.
 * @param {Function} onTranscript - Callback for handling incoming transcript data.
 */
export const startDeepgramSocket = (onTranscript) => {
  // 1. NUCLEAR CLEANUP: If a connection exists, kill it immediately to prevent zombie connections.
  if (deepgramConnection) {
    console.log("⚠️ Found hanging connection. Cleaning up...");
    deepgramConnection.removeAllListeners();
    deepgramConnection.finish();
    deepgramConnection = null;
  }
  
  // Clear keepalive interval if it exists
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  // 2. Clear the queue so old audio from previous session doesn't leak into new session
  audioQueue = [];

  const deepgram = createClient(DEEPGRAM_API_KEY);
  console.log("🚀 Requesting NEW Deepgram connection...");

  // Setup connection with optimal settings for real-time responsiveness
  deepgramConnection = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
    interim_results: true, // ✅ CRITICAL: Enable interim results for lower latency
    endpointing: 300, // ✅ Faster endpoint detection (silence detection)
    utterance_end_ms: 1000, // ✅ Shorter utterance end detection
    vad_events: true, // ✅ Get voice activity detection events
    encoding: "linear16", // ✅ Matches our Int16Array conversion in the hook
    sample_rate: 16000, // ✅ Matches our AudioContext sample rate
  });

  deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("✅ Deepgram WebSocket OPENED! Flushing queue...");
    
    // Start keepalive mechanism to prevent load balancers/firewalls from killing the idle connection
    keepAliveInterval = setInterval(() => {
      if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
        // Send a specialized keepalive message provided by the SDK/protocol
        deepgramConnection.keepAlive();
      }
    }, 5000); // Every 5 seconds
    
    // Flush buffered audio captured during the connection phase
    while (audioQueue.length > 0) {
      const chunk = audioQueue.shift();
      sendAudioToDeepgram(chunk);
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    // Safety check for data structure integrity
    if(data && data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        // Only trigger callback if there is actual content
        if (transcript && transcript.trim().length > 0) {
            // Pass both transcript text and the 'is_final' flag
            // 'is_final' determines if the text is stable or an interim guess
            onTranscript(transcript, data.is_final);
        }
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log("🔌 Deepgram connection closed.");
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("❌ Deepgram Error:", err);
    // Note: You might want to bubble this up to the UI via a callback if connection drops mid-stream
  });

  return deepgramConnection;
};

/**
 * queues or sends audio data depending on connection state.
 * @param {Blob} audioBlob - The raw audio data chunk.
 */
export const sendAudioToDeepgram = (audioBlob) => {
  // Check if connection exists AND is in "Open" state (readyState 1)
  if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
    deepgramConnection.send(audioBlob);
  } else {
    // If connecting or closed (but not nulled yet), buffer the audio
    // This handles the "Missing Header" race condition
    if (audioQueue.length < 500) { // Safety cap to prevent memory overflow if socket never connects
        audioQueue.push(audioBlob);
    }
  }
};

/**
 * Cleanly closes the Deepgram connection and resets state.
 */
export const closeDeepgramSocket = () => {
  if (deepgramConnection) {
    console.log("🛑 Closing Deepgram socket...");
    
    // Clear keepalive first
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    
    deepgramConnection.finish();
    deepgramConnection = null; 
    audioQueue = [];
  }
};
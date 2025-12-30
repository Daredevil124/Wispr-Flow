import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

let deepgramConnection = null;
let audioQueue = [];
let keepAliveInterval = null;

export const startDeepgramSocket = (onTranscript) => {
  // 1. NUCLEAR CLEANUP: If a connection exists, kill it immediately.
  if (deepgramConnection) {
    console.log("⚠️ Found hanging connection. Cleaning up...");
    deepgramConnection.removeAllListeners();
    deepgramConnection.finish();
    deepgramConnection = null;
  }
  
  // Clear keepalive interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  // 2. Clear the queue so old audio doesn't leak into new session
  audioQueue = [];

  const deepgram = createClient(DEEPGRAM_API_KEY);
  console.log("🚀 Requesting NEW Deepgram connection...");

  deepgramConnection = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
    interim_results: true, // ✅ CRITICAL: Enable interim results for lower latency
    endpointing: 300, // ✅ Faster endpoint detection (default is 1000ms)
    utterance_end_ms: 1000, // ✅ Shorter utterance end detection
    vad_events: true, // ✅ Get voice activity detection events
    encoding: "linear16", // ✅ More efficient encoding
    sample_rate: 16000, // ✅ Standard sample rate for speech
  });

  deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("✅ Deepgram WebSocket OPENED! Flushing queue...");
    
    // Start keepalive to prevent connection timeout
    keepAliveInterval = setInterval(() => {
      if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
        // Send keepalive message
        deepgramConnection.keepAlive();
      }
    }, 5000); // Every 5 seconds
    
    // Flush buffered audio
    while (audioQueue.length > 0) {
      const chunk = audioQueue.shift();
      sendAudioToDeepgram(chunk);
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript && transcript.trim().length > 0) {
      // Pass both transcript and whether it's final
      onTranscript(transcript, data.is_final);
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
  });

  return deepgramConnection;
};

export const sendAudioToDeepgram = (audioBlob) => {
  // Check if connection exists AND is in "Open" state (readyState 1)
  if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
    deepgramConnection.send(audioBlob);
  } else {
    // If connecting or closed, buffer the audio
    audioQueue.push(audioBlob);
  }
};

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
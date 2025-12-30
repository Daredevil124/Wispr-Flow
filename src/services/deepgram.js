import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

let deepgramConnection = null;
let audioQueue = [];

export const startDeepgramSocket = (onTranscript) => {
  // 1. NUCLEAR CLEANUP: If a connection exists, kill it immediately.
  if (deepgramConnection) {
    console.log("⚠️ Found hanging connection. Cleaning up...");
    deepgramConnection.removeAllListeners(); // Stop listening to the old socket
    deepgramConnection.finish(); // Send close frame
    deepgramConnection = null;
  }
  
  // 2. Clear the queue so old audio doesn't leak into new session
  audioQueue = [];

  const deepgram = createClient(DEEPGRAM_API_KEY);
  console.log("🚀 Requesting NEW Deepgram connection...");

  deepgramConnection = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
  });

  deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("✅ Deepgram WebSocket OPENED! Flushing queue...");
    // Flush buffered audio
    while (audioQueue.length > 0) {
      const chunk = audioQueue.shift();
      sendAudioToDeepgram(chunk); // Reuse the send function
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript && transcript.trim().length > 0) {
      onTranscript(transcript);
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log("🔌 Deepgram connection closed.");
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
    // console.log("Queueing audio chunk..."); // (Optional: comment out to reduce noise)
    audioQueue.push(audioBlob);
  }
};

export const closeDeepgramSocket = () => {
  if (deepgramConnection) {
    console.log("🛑 Closing Deepgram socket...");
    deepgramConnection.finish();
    // We do NOT set deepgramConnection = null here immediately, 
    // we let the 'Close' event handle it, or the next startDeepgramSocket cleanup it.
    // But for safety in React dev mode:
    deepgramConnection = null; 
    audioQueue = [];
  }
};
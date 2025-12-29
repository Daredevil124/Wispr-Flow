import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

let deepgramConnection = null;
let audioQueue = []; // <--- 1. Temporary buffer for audio chunks

export const startDeepgramSocket = (onTranscript) => {
  const deepgram = createClient(DEEPGRAM_API_KEY);
  console.log("Requesting Deepgram connection...");

  deepgramConnection = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
  });

  // 2. When the socket opens, send all queued audio immediately
  deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log("✅ Deepgram Connection OPEN! Flushing queue...");
    
    // Send all buffered chunks
    while (audioQueue.length > 0) {
      const chunk = audioQueue.shift();
      deepgramConnection.send(chunk);
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript && transcript.trim().length > 0) {
      onTranscript(transcript);
    }
  });

  deepgramConnection.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("❌ Deepgram Error:", err);
  });

  return deepgramConnection;
};

export const sendAudioToDeepgram = (audioBlob) => {
  // 3. Smart Send: If not ready, queue it. If ready, send it.
  if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
    deepgramConnection.send(audioBlob);
  } else {
    // Connection not ready? Store the chunk (ESPECIALLY the first header chunk)
    console.log("⚠️ Socket not ready, queueing chunk...");
    audioQueue.push(audioBlob);
  }
};

export const closeDeepgramSocket = () => {
  if (deepgramConnection) {
    deepgramConnection.finish();
    deepgramConnection = null;
    audioQueue = []; // Clear queue
  }
};
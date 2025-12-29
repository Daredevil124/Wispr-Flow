// src/services/deepgram.js
import { createClient } from "@deepgram/sdk";

// NOTE: In a real production app, you would fetch this from a backend to hide it.
// For this assignment, using an env variable or direct string is acceptable if documented.
const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;; 

let deepgramConnection = null;

export const startDeepgramSocket = (onTranscript) => {
  const deepgram = createClient(DEEPGRAM_API_KEY);
    console.log("Requesting Deepgram connection...");
  // Open a WebSocket connection for live streaming
  deepgramConnection = deepgram.listen.live({
    model: "nova-2", // Their fastest model
    language: "en-US",
    smart_format: true,
    //encoding: "webm",
  });
deepgramConnection.on("Open", () => {
    console.log("✅ Deepgram WebSocket OPENED!"); // Debug Log 2
  });
  // When Deepgram sends us text
  deepgramConnection.on("Results", (data) => {
    console.log("📩 Received Data:", data);
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript && transcript.trim().length > 0) {
      onTranscript(transcript);
    }
  });

  deepgramConnection.on("Open", () => {
    console.log("Deepgram connection open!");
  });
  
  deepgramConnection.on("Close", () => {
    console.log("Deepgram connection closed.");
  });

  return deepgramConnection;
};

export const sendAudioToDeepgram = (audioBlob) => {
  if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
    deepgramConnection.send(audioBlob);
  }
};

export const closeDeepgramSocket = () => {
  if (deepgramConnection) {
    deepgramConnection.finish();
    deepgramConnection = null;
  }
};
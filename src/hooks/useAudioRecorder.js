import { useState, useRef } from "react";
import { startDeepgramSocket, sendAudioToDeepgram, closeDeepgramSocket } from "../services/deepgram";

/**
 * Custom hook to manage audio recording state and stream handling.
 * Handles microphone access, audio processing, and connection to Deepgram service.
 */
const useAudioRecorder = (onTranscriptReceived, onError) => {
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs to maintain state across renders without triggering re-renders
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isStoppingRef = useRef(false); // Flag to prevent race conditions during rapid start/stop
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);

  const startRecording = async () => {
    isStoppingRef.current = false;

    try {
      // Request microphone access with optimal settings for speech recognition
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // ✅ Match Deepgram's expected sample rate for best accuracy
        } 
      });
      streamRef.current = stream;

      // CHECK 1: Race Condition Safety
      // If user released the button while we were waiting for permission, abort immediately.
      if (isStoppingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Initialize Deepgram WebSocket connection
      try {
        startDeepgramSocket(onTranscriptReceived);
      } catch (socketError) {
         // Handle socket initialization errors explicitly
         console.error("Failed to initialize Deepgram socket:", socketError);
         if (onError) onError(new Error("Connection failed. Please check your network."));
         stopInternal(); // Cleanup
         return;
      }

      // ✅ Use AudioContext for lower latency streaming compared to MediaRecorder
      // Fallback for older WebKit browsers
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext({
        sampleRate: 16000
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create a script processor for manual raw audio chunking
      // bufferSize: 2048 (approx 128ms at 16kHz) offers a good balance of latency vs performance
      const bufferSize = 2048; 
      processorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (isStoppingRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array (Web Audio API default) to Int16Array (linear16 format)
        // This effectively downsamples the bit depth to 16-bit PCM, which is efficient for speech
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i])); // Clamp values
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; // Convert to PCM
        }
        
        // Send immediately as blob to the socket service
        const blob = new Blob([int16Data.buffer], { type: 'audio/raw' });
        sendAudioToDeepgram(blob);
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // CHECK 2: Post-Setup Safety
      // Ensure we didn't stop while setting up the audio graph
      if (isStoppingRef.current) {
        stopInternal();
      } else {
        setIsRecording(true);
      }

    } catch (error) {
      console.error("Error starting microphone:", error);
      // specific error messaging for common permission issues
      let userErrorMessage = "Could not access microphone.";
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        userErrorMessage = "Microphone permission denied. Please enable it in settings.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        userErrorMessage = "No microphone found.";
      }
      
      if (onError) onError(new Error(userErrorMessage));
      setIsRecording(false);
    }
  };

  // Internal cleanup function to release all resources
  const stopInternal = () => {
    // 1. Stop Audio Processing (ScriptProcessor & AudioContext)
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      // Safely close context if it's open
      if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
      }
      audioContextRef.current = null;
    }
    
    // 2. Stop Microphone Stream (Hardware indicator)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // 3. Close Socket Connection
    closeDeepgramSocket();
  };

  const stopRecording = () => {
    isStoppingRef.current = true; // Signal stop to any pending async operations
    stopInternal();
    setIsRecording(false);
  };

  return { isRecording, startRecording, stopRecording };
};

export default useAudioRecorder;
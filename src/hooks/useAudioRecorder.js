import { useState, useRef } from "react";
import { startDeepgramSocket, sendAudioToDeepgram, closeDeepgramSocket } from "../services/deepgram";

const useAudioRecorder = (onTranscriptReceived, onError) => {
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);   // Store stream to close it reliably
  const isStoppingRef = useRef(false); // Track if user released button early

  const startRecording = async () => {
    isStoppingRef.current = false; // Reset stop flag

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // CHECK 1: Did user release button while we were getting mic?
      if (isStoppingRef.current) {
        stream.getTracks().forEach(track => track.stop()); // Kill mic immediately
        return;
      }

      // Start Deepgram
      startDeepgramSocket(onTranscriptReceived);

      // Setup MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0 && !isStoppingRef.current) {
          sendAudioToDeepgram(event.data);
        }
      });

      mediaRecorderRef.current.start(250);
      
      // CHECK 2: Did user release button during setup?
      if (isStoppingRef.current) {
        stopInternal(); // Cancel everything
      } else {
        setIsRecording(true); // Only set TRUE if we are truly safe
      }

    } catch (error) {
      console.error("Error starting microphone:", error);
      if (onError) onError(error);
      // Ensure state is reset if error happens
      setIsRecording(false);
    }
  };

  // Helper to cleanly stop everything without React state logic
  const stopInternal = () => {
    // 1. Stop Media Recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // 2. Stop Microphone Stream (Hardware Light)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // 3. Close Socket
    closeDeepgramSocket();
  };

  const stopRecording = () => {
    isStoppingRef.current = true; // Signal that we want to stop
    stopInternal();
    setIsRecording(false); // Update UI immediately
  };

  return { isRecording, startRecording, stopRecording };
};

export default useAudioRecorder;
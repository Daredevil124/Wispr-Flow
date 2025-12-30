import { useState, useRef } from "react";
import { startDeepgramSocket, sendAudioToDeepgram, closeDeepgramSocket } from "../services/deepgram";

const useAudioRecorder = (onTranscriptReceived, onError) => {
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isStoppingRef = useRef(false);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);

  const startRecording = async () => {
    isStoppingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // ✅ Match Deepgram's expected sample rate
        } 
      });
      streamRef.current = stream;

      // CHECK 1: Did user release button while we were getting mic?
      if (isStoppingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      // Start Deepgram
      startDeepgramSocket(onTranscriptReceived);

      // ✅ Use AudioContext for lower latency streaming
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create a script processor for manual chunking
      const bufferSize = 2048; // ✅ Smaller buffer = lower latency
      processorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (isStoppingRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (linear16 format)
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send immediately as blob
        const blob = new Blob([int16Data.buffer], { type: 'audio/raw' });
        sendAudioToDeepgram(blob);
      };
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // CHECK 2: Did user release button during setup?
      if (isStoppingRef.current) {
        stopInternal();
      } else {
        setIsRecording(true);
      }

    } catch (error) {
      console.error("Error starting microphone:", error);
      if (onError) onError(error);
      setIsRecording(false);
    }
  };

  const stopInternal = () => {
    // 1. Stop Audio Processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // 2. Stop Microphone Stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // 3. Close Socket
    closeDeepgramSocket();
  };

  const stopRecording = () => {
    isStoppingRef.current = true;
    stopInternal();
    setIsRecording(false);
  };

  return { isRecording, startRecording, stopRecording };
};

export default useAudioRecorder;
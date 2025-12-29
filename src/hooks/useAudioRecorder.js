import { useState, useRef } from "react";
import { startDeepgramSocket, sendAudioToDeepgram, closeDeepgramSocket } from "../services/deepgram";

const useAudioRecorder = (onTranscriptReceived) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 1. Start the Deepgram Connection
      startDeepgramSocket(onTranscriptReceived);

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          // 2. Send audio chunks to Deepgram Service
          sendAudioToDeepgram(event.data);
        }
      });

      mediaRecorderRef.current.start(250); 
      setIsRecording(true);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    // 3. Close connection
    closeDeepgramSocket();
    setIsRecording(false);
  };

  return { isRecording, startRecording, stopRecording };
};

export default useAudioRecorder;
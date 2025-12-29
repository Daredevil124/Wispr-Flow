import { useState, useRef } from "react";
import { startDeepgramSocket, sendAudioToDeepgram, closeDeepgramSocket } from "../services/deepgram";

const useAudioRecorder = (onTranscriptReceived) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 1. Start Deepgram (Don't await it!)
      startDeepgramSocket(onTranscriptReceived);

      // 2. Start MediaRecorder immediately
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          // Send to our new smart function that handles the queue
          sendAudioToDeepgram(event.data);
        }
      });

      // 3. Start immediately so we catch the Header
      mediaRecorderRef.current.start(250); 
      setIsRecording(true);

    } catch (error) {
      console.error("Error starting microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    closeDeepgramSocket();
    setIsRecording(false);
  };

  return { isRecording, startRecording, stopRecording };
};

export default useAudioRecorder;
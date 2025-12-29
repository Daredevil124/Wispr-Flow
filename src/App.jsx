import { useState } from "react";
import "./App.css";
import useAudioRecorder from "./hooks/useAudioRecorder";

function App() {
  const [transcript, setTranscript] = useState("");

  // This function updates the UI when text comes back
  const handleNewTranscript = (newText) => {
    setTranscript((prev) => prev + " " + newText);
  };

  const { isRecording, startRecording, stopRecording } = useAudioRecorder(handleNewTranscript);

  return (
    <div className="container">
      <h1>SubSpace Voice Note</h1>
      
      <div className="controls">
        <button
          className={`mic-button ${isRecording ? "active" : ""}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
        >
          {isRecording ? "Release to Send" : "Hold to Speak"}
        </button>
        
      </div>

      <div className="transcript-box">
        {transcript || "Your text will appear here..."}
      </div>
    </div>
  );
}

export default App;
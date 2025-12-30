import { useState } from "react";
import "./App.css";
import useAudioRecorder from "./hooks/useAudioRecorder";

function App() {
  const [transcript, setTranscript] = useState("");
  const [copyBtnText, setCopyBtnText] = useState("Copy Text"); // For button feedback
  const [errorMsg, setErrorMsg] = useState(null); // For error handling

  // 1. Function to handle incoming text
  const handleNewTranscript = (newText) => {
    setTranscript((prev) => prev + " " + newText);
  };

  // 2. Initialize our hook with the transcript handler AND an error handler
  const { isRecording, startRecording, stopRecording } = useAudioRecorder(
    handleNewTranscript,
    (err) => setErrorMsg(err.message) // Show error in UI if it happens
  );

  // 3. The Missing handleCopy Function
  const handleCopy = async () => {
    try {
      // Tries to write to clipboard
      await navigator.clipboard.writeText(transcript);
      
      // Visual feedback (Product Thinking)
      setCopyBtnText("Copied! ✅");
      setTimeout(() => setCopyBtnText("Copy Text"), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setErrorMsg("Failed to copy text");
    }
  };

  const handleClear = () => {
    setTranscript("");
    setErrorMsg(null);
  };

  return (
    <div className="container">
      <h1>SubSpace Voice Note</h1>
      
      {/* Error Banner */}
      {errorMsg && <div className="error-banner">⚠️ {errorMsg}</div>}

      <div className="controls">
        <button
          className={`mic-button ${isRecording ? "active" : ""}`}
          // Use Left Click only
          onMouseDown={(e) => {
            if (e.button !== 0) return; 
            startRecording();
          }}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording} // Stops recording if you drag mouse away
        >
          {isRecording ? "Listening..." : "Hold to Speak"}
        </button>
      </div>

      <div className="transcript-box">
        {transcript || <span className="placeholder">Your text will appear here...</span>}
      </div>

      <div className="action-buttons">
        <button onClick={handleCopy} disabled={!transcript}>
          {copyBtnText}
        </button>
        <button onClick={handleClear} className="secondary">
          Clear
        </button>
      </div>
    </div>
  );
}

export default App;
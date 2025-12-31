import { useState, useRef, useEffect } from "react";
import "./App.css";
import useAudioRecorder from "./hooks/useAudioRecorder";

function App() {
  
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [copyBtnText, setCopyBtnText] = useState("Copy Text");
  const [errorMsg, setErrorMsg] = useState(null);
  const transcriptBoxRef = useRef(null);

  /**
   * Handles incoming transcripts.
   * Separates finalized text (white) from interim guesses (gray).
   */
  const handleNewTranscript = (newText, isFinal) => {
    if (isFinal) {
      setTranscript((prev) => {
        const updated = prev + " " + newText;
        return updated.trim();
      });
      setInterimText(""); // Clear interim once finalized
    } else {
      setInterimText(newText); // Show live "ghost" text
    }
  };

  const { isRecording, startRecording, stopRecording } = useAudioRecorder(
    handleNewTranscript,
    (err) => {
        // Display user-friendly error messages in the UI
        setErrorMsg(err.message || "An unexpected error occurred.");
    }
  );

  const handleCopy = async () => {
    try {
      // Copy both finalized and any pending interim text
      const fullText = (transcript + " " + interimText).trim();
      if (!fullText) return;

      await navigator.clipboard.writeText(fullText);
      setCopyBtnText("Copied! ✅");
      setTimeout(() => setCopyBtnText("Copy Text"), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setErrorMsg("Failed to copy text to clipboard.");
    }
  };

  const handleClear = () => {
    setTranscript("");
    setInterimText("");
    setErrorMsg(null);
  };

  // Auto-scroll to bottom when transcript updates to keep latest text in view
  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  return (
    <div className="container">
      <h1 className="title">Voice-To-Text</h1>
      
      {/* Graceful Error Display for production readiness */}
      {errorMsg && (
        <div className="error-banner" role="alert">
          ⚠️ {errorMsg}
          <button className="close-error" onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      <div className="controls">
        <button
          className={`mic-button ${isRecording ? "recording" : ""}`}
          // Use onMouseDown/Up for Push-to-Talk behavior
          onMouseDown={(e) => {
            if (e.button !== 0) return; // Only allow Left Click
            startRecording();
          }}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording} // Safety: Stop if mouse drags off button
          aria-label={isRecording ? "Release to stop recording" : "Hold to speak"}
        >
          {/* SVG Icon for professional look */}
          <svg 
            className="mic-icon"
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
          <span>{isRecording ? "Listening..." : "Hold to Speak"}</span>
        </button>
      </div>

      <div className="transcript-box" ref={transcriptBoxRef}>
        {transcript || interimText ? (
          <>
            <span className="final-text">{transcript}</span>
            {interimText && (
              <span className="interim-text">
                {transcript && " "}
                {interimText}
                <span className="cursor"></span> {/* Visual typing cursor */}
              </span>
            )}
          </>
        ) : (
          <span className="placeholder">Your text will appear here...</span>
        )}
      </div>

      <div className="action-buttons">
        <button 
          className="btn-primary"
          onClick={handleCopy} 
          disabled={!transcript && !interimText}
        >
          {copyBtnText}
        </button>
        <button 
          className="btn-secondary"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default App;
# Voice-to-Text Desktop App (Tauri + Deepgram)

## 📖 Overview
A high-performance desktop application that enables real-time voice-to-text transcription using the Deepgram API. Built with **Tauri** for a lightweight footprint and **React** for the UI.

## 🏗 Architecture & Key Decisions

### 1. Robust Audio Streaming (The "Missing Header" Fix)
A common issue with WebSocket streaming is data loss during the connection handshake.
- **Solution:** I implemented a **Message Queue** in the service layer. Audio chunks captured before the WebSocket is ready are buffered and automatically flushed once the connection emits the `Open` event. This ensures the critical "File Header" is never lost.

### 2. "Push-to-Talk" Reliability
Handling rapid mouse clicks can lead to race conditions where the microphone stays open.
- **Solution:** I used a **Cancellation Ref (`isStoppingRef`)** pattern. If the user releases the mouse button while the microphone is initializing, the app detects the "abort" signal and immediately cleans up resources, preventing the app from getting stuck in a "zombie" recording state.

### 3. Resource Management
- **Nuclear Cleanup:** To prevent memory leaks, the application performs a "nuclear cleanup" before starting any new session, forcibly removing old event listeners and closing stray WebSocket connections.

## 🛠 Tech Stack
- **Frontend:** React + Vite
- **Desktop Framework:** Tauri (Rust)
- **AI Service:** Deepgram Nova-2 Model (WebSocket API)

## 🚀 How to Run
1. Clone the repository.
2. Create a `.env` file: `VITE_DEEPGRAM_API_KEY=your_key_here`
3. Run `npm install`
4. Run `npm run tauri dev`

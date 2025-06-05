// popup.js - Recording logic in popup context

let recorder = null;
let recordedChunks = [];
let currentStream = null;
let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");
  updateUI();
});

// Start recording button
document.getElementById("startBtn").onclick = async () => {
  console.log("Start button clicked");
  
  try {
    setButtonsLoading(true);
    showStatus("Starting recording...", "info");
    
    // Use tabCapture directly in popup context
    chrome.tabCapture.capture({ audio: true, video: true }, (stream) => {
      console.log("TabCapture result:", stream);
      console.log("TabCapture error:", chrome.runtime.lastError);
      
      if (chrome.runtime.lastError) {
        console.error("Capture error:", chrome.runtime.lastError);
        showStatus(`Failed to start recording: ${chrome.runtime.lastError.message}`, "error");
        setButtonsLoading(false);
        return;
      }
      
      if (!stream) {
        console.error("No stream received");
        showStatus("Failed to start recording: No stream received", "error");
        setButtonsLoading(false);
        return;
      }
      
      console.log("Stream received successfully");
      currentStream = stream;
      isRecording = true;
      recordedChunks = [];
      
      // Set up MediaRecorder
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 
                   'video/webm;codecs=vp9' : 'video/webm'
        });
        
        recorder.ondataavailable = (event) => {
          console.log("Data available:", event.data.size);
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          console.log("Recording stopped, downloading...");
          downloadRecording();
        };
        
        recorder.onerror = (event) => {
          console.error("MediaRecorder error:", event);
          showStatus("Recording error occurred", "error");
        };
        
        // Handle stream ending
        stream.addEventListener('ended', () => {
          console.log("Stream ended");
          if (isRecording) {
            showStatus("Stream ended - recording stopped", "error");
            stopRecording();
          }
        });
        
        recorder.start(1000); // Collect data every second
        console.log("Recording started successfully");
        
        updateUI();
        showStatus("Recording started! Keep this popup open while recording.", "success");
        
        // Store recording state in chrome.storage for persistence
        chrome.storage.local.set({ 
          isRecording: true, 
          startTime: Date.now() 
        });
        
      } catch (error) {
        console.error("MediaRecorder setup error:", error);
        showStatus(`MediaRecorder error: ${error.message}`, "error");
        stream.getTracks().forEach(track => track.stop());
      }
      
      setButtonsLoading(false);
    });
    
  } catch (error) {
    console.error("Start recording error:", error);
    showStatus(`Error: ${error.message}`, "error");
    setButtonsLoading(false);
  }
};

// Stop recording button
document.getElementById("stopBtn").onclick = () => {
  console.log("Stop button clicked");
  stopRecording();
};

function stopRecording() {
  console.log("Stopping recording...");
  
  isRecording = false;
  
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  
  // Clear storage
  chrome.storage.local.remove(['isRecording', 'startTime']);
  
  updateUI();
  showStatus("Recording stopped!", "success");
}

function downloadRecording() {
  console.log("Downloading recording, chunks:", recordedChunks.length);
  
  if (recordedChunks.length === 0) {
    console.log("No recorded data to download");
    showStatus("No data recorded", "error");
    return;
  }
  
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const filename = `tab-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
  
  // Create download link
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Cleanup
  URL.revokeObjectURL(url);
  recordedChunks = [];
  
  console.log("Recording downloaded:", filename);
  showStatus("Recording saved successfully!", "success");
}

// Update UI based on current state
function updateUI() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const statusDiv = document.getElementById("status");
  
  if (isRecording) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.textContent = "Recording...";
    stopBtn.textContent = "Stop Recording";
    
    if (statusDiv) {
      statusDiv.textContent = "🔴 Recording in progress";
      statusDiv.className = "status recording";
    }
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.textContent = "Start Recording";
    stopBtn.textContent = "Stop Recording";
    
    if (statusDiv) {
      statusDiv.textContent = "Ready to record";
      statusDiv.className = "status";
    }
  }
}

// Set loading state for buttons
function setButtonsLoading(loading) {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  
  if (loading) {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    startBtn.textContent = "Starting...";
  }
  // updateUI() will be called after to set proper state
}

// Show status messages
function showStatus(message, type = "info") {
  let statusDiv = document.getElementById("status");
  
  if (!statusDiv) {
    statusDiv = document.createElement("div");
    statusDiv.id = "status";
    document.querySelector(".container").appendChild(statusDiv);
  }
  
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  // Auto-clear success/error messages after 4 seconds
  if (type === "success" || type === "error") {
    setTimeout(() => {
      if (statusDiv.className.includes(type)) {
        updateUI(); // Reset to normal status
      }
    }, 4000);
  }
}

// Check for previous recording state on popup open
chrome.storage.local.get(['isRecording', 'startTime'], (result) => {
  if (result.isRecording) {
    console.log("Previous recording session detected");
    showStatus("Previous recording was interrupted. Start a new recording.", "info");
    chrome.storage.local.remove(['isRecording', 'startTime']);
  }
});
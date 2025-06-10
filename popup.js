/* popup.js - Recording logic in popup context with simplified minimize functionality and hotkeys */

let recorder = null;
let recordedChunks = [];
let currentStream = null;
let isRecording = false;
let isPaused = false;
let micStream = null;
let isMinimized = false;

// DOM elements for minimize functionality
const minimizeBtn = document.getElementById('minimizeBtn');
const minimizeIcon = document.getElementById('minimizeIcon'); // This will now hold the <i> tag
const body = document.body;
const container = document.querySelector('.container');
const title = document.getElementById('title');
const description = document.getElementById('description');
const mainButtonContainer = document.getElementById('mainButtonContainer'); // New ID
const secondaryActions = document.getElementById('secondaryActions'); // New ID
const micControl = document.getElementById('micControl');
const status = document.getElementById('status');
const info = document.getElementById('info');
const compactIndicator = document.getElementById('compactIndicator');
const hotkeyInfo = document.getElementById('hotkeyInfo');

document.addEventListener('DOMContentLoaded', () => {
  console.log("Popup loaded");

  // Initialize in expanded form by default
  isMinimized = false;

  // Load minimize state (but default to expanded)
  chrome.storage.local.get(['isMinimized'], (result) => {
    // Only minimize if explicitly saved as minimized
    if (result.isMinimized === true) {
      toggleMinimize(true);
    } else {
      // Ensure expanded state
      toggleMinimize(false);
    }
  });

  updateUI();
  setupMinimizeHandler();
  setupHotkeys();
});

// Enhanced hotkey functionality with Shift+F for stop
function setupHotkeys() {
  document.addEventListener('keydown', (event) => {
    // Check if Shift key is pressed along with specific keys
    if (event.shiftKey) {
      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          if (!isRecording) {
            document.getElementById('startBtn').click();
            showStatus("Hotkey: Starting recording (Shift+S)", "info");
          }
          break;
        case 'p':
          event.preventDefault();
          if (isRecording && !isPaused) {
            document.getElementById('pauseBtn').click();
            showStatus("Hotkey: Pausing recording (Shift+P)", "info");
          }
          break;
        case 'r':
          event.preventDefault();
          if (isRecording && isPaused) {
            document.getElementById('resumeBtn').click();
            showStatus("Hotkey: Resuming recording (Shift+R)", "info");
          }
          break;
        case 'f':
          event.preventDefault();
          if (isRecording) {
            document.getElementById('stopBtn').click();
            showStatus("Hotkey: Stopping recording (Shift+F)", "info");
          }
          break;
      }
    }
  });
}

// Simplified minimize/expand functionality without animations
function setupMinimizeHandler() {
  minimizeBtn.addEventListener('click', () => {
    toggleMinimize(!isMinimized);
  });
}

function toggleMinimize(minimize) {
  isMinimized = minimize;

  if (isMinimized) {
    // Minimize - add minimized class to all elements
    body.classList.add('minimized');
    container.classList.add('minimized');
    title.classList.add('minimized');
    description.classList.add('minimized');
    mainButtonContainer.classList.add('minimized'); // Apply to new containers
    secondaryActions.classList.add('minimized'); // Apply to new containers
    micControl.classList.add('minimized');
    hotkeyInfo.classList.add('minimized');
    status.classList.add('minimized');
    info.classList.add('minimized');
    minimizeBtn.classList.add('minimized');

    // Update icon to point down
    minimizeIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
    minimizeBtn.title = 'Expand';

  } else {
    // Expand - remove minimized class from all elements
    body.classList.remove('minimized');
    container.classList.remove('minimized');
    title.classList.remove('minimized');
    description.classList.remove('minimized');
    mainButtonContainer.classList.remove('minimized'); // Remove from new containers
    secondaryActions.classList.remove('minimized'); // Remove from new containers
    micControl.classList.remove('minimized');
    hotkeyInfo.classList.remove('minimized');
    status.classList.remove('minimized');
    info.classList.remove('minimized');
    minimizeBtn.classList.remove('minimized');

    // Update icon to point up
    minimizeIcon.innerHTML = '<i class="fas fa-chevron-up"></i>';
    minimizeBtn.title = 'Minimize';
  }

  // Save minimize state
  chrome.storage.local.set({ isMinimized });
  updateCompactIndicator();
}

// Update compact indicator based on recording state
function updateCompactIndicator() {
  if (isRecording && !isPaused) {
    compactIndicator.className = 'compact-indicator recording';
  } else if (isRecording && isPaused) {
    compactIndicator.className = 'compact-indicator paused';
  } else {
    compactIndicator.className = 'compact-indicator';
  }
}

// Start recording button
document.getElementById("startBtn").onclick = async () => {
  console.log("Start button clicked");

  try {
    setButtonsLoading(true);
    showStatus("Starting recording...", "info");

    // Get tab capture stream
    chrome.tabCapture.capture({ audio: true, video: true }, async (tabStream) => {
      console.log("TabCapture result:", tabStream);
      console.log("TabCapture error:", chrome.runtime.lastError);

      if (chrome.runtime.lastError) {
        console.error("Capture error:", chrome.runtime.lastError);
        showStatus(`Failed to start recording: ${chrome.runtime.lastError.message}`, "error");
        setButtonsLoading(false);
        return;
      }

      if (!tabStream) {
        console.error("No tab stream received");
        showStatus("Failed to start recording: No stream received", "error");
        setButtonsLoading(false);
        return;
      }

      console.log("Tab stream received successfully");
      currentStream = tabStream;

      // Get microphone stream if enabled
      const micToggle = document.getElementById("micToggle").checked;
      let finalStream = tabStream;

      if (micToggle) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("Microphone stream acquired");

          // Combine tab audio/video with microphone audio
          const audioContext = new AudioContext();
          const tabSource = audioContext.createMediaStreamSource(tabStream);
          const micSource = audioContext.createMediaStreamSource(micStream);
          const destination = audioContext.createMediaStreamDestination();

          tabSource.connect(destination);
          micSource.connect(destination);

          // Create new stream with combined audio and tab video
          finalStream = new MediaStream([
            ...tabStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
          ]);
        } catch (micError) {
          console.error("Microphone access error:", micError);
          showStatus("Microphone access denied, recording without mic", "error");
        }
      }

      isRecording = true;
      isPaused = false; // Ensure isPaused is false on start
      recordedChunks = [];

      // Set up MediaRecorder
      try {
        recorder = new MediaRecorder(finalStream, {
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
        finalStream.addEventListener('ended', () => {
          console.log("Stream ended");
          if (isRecording) {
            showStatus("Stream ended - recording stopped", "error");
            stopRecording();
          }
        });

        recorder.start(1000); // Collect data every second
        console.log("Recording started successfully");

        updateUI();
        updateCompactIndicator();
        showStatus("Recording started! Use hotkeys or minimize (↑) to reduce overlay.", "success");

        // Store recording state in chrome.storage for persistence
        chrome.storage.local.set({
          isRecording: true,
          startTime: Date.now()
        });

      } catch (error) {
        console.error("MediaRecorder setup error:", error);
        showStatus(`MediaRecorder error: ${error.message}`, "error");
        finalStream.getTracks().forEach(track => track.stop());
        if (micStream) micStream.getTracks().forEach(track => track.stop());
      }

      setButtonsLoading(false);
    });

  } catch (error) {
    console.error("Start recording error:", error);
    showStatus(`Error: ${error.message}`, "error");
    setButtonsLoading(false);
  }
};

// Pause recording button
document.getElementById("pauseBtn").onclick = () => {
  console.log("Pause button clicked");
  if (recorder && isRecording && !isPaused) {
    recorder.pause();
    isPaused = true;
    updateUI();
    updateCompactIndicator();
    showStatus("Recording paused", "paused");
  }
};

// Resume recording button
document.getElementById("resumeBtn").onclick = () => {
  console.log("Resume button clicked");
  if (recorder && isRecording && isPaused) {
    recorder.resume();
    isPaused = false;
    updateUI();
    updateCompactIndicator();
    showStatus("Recording resumed", "success");
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
  isPaused = false;

  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  // Clear storage
  chrome.storage.local.remove(['isRecording', 'startTime']);

  updateUI();
  updateCompactIndicator();
  showStatus("Recording stopped!", "success");
}

function downloadRecording() {
  console.log("Downloading recording, chunks:", recordedChunks.length);

  if (recordedChunks.length === 0) {
    console.log("No recorded data to download");
    showStatus("No data recorded", "error");
    return;
  }

  // Generate WebVTT file with timestamp as steganographic message
  const now = new Date();
  const timestamp = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  // NOTE: Embedding VTT directly into WebM might not be universally supported for simple playback.
  // For robust metadata, consider a separate VTT file or more advanced muxing.
  // For now, let's keep the download simplified to just the video blob as the original content.js does.
  // The original content.js doesn't seem to combine VTT, so I'll revert to just video blob for consistency.
  // If you specifically want VTT, it would involve a more complex content script interaction or local file saving.

  const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });

  // Create download link
  const url = URL.createObjectURL(videoBlob);
  const filename = `tab-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

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
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const stopBtn = document.getElementById("stopBtn");
  const statusDiv = document.getElementById("status");
  const micToggle = document.getElementById("micToggle");

  if (isRecording) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-circle"></i> Recording...'; // Update with icon
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';

    if (isPaused) {
      pauseBtn.disabled = true;
      resumeBtn.disabled = false;
      statusDiv.textContent = "⏸️ Recording paused";
      statusDiv.className = "status paused" + (isMinimized ? " minimized" : "");
    } else {
      pauseBtn.disabled = false;
      resumeBtn.disabled = true;
      statusDiv.textContent = "🔴 Recording in progress";
      statusDiv.className = "status recording" + (isMinimized ? " minimized" : "");
    }
  } else {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    stopBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-play"></i> Start Recording'; // Update with icon
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Recording';
    resumeBtn.innerHTML = '<i class="fas fa-redo-alt"></i> Resume Recording';
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';

    if (statusDiv) {
      statusDiv.textContent = "Ready to record";
      statusDiv.className = "status" + (isMinimized ? " minimized" : "");
    }
  }

  micToggle.disabled = isRecording; // Disable mic toggle during recording

  // Update button minimized state (handled by CSS now with parent classes)
  // The 'minimized' class is added to the main containers (mainButtonContainer, secondaryActions)
  // and CSS rules will apply to the buttons inside them.
  // So, individual button minimized class toggling is largely unnecessary if parent class cascade is used.
  // Removed individual button class toggling here.
}

// Set loading state for buttons
function setButtonsLoading(loading) {
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (loading) {
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    stopBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...'; // Spinner icon
  }
  // updateUI() will be called after to set proper state
}

// Simplified status messages without animations
function showStatus(message, type = "info") {
  let statusDiv = document.getElementById("status");

  if (!statusDiv) {
    statusDiv = document.createElement("div");
    statusDiv.id = "status";
    document.querySelector(".container").appendChild(statusDiv);
  }

  statusDiv.textContent = message;
  statusDiv.className = `status ${type}` + (isMinimized ? " minimized" : "");

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

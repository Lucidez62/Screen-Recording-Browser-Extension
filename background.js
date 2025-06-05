// background.js - Simple service worker for extension lifecycle

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("🎥 Pro Tab Recorder installed");
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🎥 Pro Tab Recorder started");
});

// Clean up any recording state on extension startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove(['isRecording', 'startTime']);
});

// Optional: Listen for messages if needed later
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);
  
  switch (request.action) {
    case 'PING':
      console.log("Background script is alive");
      sendResponse({ status: "alive" });
      break;
      
    default:
      sendResponse({ status: "unknown_action" });
  }
});
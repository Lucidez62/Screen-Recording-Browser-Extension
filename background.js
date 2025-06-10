// background.js - Minimal service worker for extension lifecycle

chrome.runtime.onInstalled.addListener(() => {
  console.log("🎥 Pro Tab Recorder installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("🎥 Pro Tab Recorder started");
  chrome.storage.local.remove(['isRecording', 'startTime']);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);
  
  if (request.action === "SHOW_STATUS") {
    // Forward status messages to popup
    chrome.runtime.sendMessage(request);
    sendResponse({ status: "success" });
  } else {
    sendResponse({ status: "unknown_action" });
  }
  return true;
});

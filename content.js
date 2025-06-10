// content.js - Handles download in the page context

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DOWNLOAD_RECORDING") {
    try {
      // Convert base64 back to blob
      const byteCharacters = atob(request.base64data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'video/webm' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = request.filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      sendResponse({ status: "success" });
    } catch (error) {
      console.error("Download error:", error);
      sendResponse({ status: "error", error: error.message });
    }
  }
  return true;
});

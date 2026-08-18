// Service worker: owns tab-state tracking and message routing between
// the content script (per-page) and the sidebar UI.

chrome.runtime.onInstalled.addListener(() => {
  console.log("BrowserMind installed.");
});

// Toggle the sidebar when the toolbar icon is clicked.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" });
});

// Relay messages between content scripts and (future) sidebar/panel logic.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_OPEN_TABS") {
    chrome.tabs.query({}, (tabs) => {
      sendResponse(
        tabs.map((t) => ({ tab_id: t.id, url: t.url, title: t.title }))
      );
    });
    return true; // keep the message channel open for async sendResponse
  }
});

// Service worker: injects the sidebar script into the current tab when the
// toolbar icon is clicked (using activeTab permission, granted by that
// click), then toggles it open/closed. Also relays a couple of messages.

chrome.runtime.onInstalled.addListener(() => {
  console.log("BrowserMind installed.");
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  // Try toggling first - if content.js is already injected on this tab
  // (e.g. the icon was clicked before), this just works.
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" }, () => {
    if (chrome.runtime.lastError) {
      // Not injected yet on this tab/page - inject now using activeTab
      // permission (granted because the user just clicked the icon),
      // then open the sidebar.
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["src/content/content.js", "src/content/selection-toolbar.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.log("BrowserMind: could not run on this page.", chrome.runtime.lastError.message);
            return;
          }
          chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" });
        }
      );
    }
  });
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

// Service worker: injects the sidebar script into the current tab when the
// toolbar icon is clicked (using activeTab permission, granted by that
// click), then toggles it open/closed. Also relays a couple of messages.

chrome.runtime.onInstalled.addListener(() => {
  console.log("BrowserMind installed.");
});

// Shared by the toolbar-icon click and the keyboard shortcut below: try
// messaging content.js directly, and if it's not injected on this tab yet
// (chrome.runtime.lastError), inject it using activeTab permission - both
// an action click and a commands shortcut count as the user gesture that
// grants activeTab, so this works the same way either way.
function sendToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["src/content/content.js", "src/content/selection-toolbar.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.log("BrowserMind: could not run on this page.", chrome.runtime.lastError.message);
            return;
          }
          chrome.tabs.sendMessage(tabId, message);
        }
      );
    }
  });
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  sendToTab(tab.id, { type: "TOGGLE_SIDEBAR" });
});

// Ctrl+Shift+K (see manifest.json "commands") - opens the sidebar (if not
// already open) and focuses the chat input, for a quick question without
// reaching for the mouse.
chrome.commands.onCommand.addListener((command) => {
  if (command !== "quick-ask") return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    sendToTab(tab.id, { type: "OPEN_QUICK_ASK" });
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

  if (message.type === "OPEN_QUIZ_FROM_SELECTION") {
    chrome.storage.local
      .set({
        browsermindQuizTab: {
          tab_id: sender.tab?.id ?? 0,
          url: message.url,
          title: message.title,
          content_excerpt: message.text,
        },
      })
      .then(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL("src/quiz/quiz.html") });
      });
  }
});

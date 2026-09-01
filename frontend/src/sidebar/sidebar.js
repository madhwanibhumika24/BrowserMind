import { sendChatMessage, summarizeTabs } from "../utils/api.js";

const sessionId = crypto.randomUUID();
const chatLog = document.getElementById("chat-log");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");
const closeBtn = document.getElementById("close-btn");
const header = document.querySelector("header");

function appendMessage(text, who) {
  const el = document.createElement("div");
  el.className = `msg msg-${who}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function showLoading() {
  const el = document.createElement("div");
  el.className = "msg msg-assistant msg-loading";
  el.id = "loading-indicator";
  el.textContent = "BrowserMind is thinking...";
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function hideLoading() {
  document.getElementById("loading-indicator")?.remove();
}

async function handleSend() {
  const message = input.value.trim();
  if (!message) return;
  appendMessage(message, "user");
  input.value = "";
  showLoading();

  const [activeTab] = await new Promise((resolve) =>
    chrome.tabs.query({ active: true, currentWindow: true }, resolve)
  );

  try {
    const { reply } = await sendChatMessage({
      sessionId,
      message,
      activeTab: {
        tab_id: activeTab.id,
        url: activeTab.url,
        title: activeTab.title,
      },
      openTabs: [],
    });
    hideLoading();
    appendMessage(reply, "assistant");
  } catch (err) {
    hideLoading();
    appendMessage("BrowserMind backend isn't reachable yet.", "assistant");
  }
}

function formatGroupsAsText(groups) {
  const lines = [];
  for (const category in groups) {
    const tabsInGroup = groups[category];
    if (tabsInGroup.length === 0) continue;
    const titles = tabsInGroup.map((t) => t.title).join(", ");
    lines.push(`${category} (${tabsInGroup.length}): ${titles}`);
  }
  return lines.length ? lines.join("\n") : "No tabs to summarize.";
}

async function handleSummarize() {
  const tabs = await new Promise((resolve) => chrome.tabs.query({}, resolve));
  const tabList = tabs.map((t) => ({ tab_id: t.id, url: t.url, title: t.title }));

  try {
    const result = await summarizeTabs(tabList);
    appendMessage(formatGroupsAsText(result.groups), "assistant");
  } catch (err) {
    appendMessage("Could not summarize tabs right now.", "assistant");
  }
}

sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
summarizeBtn.addEventListener("click", handleSummarize);
closeBtn.addEventListener("click", () => {
  window.parent.postMessage({ type: "BROWSERMIND_CLOSE" }, "*");
});

// Let the user drag the panel around by its header. The actual moving of
// the iframe happens in content.js (the parent page) - we just tell it
// where on the header the mouse grabbed on.
header.addEventListener("mousedown", (e) => {
  if (e.target.closest("button")) return; // don't drag when clicking icons
  window.parent.postMessage(
    { type: "BROWSERMIND_DRAG_START", offsetX: e.clientX, offsetY: e.clientY },
    "*"
  );
});

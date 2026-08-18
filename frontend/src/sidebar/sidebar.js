import { sendChatMessage, summarizeTabs } from "../utils/api.js";

const sessionId = crypto.randomUUID();
const chatLog = document.getElementById("chat-log");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");

function appendMessage(text, who) {
  const el = document.createElement("div");
  el.className = `msg msg-${who}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function handleSend() {
  const message = input.value.trim();
  if (!message) return;
  appendMessage(message, "user");
  input.value = "";

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
    appendMessage(reply, "assistant");
  } catch (err) {
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

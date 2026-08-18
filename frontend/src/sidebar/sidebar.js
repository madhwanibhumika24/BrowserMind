import { sendChatMessage } from "../utils/api.js";

const sessionId = crypto.randomUUID();
const chatLog = document.getElementById("chat-log");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

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

sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

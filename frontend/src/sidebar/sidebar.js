import { sendChatMessage, summarizeTabs, generateSummary } from "../utils/api.js";

const sessionId = crypto.randomUUID();
const chatLog = document.getElementById("chat-log");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");
const quizBtn = document.getElementById("quiz-btn");
const closeBtn = document.getElementById("close-btn");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatReply(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

function appendMessage(text, who) {
  const el = document.createElement("div");
  el.className = `msg msg-${who}`;
  if (who === "assistant") {
    el.innerHTML = formatReply(text);
  } else {
    el.textContent = text;
  }
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

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab));
  });
}

function getPageExcerpt(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_EXCERPT" }, (result) => {
      resolve(chrome.runtime.lastError ? "" : result);
    });
  });
}

function renderSuggestions(questions) {
  const el = document.createElement("div");
  el.className = "suggestions";
  questions.forEach((question) => {
    const pill = document.createElement("button");
    pill.className = "suggestion-pill";
    pill.textContent = question;
    pill.addEventListener("click", () => sendChat(question));
    el.appendChild(pill);
  });
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChat(message) {
  appendMessage(message, "user");
  showLoading();

  const activeTab = await getActiveTab();
  const excerpt = await getPageExcerpt(activeTab.id);

  try {
    const { reply } = await sendChatMessage({
      sessionId,
      message,
      activeTab: {
        tab_id: activeTab.id,
        url: activeTab.url,
        title: activeTab.title,
        content_excerpt: excerpt,
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

async function handleSend() {
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  await sendChat(message);
}

async function autoSummarizePage() {
  showLoading();
  const activeTab = await getActiveTab();
  const excerpt = await getPageExcerpt(activeTab.id);

  try {
    const { summary, questions } = await generateSummary({
      tab_id: activeTab.id,
      url: activeTab.url,
      title: activeTab.title,
      content_excerpt: excerpt,
    });
    hideLoading();
    appendMessage(summary, "assistant");
    renderSuggestions(questions);
  } catch (err) {
    hideLoading();
    appendMessage("Ask me anything about this page.", "assistant");
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

async function handleQuiz() {
  const activeTab = await getActiveTab();
  const excerpt = await getPageExcerpt(activeTab.id);

  await chrome.storage.local.set({
    browsermindQuizTab: {
      tab_id: activeTab.id,
      url: activeTab.url,
      title: activeTab.title,
      content_excerpt: excerpt,
    },
  });

  chrome.tabs.create({ url: chrome.runtime.getURL("src/quiz/quiz.html") });
}

sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
summarizeBtn.addEventListener("click", handleSummarize);
quizBtn.addEventListener("click", handleQuiz);
closeBtn.addEventListener("click", () => {
  window.parent.postMessage({ type: "BROWSERMIND_CLOSE" }, "*");
});

autoSummarizePage();

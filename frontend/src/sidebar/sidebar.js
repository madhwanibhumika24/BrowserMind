import {
  sendChatMessage,
  summarizeTabs,
  generateSummary,
  getMemory,
  deleteMemory,
} from "../utils/api.js";

// sessionId and historyMessages can both get replaced once we restore a
// saved chat for this site (see restoreHistory below), so they're `let`.
let sessionId = crypto.randomUUID();
let historyMessages = [];
let chatKey = null; // set once we know which site's chat this is

const chatLog = document.getElementById("chat-log");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const summarizeBtn = document.getElementById("summarize-btn");
const quizBtn = document.getElementById("quiz-btn");
const memoryBtn = document.getElementById("memory-btn");
const memoryPanel = document.getElementById("memory-panel");
const memoryList = document.getElementById("memory-list");
const memoryRefreshBtn = document.getElementById("memory-refresh-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const closeBtn = document.getElementById("close-btn");
const summaryCta = document.getElementById("summary-cta");
const summaryCtaBtn = document.getElementById("summary-cta-btn");

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

// Just draws a message bubble - does not save it. Used both for new
// messages and for redrawing messages restored from storage.
function renderMessage(text, who) {
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

// Draws a new message AND saves it, so the conversation survives closing
// and reopening the sidebar on this site.
function appendMessage(text, who) {
  renderMessage(text, who);
  historyMessages.push({ text, who });
  saveHistory();
}

function saveHistory() {
  if (!chatKey) return;
  // Keep only the most recent messages so storage doesn't grow forever.
  historyMessages = historyMessages.slice(-60);
  chrome.storage.local.set({ [chatKey]: { sessionId, messages: historyMessages } });
}

async function getSiteChatKey() {
  const activeTab = await getActiveTab();
  let hostname = "default";
  try {
    hostname = new URL(activeTab.url).hostname || "default";
  } catch (err) {
    hostname = "default";
  }
  return `browsermindChat_${hostname}`;
}

async function restoreHistory() {
  chatKey = await getSiteChatKey();
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(chatKey, (result) => resolve(result[chatKey]));
  });

  if (stored && Array.isArray(stored.messages) && stored.messages.length) {
    sessionId = stored.sessionId || sessionId;
    historyMessages = stored.messages;
    historyMessages.forEach(({ text, who }) => renderMessage(text, who));
    summaryCta.classList.add("hidden");
  }
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

async function sendChat(message, displayText) {
  summaryCta.classList.add("hidden");
  appendMessage(displayText || message, "user");
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

async function summarizePage() {
  summaryCta.classList.add("hidden");
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

const THEME_KEY = "browsermindTheme";
const SUN_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const MOON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

// Shows the icon for the mode you'd SWITCH TO, not the current mode -
// that's the usual convention for a theme toggle button.
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
  themeToggleBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

async function loadTheme() {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(THEME_KEY, (result) => resolve(result[THEME_KEY]));
  });
  applyTheme(stored || "dark");
}

themeToggleBtn.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.local.set({ [THEME_KEY]: next });
});

function truncate(text, maxLen = 110) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

async function loadMemory() {
  memoryList.innerHTML = `<p class="memory-empty">Loading...</p>`;

  try {
    const items = await getMemory(sessionId);
    renderMemoryItems(items);
  } catch (err) {
    memoryList.innerHTML = `<p class="memory-empty">Could not load memory right now.</p>`;
  }
}

function renderMemoryItems(items) {
  memoryList.innerHTML = "";

  if (!items.length) {
    memoryList.innerHTML = `<p class="memory-empty">Nothing remembered yet for this chat.</p>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "memory-item";

    const source = document.createElement("span");
    source.className = "memory-item-source";
    source.textContent = item.source === "user" ? "You" : "BrowserMind";
    row.appendChild(source);

    const content = document.createElement("p");
    content.className = "memory-item-content";
    content.textContent = truncate(item.content);
    content.title = item.content;
    row.appendChild(content);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "memory-item-delete";
    deleteBtn.title = "Forget this";
    deleteBtn.textContent = "×";
    deleteBtn.addEventListener("click", async () => {
      try {
        await deleteMemory(item.id);
        row.remove();
        if (!memoryList.children.length) {
          memoryList.innerHTML = `<p class="memory-empty">Nothing remembered yet for this chat.</p>`;
        }
      } catch (err) {
        // If delete fails, leave the item in place rather than lying about it.
      }
    });
    row.appendChild(deleteBtn);

    memoryList.appendChild(row);
  });
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
memoryBtn.addEventListener("click", () => {
  memoryPanel.classList.toggle("hidden");
  if (!memoryPanel.classList.contains("hidden")) loadMemory();
});
memoryRefreshBtn.addEventListener("click", loadMemory);
clearChatBtn.addEventListener("click", () => {
  chatLog.innerHTML = "";
  historyMessages = [];
  sessionId = crypto.randomUUID();
  saveHistory();
  summaryCta.classList.remove("hidden");
  memoryPanel.classList.add("hidden");
});
closeBtn.addEventListener("click", () => {
  window.parent.postMessage({ type: "BROWSERMIND_CLOSE" }, "*");
});
summaryCtaBtn.addEventListener("click", summarizePage);

window.addEventListener("message", (event) => {
  if (event.data?.type === "BROWSERMIND_QUICK_ASK") {
    sendChat(event.data.query, event.data.label);
  }
});

loadTheme();
restoreHistory();

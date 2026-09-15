import {
  sendChatMessage,
  summarizeTabs,
  generateSummary,
  getMemory,
  deleteMemory,
} from "../utils/api.js";
import { signInWithGoogle, signOut, getStoredAuth } from "../utils/auth.js";

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
const homeBtn = document.getElementById("home-btn");
const memoryBtn = document.getElementById("memory-btn");
const memoryView = document.getElementById("memory-view");
const memoryBackBtn = document.getElementById("memory-back-btn");
const memoryList = document.getElementById("memory-list");
const memoryRefreshBtn = document.getElementById("memory-refresh-btn");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const closeBtn = document.getElementById("close-btn");
const logoIcon = document.querySelector(".logo-icon");
const homeView = document.getElementById("home-view");
const homeSummarizeBtn = document.getElementById("home-summarize-btn");
const homeTabsBtn = document.getElementById("home-tabs-btn");
const homeQuizBtn = document.getElementById("home-quiz-btn");
const homeMemoryBtn = document.getElementById("home-memory-btn");
const homeFormsBtn = document.getElementById("home-forms-btn");
const formsBtn = document.getElementById("forms-btn");
const homeNewChatBtn = document.getElementById("home-newchat-btn");
const homeGreetingName = document.getElementById("home-greeting-name");
const authGate = document.getElementById("auth-gate");
const googleLoginBtn = document.getElementById("google-login-btn");
const googleSignupBtn = document.getElementById("google-signup-btn");
const accountBtn = document.getElementById("account-btn");
const accountPanel = document.getElementById("account-panel");
const accountPanelAvatar = document.getElementById("account-panel-avatar");
const accountName = document.getElementById("account-name");
const accountEmail = document.getElementById("account-email");
const signOutBtn = document.getElementById("sign-out-btn");
const moreToolsBtn = document.getElementById("more-tools-btn");
const moreToolsPanel = document.getElementById("more-tools-panel");
const morePdfToolsBtn = document.getElementById("more-pdf-tools-btn");
const moreChatDocBtn = document.getElementById("more-chat-doc-btn");
const moreTextToolsBtn = document.getElementById("more-text-tools-btn");
const moreMindmapBtn = document.getElementById("more-mindmap-btn");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Turns the handful of markdown the model actually uses (headers, bold,
// italics, inline code, bullet/numbered lists, --- rules) into real HTML
// instead of dumping literal "###"/"**"/"* " characters into the bubble.
// Deliberately small and regex-based rather than pulling in a markdown
// library - extensions can't load remotely-hosted code, and this covers
// everything the assistant's replies (summaries, definitions, explanations,
// quiz feedback, etc.) actually produce.
function formatInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  return html;
}

function formatReply(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let listType = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${paragraph.join("<br>")}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      out.push(`<div class="msg-h${heading[1].length}">${formatInline(heading[2])}</div>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph();
      closeList();
      out.push("<hr>");
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${formatInline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${formatInline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(formatInline(line));
  }
  flushParagraph();
  closeList();

  return out.join("");
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

// Home, the chat log, and Memory are three mutually exclusive full views in
// the same space - showing one always hides the other two, so you never
// end up looking at two screens stacked on top of each other at once
// (which is what the old toggle-a-panel-open-on-top-of-whatever's-already-
// showing approach used to do for Memory).
const VIEWS = { home: homeView, chat: chatLog, memory: memoryView };

function showView(name) {
  for (const [key, el] of Object.entries(VIEWS)) {
    el.classList.toggle("hidden", key !== name);
  }
  accountPanel.classList.add("hidden");
}

// Swaps the "What can I do for you?" home screen out for the chat log -
// called the moment there's actually a conversation to show.
function showChatLog() {
  showView("chat");
}

// Swaps back to the home screen - used when starting a fresh chat.
function showHomeView() {
  showView("home");
}

// Same swap, but doesn't touch the conversation - just navigation back to
// the home screen, for when you want to leave without starting over.
function goHome() {
  showView("home");
}

// Switches to the Memory view and kicks off a fresh load every time - it's
// no longer a toggle-open/toggle-closed panel, so "open" always means a
// clean, up-to-date list rather than whatever was last loaded.
function openMemoryView() {
  showView("memory");
  loadMemory();
}

// Draws a new message AND saves it, so the conversation survives closing
// and reopening the sidebar on this site.
function appendMessage(text, who) {
  renderMessage(text, who);
  historyMessages.push({ text, who });
  saveHistory();
  if (who === "assistant") pulseLogo();
}

// Shows a message WITHOUT saving it to this site's persisted history. Used
// for one-off action feedback (e.g. "Could not summarize tabs right now")
// that isn't part of an actual back-and-forth - if we saved these, a single
// failed click (backend briefly down, etc.) would get stuck as the first
// thing you see every time you reopen the sidebar on that site, forever,
// even after the backend is back up. Real conversation turns (typed
// questions and their replies) still persist via appendMessage above.
function appendTransient(text, who) {
  renderMessage(text, who);
  if (who === "assistant") pulseLogo();
}

function pulseLogo() {
  // Restart the animation even if it's already mid-pulse from a fast
  // follow-up reply: remove the class, force a reflow, then re-add it.
  logoIcon.classList.remove("logo-pulse");
  void logoIcon.offsetWidth;
  logoIcon.classList.add("logo-pulse");
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
    showChatLog();
  }
}

function showLoading() {
  const el = document.createElement("div");
  el.className = "msg msg-assistant msg-loading";
  el.id = "loading-indicator";
  el.innerHTML = `
    <span class="thinking-dots">
      <span></span><span></span><span></span>
    </span>
  `;
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
  showChatLog();
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
  showChatLog();
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
    appendTransient("Ask me anything about this page.", "assistant");
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

const authErrorEl = document.getElementById("auth-error");

function showSignedIn(auth) {
  authGate.classList.add("hidden");
  document.body.classList.remove("signed-out");
  accountName.textContent = auth.name || "Signed in";
  accountEmail.textContent = auth.email || "";

  const initial = (auth.name || auth.email || "?").trim().charAt(0);
  accountBtn.textContent = initial;
  accountPanelAvatar.textContent = initial;

  const firstName = (auth.name || "").split(" ")[0];
  homeGreetingName.textContent = firstName ? `, ${firstName}` : "";
}

async function checkAuth() {
  const auth = await getStoredAuth();
  if (auth?.token) {
    showSignedIn(auth);
  } else {
    authGate.classList.remove("hidden");
    document.body.classList.add("signed-out");
  }
}

// Log In and Sign Up both go through the exact same Google Sign-In flow -
// the backend decides whether that Google account is new (sign-up) or
// returning (log-in) via find_or_create_user. Two buttons just match the
// familiar convention; there's only one auth path underneath.
async function handleGoogleAuth() {
  authErrorEl.classList.add("hidden");
  googleLoginBtn.disabled = true;
  googleSignupBtn.disabled = true;
  try {
    const auth = await signInWithGoogle();
    showSignedIn(auth);
  } catch (err) {
    console.error("BrowserMind sign-in error:", err);
    authErrorEl.textContent = `Sign-in failed: ${err.message}`;
    authErrorEl.classList.remove("hidden");
  } finally {
    googleLoginBtn.disabled = false;
    googleSignupBtn.disabled = false;
  }
}

googleLoginBtn.addEventListener("click", handleGoogleAuth);
googleSignupBtn.addEventListener("click", handleGoogleAuth);

function toggleAccountPanel() {
  accountPanel.classList.toggle("hidden");
}

accountBtn.addEventListener("click", toggleAccountPanel);

const signOutLabel = signOutBtn.querySelector(".account-panel-item-label");

signOutBtn.addEventListener("click", async () => {
  // Give immediate feedback instead of the panel just sitting there while
  // signOut()'s network call is in flight - and stop a second click from
  // firing a second sign-out while the first is still running.
  signOutBtn.disabled = true;
  if (signOutLabel) signOutLabel.textContent = "Logging out...";

  try {
    await signOut();
  } finally {
    accountPanel.classList.add("hidden");
    authGate.classList.remove("hidden");
    document.body.classList.add("signed-out");
    signOutBtn.disabled = false;
    if (signOutLabel) signOutLabel.textContent = "Sign out";
  }
});

function truncate(text, maxLen = 110) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

// Builds one of the "nothing to show" states (loading / empty / error) as
// an icon + title + short explanation, instead of a single line of text
// left floating in an otherwise blank panel.
function renderEmptyState(container, { icon, danger, title, text, retry }) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "bm-empty-state";

  const iconEl = document.createElement("div");
  iconEl.className = danger ? "bm-empty-icon danger" : "bm-empty-icon";
  iconEl.innerHTML = icon;
  wrap.appendChild(iconEl);

  const titleEl = document.createElement("p");
  titleEl.className = "bm-empty-title";
  titleEl.textContent = title;
  wrap.appendChild(titleEl);

  if (text) {
    const textEl = document.createElement("p");
    textEl.className = "bm-empty-text";
    textEl.textContent = text;
    wrap.appendChild(textEl);
  }

  if (retry) {
    const retryBtn = document.createElement("button");
    retryBtn.className = "bm-empty-retry";
    retryBtn.textContent = "Try again";
    retryBtn.addEventListener("click", retry);
    wrap.appendChild(retryBtn);
  }

  container.appendChild(wrap);
}

const MEMORY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
const WARNING_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L2.8 17a1.8 1.8 0 0 0 1.5 2.7h15.4a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z"/></svg>';

async function loadMemory() {
  memoryList.innerHTML = `<div class="bm-empty-state"><span class="bm-mini-spinner"></span><p class="bm-empty-title">Loading memory...</p></div>`;

  try {
    const items = await getMemory(sessionId);
    renderMemoryItems(items);
  } catch (err) {
    renderEmptyState(memoryList, {
      icon: WARNING_ICON,
      danger: true,
      title: "Could not load memory",
      text: "The BrowserMind backend didn't respond. Make sure it's running, then try again.",
      retry: loadMemory,
    });
  }
}

function renderMemoryItems(items) {
  memoryList.innerHTML = "";

  if (!items.length) {
    renderEmptyState(memoryList, {
      icon: MEMORY_ICON,
      title: "Nothing remembered yet",
      text: "As you chat on this site, key details will show up here for next time.",
    });
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
          renderEmptyState(memoryList, {
            icon: MEMORY_ICON,
            title: "Nothing remembered yet",
            text: "As you chat on this site, key details will show up here for next time.",
          });
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
  showChatLog();
  const tabs = await new Promise((resolve) => chrome.tabs.query({}, resolve));
  const tabList = tabs.map((t) => ({ tab_id: t.id, url: t.url, title: t.title }));

  try {
    const result = await summarizeTabs(tabList);
    appendMessage(formatGroupsAsText(result.groups), "assistant");
  } catch (err) {
    appendTransient("Could not summarize tabs right now.", "assistant");
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

// Reuses an already-open Forms tab instead of stacking up a new one every
// time - clicking "Create form" repeatedly (e.g. while testing) used to
// leave a trail of duplicate BrowserMind Forms tabs behind.
async function openFormGenerator() {
  const url = chrome.runtime.getURL("src/forms/form-generator.html");
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    chrome.tabs.update(existing.id, { active: true });
    chrome.windows.update(existing.windowId, { focused: true });
  } else {
    chrome.tabs.create({ url });
  }
}

function openPdfTools() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/pdf-tools/pdf-tools.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

function openDocumentChat() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/document-chat/document-chat.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

function openTextTools() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/text-tools/text-tools.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

function openMindmap() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/mindmap/mindmap.html") });
  moreToolsPanel.classList.add("hidden");
  moreToolsBtn.classList.remove("active");
}

sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});
summarizeBtn.addEventListener("click", handleSummarize);
quizBtn.addEventListener("click", handleQuiz);
memoryBtn.addEventListener("click", openMemoryView);
memoryBackBtn.addEventListener("click", goHome);
memoryRefreshBtn.addEventListener("click", loadMemory);

function startNewChat() {
  chatLog.innerHTML = "";
  historyMessages = [];
  sessionId = crypto.randomUUID();
  saveHistory();
  showHomeView();
}

clearChatBtn.addEventListener("click", startNewChat);
homeNewChatBtn.addEventListener("click", startNewChat);
formsBtn.addEventListener("click", openFormGenerator);
homeFormsBtn.addEventListener("click", openFormGenerator);

moreToolsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  moreToolsPanel.classList.toggle("hidden");
  moreToolsBtn.classList.toggle("active", !moreToolsPanel.classList.contains("hidden"));
});
morePdfToolsBtn.addEventListener("click", openPdfTools);
moreChatDocBtn.addEventListener("click", openDocumentChat);
moreTextToolsBtn.addEventListener("click", openTextTools);
moreMindmapBtn.addEventListener("click", openMindmap);
document.addEventListener("click", (e) => {
  if (!moreToolsPanel.classList.contains("hidden") && !e.target.closest(".side-rail-more")) {
    moreToolsPanel.classList.add("hidden");
    moreToolsBtn.classList.remove("active");
  }
});

homeBtn.addEventListener("click", goHome);
logoIcon.addEventListener("click", goHome);
closeBtn.addEventListener("click", () => {
  window.parent.postMessage({ type: "BROWSERMIND_CLOSE" }, "*");
});
homeSummarizeBtn.addEventListener("click", summarizePage);
homeTabsBtn.addEventListener("click", handleSummarize);
homeQuizBtn.addEventListener("click", handleQuiz);
homeMemoryBtn.addEventListener("click", openMemoryView);

window.addEventListener("message", (event) => {
  if (event.data?.type === "BROWSERMIND_QUICK_ASK") {
    sendChat(event.data.query, event.data.label);
  }
  if (event.data?.type === "BROWSERMIND_FOCUS_INPUT") {
    input.focus();
  }
});

loadTheme();
checkAuth();
restoreHistory();

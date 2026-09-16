import {
  uploadDocument,
  chatWithDocument,
  listDocumentChats,
  getDocumentMessages,
  deleteDocumentChat,
} from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";
import { formatReply } from "../utils/markdown.js";

applyStoredTheme();

const uploadView = document.getElementById("upload-view");
const chatView = document.getElementById("chat-view");

const newChatBtn = document.getElementById("new-chat-btn");
const docHistoryList = document.getElementById("doc-history-list");
const backToAppBtn = document.getElementById("back-to-app-btn");
const docSidebar = document.getElementById("doc-history");
const sidebarResizeHandle = document.getElementById("sidebar-resize-handle");

// Same pattern as the Forms page's "Back to BrowserMind" button - this tab
// was opened via chrome.tabs.create, so closing it returns the user to
// whatever page they were on, where the actual extension sidebar lives.
backToAppBtn.addEventListener("click", () => window.close());

// Drag-to-resize the history sidebar (240px-550px). The sidebar sits flush
// against the left edge, so the pointer's x position while dragging IS the
// new width - no offset math needed.
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 550;

sidebarResizeHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();
  sidebarResizeHandle.classList.add("resizing");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  function onMouseMove(moveEvent) {
    const width = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, moveEvent.clientX));
    docSidebar.style.width = `${width}px`;
  }

  function onMouseUp() {
    sidebarResizeHandle.classList.remove("resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
});

const docFileInput = document.getElementById("doc-file-input");
const docDropzoneText = document.getElementById("doc-dropzone-text");
const docFileList = document.getElementById("doc-file-list");
const uploadBtn = document.getElementById("upload-btn");
const uploadError = document.getElementById("upload-error");

const docFilename = document.getElementById("doc-filename");
const changeDocBtn = document.getElementById("change-doc-btn");
const docScopeWrap = document.getElementById("doc-scope-wrap");
const docScopeSelect = document.getElementById("doc-scope-select");
const summarizeBtn = document.getElementById("summarize-btn");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

let currentDocument = null; // { id, filename }
let currentDocumentFiles = []; // original filenames from the upload that started this session
let history = []; // [{ role, content }]
let selectedFiles = []; // accumulated across multiple picks, like the Merge PDF tool

// ---- Chat history sidebar (like Claude/ChatGPT's list of past threads) ----
// Every DocumentRow already IS a chat thread (see backend docs on
// DocumentChatMessageRow) - no separate "session" concept needed here.

function timeAgo(isoString) {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function renderHistoryList(docs) {
  if (!docs.length) {
    docHistoryList.innerHTML = `<div class="doc-history-empty">No past chats yet - upload a document to start one.</div>`;
    return;
  }

  docHistoryList.innerHTML = docs
    .map(
      (doc) => `
      <div class="doc-history-item ${currentDocument?.id === doc.id ? "active" : ""}" data-id="${doc.id}">
        <div class="doc-history-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="doc-history-item-main">
          <div class="doc-history-item-title">${escapeHtml(doc.filename)}</div>
          <div class="doc-history-item-time">${timeAgo(doc.created_at)}</div>
        </div>
        <button type="button" class="doc-history-item-delete" data-id="${doc.id}" title="Delete chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`
    )
    .join("");

  docHistoryList.querySelectorAll(".doc-history-item").forEach((el) => {
    el.addEventListener("click", () => openHistoryChat(el.dataset.id, docs));
  });
  docHistoryList.querySelectorAll(".doc-history-item-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteChat(btn.dataset.id);
    });
  });
}

async function loadHistory() {
  try {
    const docs = await listDocumentChats();
    renderHistoryList(docs);
  } catch (err) {
    docHistoryList.innerHTML = `<div class="doc-history-empty">Couldn't load chat history.</div>`;
  }
}

async function openHistoryChat(documentId, docs) {
  if (currentDocument?.id === documentId) return; // already open

  const doc = docs.find((d) => d.id === documentId);
  if (!doc) return;

  try {
    const messages = await getDocumentMessages(documentId);

    currentDocument = { id: doc.id, filename: doc.filename };
    // The exact original filenames aren't kept individually server-side
    // (only the combined display name) - the scope dropdown only matters
    // for a session still being actively built up, so it just stays
    // hidden on a reopened thread rather than guessing at names.
    currentDocumentFiles = [];
    selectedFiles = [];
    history = messages.map((m) => ({ role: m.role, content: m.content }));

    startChatView();
    chatLog.innerHTML = "";
    if (!messages.length) {
      chatLog.innerHTML = `<p class="chat-empty">Ask anything about this document to get started.</p>`;
    } else {
      messages.forEach((m) => appendBubble(m.role, m.content));
    }

    renderHistoryList(docs);
  } catch (err) {
    docHistoryList.insertAdjacentHTML(
      "afterbegin",
      `<div class="doc-history-empty">${escapeHtml(err.message || "Could not open that chat.")}</div>`
    );
  }
}

async function handleDeleteChat(documentId) {
  if (!confirm("Delete this chat? This can't be undone.")) return;

  try {
    await deleteDocumentChat(documentId);
    if (currentDocument?.id === documentId) {
      resetToUpload(); // also reloads the sidebar
    } else {
      await loadHistory();
    }
  } catch (err) {
    alert(err.message || "Could not delete that chat.");
  }
}

function resetToUpload() {
  currentDocument = null;
  currentDocumentFiles = [];
  history = [];
  selectedFiles = [];
  docFileInput.value = "";
  renderFileList();
  chatView.classList.add("hidden");
  uploadView.classList.remove("hidden");
  loadHistory(); // clears the "active" highlight in the sidebar
}

newChatBtn.addEventListener("click", resetToUpload);

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderFileList() {
  if (!selectedFiles.length) {
    docFileList.innerHTML = "";
    docDropzoneText.textContent = "Click to upload";
    return;
  }

  docDropzoneText.textContent = `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`;
  docFileList.innerHTML = selectedFiles
    .map(
      (f, i) => `
      <div class="doc-file-item">
        <span>${i + 1}. ${escapeHtml(f.name)}</span>
        <button type="button" class="doc-file-remove" data-index="${i}" title="Remove">✕</button>
      </div>`
    )
    .join("");

  docFileList.querySelectorAll(".doc-file-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFiles.splice(Number(btn.dataset.index), 1);
      renderFileList();
    });
  });
}

docFileInput.addEventListener("change", () => {
  selectedFiles = selectedFiles.concat(Array.from(docFileInput.files));
  docFileInput.value = ""; // allow re-adding a file if it was removed
  renderFileList();
});

function resetUploadBtn() {
  uploadBtn.disabled = false;
  uploadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Start chatting`;
}

uploadBtn.addEventListener("click", async () => {
  uploadError.classList.add("hidden");
  if (!selectedFiles.length) {
    uploadError.textContent = "Choose a PDF, Word, or PowerPoint file first.";
    uploadError.classList.remove("hidden");
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    currentDocumentFiles = selectedFiles.map((f) => f.name);
    currentDocument = await uploadDocument(selectedFiles);
    history = [];
    startChatView();
    loadHistory(); // new thread shows up in the sidebar, marked active
  } catch (err) {
    uploadError.textContent = err.message || "Could not read that file - try again.";
    uploadError.classList.remove("hidden");
  } finally {
    resetUploadBtn();
  }
});

// The scope dropdown only makes sense with more than one document in this
// session - with a single file "All documents" and "just this one" mean
// the same thing, so it stays hidden and every question is unscoped.
function populateScopeSelect() {
  if (currentDocumentFiles.length > 1) {
    docScopeSelect.innerHTML =
      `<option value="__all__">All documents</option>` +
      currentDocumentFiles.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    docScopeWrap.classList.remove("hidden");
  } else {
    docScopeWrap.classList.add("hidden");
  }
}

function startChatView() {
  uploadView.classList.add("hidden");
  chatView.classList.remove("hidden");
  docFilename.textContent = currentDocument.filename;
  populateScopeSelect();
  chatLog.innerHTML = `<p class="chat-empty">Ask anything about this document to get started.</p>`;
  chatInput.value = "";
  chatInput.focus();
}

changeDocBtn.addEventListener("click", resetToUpload);

const ASSISTANT_AVATAR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 15a4 4 0 0 0 7 0"/></svg>';
const USER_AVATAR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>';

// Assistant replies are rendered through formatReply (markdown -> HTML, see
// ../utils/markdown.js) so headings/lists/bold/code show up properly instead
// of raw "**"/"#" characters. User messages are the user's own typed text,
// so they're kept as plain textContent - no formatting to apply and no need
// to touch innerHTML for them. Each turn is an avatar + bubble row (see
// .chat-row in document-chat.css) rather than a bare floating bubble.
function appendBubble(role, content) {
  const empty = chatLog.querySelector(".chat-empty");
  if (empty) empty.remove();

  const isAssistant = role.startsWith("assistant");

  const row = document.createElement("div");
  row.className = `chat-row ${isAssistant ? "assistant" : "user"}`;

  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.innerHTML = isAssistant ? ASSISTANT_AVATAR_SVG : USER_AVATAR_SVG;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  setBubbleContent(bubble, role, content);

  row.append(avatar, bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

function setBubbleContent(bubble, role, content) {
  if (role.startsWith("assistant")) {
    bubble.innerHTML = formatReply(content);
  } else {
    bubble.textContent = content;
  }
}

// When a specific document is picked in the scope dropdown, layer a plain-
// language instruction onto the outgoing question so the model narrows its
// answer to that document - the retrieval step still searches across all
// of them, but this tells it which source to actually answer from.
function applyScopeInstruction(message) {
  if (docScopeWrap.classList.contains("hidden")) return message;
  const scope = docScopeSelect.value;
  if (!scope || scope === "__all__") return message;
  return `Only use the document titled "${scope}" (ignore the other uploaded documents) to answer this: ${message}`;
}

// Shared by both the typed chat input and the Summarize quick action.
// `displayText` is what shows in the user's bubble - `apiText` (defaults to
// the same thing) is what's actually sent, so a quick action can show a
// short bubble ("Summarize this document") while sending a fuller
// instruction behind the scenes.
async function sendMessage(displayText, apiText = displayText) {
  if (!displayText || !currentDocument) return;

  appendBubble("user", displayText);
  const outgoing = applyScopeInstruction(apiText);

  sendBtn.disabled = true;
  summarizeBtn.disabled = true;
  const pending = appendBubble("assistant pending", "Thinking...");

  try {
    const { reply } = await chatWithDocument(currentDocument.id, outgoing, history);
    setBubbleContent(pending, "assistant", reply);
    pending.classList.remove("pending");
    history.push({ role: "user", content: displayText });
    history.push({ role: "assistant", content: reply });
    loadHistory(); // this thread just became the most recently active - move it to the top
  } catch (err) {
    // Show the backend's actual reason (e.g. rate-limited, document not
    // found) when there is one, instead of always the same generic line.
    setBubbleContent(pending, "assistant", err.message || "Something went wrong getting a reply - try again.");
    pending.classList.remove("pending");
  } finally {
    sendBtn.disabled = false;
    summarizeBtn.disabled = false;
    chatInput.focus();
  }
}

async function handleSend() {
  const message = chatInput.value.trim();
  if (!message) return;
  chatInput.value = "";
  await sendMessage(message);
}

summarizeBtn.addEventListener("click", () => {
  if (!currentDocument) return;
  const scoped = !docScopeWrap.classList.contains("hidden") && docScopeSelect.value !== "__all__";
  const displayText = scoped ? `Summarize "${docScopeSelect.value}"` : "Summarize this document";
  sendMessage(
    displayText,
    "Give me a clean, well-organized summary of this document - short paragraphs, and bullet points for the key points where that reads better than prose."
  );
});

sendBtn.addEventListener("click", handleSend);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

loadHistory();

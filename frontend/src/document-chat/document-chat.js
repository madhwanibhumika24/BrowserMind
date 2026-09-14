import { uploadDocument, chatWithDocument } from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const uploadView = document.getElementById("upload-view");
const chatView = document.getElementById("chat-view");

const docFileInput = document.getElementById("doc-file-input");
const docDropzoneText = document.getElementById("doc-dropzone-text");
const uploadBtn = document.getElementById("upload-btn");
const uploadError = document.getElementById("upload-error");

const docFilename = document.getElementById("doc-filename");
const changeDocBtn = document.getElementById("change-doc-btn");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

let currentDocument = null; // { id, filename }
let history = []; // [{ role, content }]

docFileInput.addEventListener("change", () => {
  docDropzoneText.textContent = docFileInput.files[0]?.name || "Click to upload";
});

function resetUploadBtn() {
  uploadBtn.disabled = false;
  uploadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Start chatting`;
}

uploadBtn.addEventListener("click", async () => {
  uploadError.classList.add("hidden");
  const file = docFileInput.files[0];
  if (!file) {
    uploadError.textContent = "Choose a PDF, Word, or PowerPoint file first.";
    uploadError.classList.remove("hidden");
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    currentDocument = await uploadDocument(file);
    history = [];
    startChatView();
  } catch (err) {
    uploadError.textContent = "Could not read that file - try again.";
    uploadError.classList.remove("hidden");
  } finally {
    resetUploadBtn();
  }
});

function startChatView() {
  uploadView.classList.add("hidden");
  chatView.classList.remove("hidden");
  docFilename.textContent = currentDocument.filename;
  chatLog.innerHTML = `<p class="chat-empty">Ask anything about this document to get started.</p>`;
  chatInput.value = "";
  chatInput.focus();
}

changeDocBtn.addEventListener("click", () => {
  currentDocument = null;
  history = [];
  docFileInput.value = "";
  docDropzoneText.textContent = "Click to upload";
  chatView.classList.add("hidden");
  uploadView.classList.remove("hidden");
});

function appendBubble(role, content) {
  const empty = chatLog.querySelector(".chat-empty");
  if (empty) empty.remove();

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = content;
  chatLog.appendChild(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

async function handleSend() {
  const message = chatInput.value.trim();
  if (!message || !currentDocument) return;

  chatInput.value = "";
  appendBubble("user", message);

  sendBtn.disabled = true;
  const pending = appendBubble("assistant pending", "Thinking...");

  try {
    const { reply } = await chatWithDocument(currentDocument.id, message, history);
    pending.textContent = reply;
    pending.classList.remove("pending");
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });
  } catch (err) {
    pending.textContent = "Something went wrong getting a reply - try again.";
    pending.classList.remove("pending");
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

sendBtn.addEventListener("click", handleSend);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

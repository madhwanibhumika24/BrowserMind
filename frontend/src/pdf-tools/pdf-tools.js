import { BASE_URL } from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const modeTabs = document.querySelectorAll(".mode-tab");
const mergePanel = document.getElementById("merge-panel");
const splitPanel = document.getElementById("split-panel");
const ocrPanel = document.getElementById("ocr-panel");

let mergeFiles = [];

// ---- Merge ----

const mergeFileInput = document.getElementById("merge-file-input");
const mergeDropzoneText = document.getElementById("merge-dropzone-text");
const mergeFileList = document.getElementById("merge-file-list");
const mergeBtn = document.getElementById("merge-btn");
const mergeError = document.getElementById("merge-error");
const mergeDownload = document.getElementById("merge-download");

function renderMergeFileList() {
  if (!mergeFiles.length) {
    mergeFileList.innerHTML = "";
    mergeDropzoneText.textContent = "Click to choose 2+ PDFs";
    return;
  }

  mergeDropzoneText.textContent = `${mergeFiles.length} file${mergeFiles.length === 1 ? "" : "s"} selected`;
  mergeFileList.innerHTML = mergeFiles
    .map(
      (f, i) => `
      <div class="merge-file-item">
        <span>${i + 1}. ${escapeHtml(f.name)}</span>
        <button type="button" class="merge-file-remove" data-index="${i}" title="Remove">✕</button>
      </div>`
    )
    .join("");

  mergeFileList.querySelectorAll(".merge-file-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      mergeFiles.splice(Number(btn.dataset.index), 1);
      renderMergeFileList();
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

mergeFileInput.addEventListener("change", () => {
  mergeFiles = mergeFiles.concat(Array.from(mergeFileInput.files));
  mergeFileInput.value = ""; // allow re-adding the same file if removed
  renderMergeFileList();
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function parseErrorResponse(res) {
  try {
    const data = await res.json();
    return data.detail || `Request failed: ${res.status}`;
  } catch (err) {
    return `Request failed: ${res.status}`;
  }
}

mergeBtn.addEventListener("click", async () => {
  mergeError.classList.add("hidden");
  mergeDownload.classList.add("hidden");

  if (mergeFiles.length < 2) {
    mergeError.textContent = "Choose at least two PDFs to merge.";
    mergeError.classList.remove("hidden");
    return;
  }

  mergeBtn.disabled = true;
  mergeBtn.textContent = "Merging...";

  try {
    const body = new FormData();
    mergeFiles.forEach((f) => body.append("files", f));

    const res = await fetch(`${BASE_URL}/pdf-tools/merge`, { method: "POST", body });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const blob = await res.blob();
    triggerDownload(blob, "merged.pdf");
    mergeDownload.classList.remove("hidden");
  } catch (err) {
    mergeError.textContent = err.message || "Could not merge those files - try again.";
    mergeError.classList.remove("hidden");
  } finally {
    mergeBtn.disabled = false;
    resetMergeBtn();
  }
});

function resetMergeBtn() {
  mergeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Merge PDFs`;
}

mergeDownload.addEventListener("click", (e) => e.preventDefault()); // download already happened

// ---- Split ----

const splitFileInput = document.getElementById("split-file-input");
const splitDropzoneText = document.getElementById("split-dropzone-text");
const splitPagesInput = document.getElementById("split-pages");
const splitBtn = document.getElementById("split-btn");
const splitError = document.getElementById("split-error");
const splitDownload = document.getElementById("split-download");

splitFileInput.addEventListener("change", () => {
  splitDropzoneText.textContent = splitFileInput.files[0]?.name || "Click to choose a PDF";
});

splitBtn.addEventListener("click", async () => {
  splitError.classList.add("hidden");
  splitDownload.classList.add("hidden");

  const file = splitFileInput.files[0];
  const pages = splitPagesInput.value.trim();

  if (!file) {
    splitError.textContent = "Choose a PDF first.";
    splitError.classList.remove("hidden");
    return;
  }
  if (!pages) {
    splitError.textContent = "Enter which pages to extract (e.g. 1-3, 5).";
    splitError.classList.remove("hidden");
    return;
  }

  splitBtn.disabled = true;
  splitBtn.textContent = "Splitting...";

  try {
    const body = new FormData();
    body.append("file", file);
    body.append("pages", pages);

    const res = await fetch(`${BASE_URL}/pdf-tools/split`, { method: "POST", body });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const blob = await res.blob();
    triggerDownload(blob, "split.pdf");
    splitDownload.classList.remove("hidden");
  } catch (err) {
    splitError.textContent = err.message || "Could not split that file - try again.";
    splitError.classList.remove("hidden");
  } finally {
    splitBtn.disabled = false;
    resetSplitBtn();
  }
});

function resetSplitBtn() {
  splitBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Split PDF`;
}

splitDownload.addEventListener("click", (e) => e.preventDefault());

// ---- OCR ----

const ocrFileInput = document.getElementById("ocr-file-input");
const ocrDropzoneText = document.getElementById("ocr-dropzone-text");
const ocrBtn = document.getElementById("ocr-btn");
const ocrError = document.getElementById("ocr-error");
const ocrNote = document.getElementById("ocr-note");
const ocrResult = document.getElementById("ocr-result");
const ocrText = document.getElementById("ocr-text");
const ocrCopyBtn = document.getElementById("ocr-copy-btn");

ocrFileInput.addEventListener("change", () => {
  ocrDropzoneText.textContent = ocrFileInput.files[0]?.name || "Click to choose an image";
});

function resetOcrBtn() {
  ocrBtn.disabled = false;
  ocrBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Extract text`;
}

ocrBtn.addEventListener("click", async () => {
  ocrError.classList.add("hidden");
  ocrNote.classList.add("hidden");
  ocrResult.classList.add("hidden");

  const file = ocrFileInput.files[0];
  if (!file) {
    ocrError.textContent = "Choose an image first.";
    ocrError.classList.remove("hidden");
    return;
  }

  ocrBtn.disabled = true;
  ocrBtn.textContent = "Extracting...";

  try {
    const body = new FormData();
    body.append("file", file);

    const res = await fetch(`${BASE_URL}/ocr/extract`, { method: "POST", body });
    if (res.status === 503) {
      ocrNote.classList.remove("hidden");
      throw new Error(await parseErrorResponse(res));
    }
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const data = await res.json();
    ocrText.value = data.text;
    ocrResult.classList.remove("hidden");
  } catch (err) {
    ocrError.textContent = err.message || "Could not extract text from that image - try again.";
    ocrError.classList.remove("hidden");
  } finally {
    ocrBtn.disabled = false;
    resetOcrBtn();
  }
});

ocrCopyBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await navigator.clipboard.writeText(ocrText.value);
    ocrCopyBtn.textContent = "Copied";
    setTimeout(() => {
      ocrCopyBtn.textContent = "Copy text";
    }, 1500);
  } catch (err) {
    ocrText.select();
  }
});

// ---- Tabs ----

const panelsByMode = { merge: mergePanel, split: splitPanel, ocr: ocrPanel };

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    modeTabs.forEach((t) => t.classList.toggle("active", t === tab));
    Object.entries(panelsByMode).forEach(([m, panel]) => {
      panel.classList.toggle("hidden", m !== mode);
    });
  });
});

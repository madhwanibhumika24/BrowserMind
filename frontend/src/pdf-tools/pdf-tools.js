import { BASE_URL } from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const modeTabs = document.querySelectorAll(".mode-tab");
const mergePanel = document.getElementById("merge-panel");
const splitPanel = document.getElementById("split-panel");
const protectPanel = document.getElementById("protect-panel");
const watermarkPanel = document.getElementById("watermark-panel");
const compressPanel = document.getElementById("compress-panel");
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

// ---- Protect ----

const protectFileInput = document.getElementById("protect-file-input");
const protectDropzoneText = document.getElementById("protect-dropzone-text");
const protectPasswordInput = document.getElementById("protect-password");
const protectBtn = document.getElementById("protect-btn");
const protectError = document.getElementById("protect-error");
const protectDownload = document.getElementById("protect-download");

protectFileInput.addEventListener("change", () => {
  protectDropzoneText.textContent = protectFileInput.files[0]?.name || "Click to choose a PDF";
});

function resetProtectBtn() {
  protectBtn.disabled = false;
  protectBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Protect PDF`;
}

protectBtn.addEventListener("click", async () => {
  protectError.classList.add("hidden");
  protectDownload.classList.add("hidden");

  const file = protectFileInput.files[0];
  const password = protectPasswordInput.value;

  if (!file) {
    protectError.textContent = "Choose a PDF first.";
    protectError.classList.remove("hidden");
    return;
  }
  if (!password) {
    protectError.textContent = "Enter a password.";
    protectError.classList.remove("hidden");
    return;
  }

  protectBtn.disabled = true;
  protectBtn.textContent = "Protecting...";

  try {
    const body = new FormData();
    body.append("file", file);
    body.append("password", password);

    const res = await fetch(`${BASE_URL}/pdf-tools/protect`, { method: "POST", body });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const blob = await res.blob();
    triggerDownload(blob, "protected.pdf");
    protectDownload.classList.remove("hidden");
  } catch (err) {
    protectError.textContent = err.message || "Could not protect that file - try again.";
    protectError.classList.remove("hidden");
  } finally {
    resetProtectBtn();
  }
});

protectDownload.addEventListener("click", (e) => e.preventDefault());

// ---- Watermark ----

const watermarkFileInput = document.getElementById("watermark-file-input");
const watermarkDropzoneText = document.getElementById("watermark-dropzone-text");
const watermarkTextInput = document.getElementById("watermark-text");
const watermarkBtn = document.getElementById("watermark-btn");
const watermarkError = document.getElementById("watermark-error");
const watermarkDownload = document.getElementById("watermark-download");

watermarkFileInput.addEventListener("change", () => {
  watermarkDropzoneText.textContent = watermarkFileInput.files[0]?.name || "Click to choose a PDF";
});

function resetWatermarkBtn() {
  watermarkBtn.disabled = false;
  watermarkBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
    Add watermark`;
}

watermarkBtn.addEventListener("click", async () => {
  watermarkError.classList.add("hidden");
  watermarkDownload.classList.add("hidden");

  const file = watermarkFileInput.files[0];
  const text = watermarkTextInput.value.trim();

  if (!file) {
    watermarkError.textContent = "Choose a PDF first.";
    watermarkError.classList.remove("hidden");
    return;
  }
  if (!text) {
    watermarkError.textContent = "Enter watermark text.";
    watermarkError.classList.remove("hidden");
    return;
  }

  watermarkBtn.disabled = true;
  watermarkBtn.textContent = "Adding watermark...";

  try {
    const body = new FormData();
    body.append("file", file);
    body.append("text", text);

    const res = await fetch(`${BASE_URL}/pdf-tools/watermark`, { method: "POST", body });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const blob = await res.blob();
    triggerDownload(blob, "watermarked.pdf");
    watermarkDownload.classList.remove("hidden");
  } catch (err) {
    watermarkError.textContent = err.message || "Could not watermark that file - try again.";
    watermarkError.classList.remove("hidden");
  } finally {
    resetWatermarkBtn();
  }
});

watermarkDownload.addEventListener("click", (e) => e.preventDefault());

// ---- Compress ----

const compressFileInput = document.getElementById("compress-file-input");
const compressDropzoneText = document.getElementById("compress-dropzone-text");
const compressQualityOpts = document.querySelectorAll(".quality-opt");
const compressBtn = document.getElementById("compress-btn");
const compressError = document.getElementById("compress-error");
const compressResult = document.getElementById("compress-result");
const compressDownload = document.getElementById("compress-download");

let compressQuality = "medium";

compressFileInput.addEventListener("change", () => {
  compressDropzoneText.textContent = compressFileInput.files[0]?.name || "Click to choose a PDF";
});

compressQualityOpts.forEach((opt) => {
  opt.addEventListener("click", () => {
    compressQuality = opt.dataset.quality;
    compressQualityOpts.forEach((o) => o.classList.toggle("active", o === opt));
  });
});

function resetCompressBtn() {
  compressBtn.disabled = false;
  compressBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    Compress PDF`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

compressBtn.addEventListener("click", async () => {
  compressError.classList.add("hidden");
  compressResult.classList.add("hidden");
  compressDownload.classList.add("hidden");

  const file = compressFileInput.files[0];
  if (!file) {
    compressError.textContent = "Choose a PDF first.";
    compressError.classList.remove("hidden");
    return;
  }

  compressBtn.disabled = true;
  compressBtn.textContent = "Compressing...";

  try {
    const body = new FormData();
    body.append("file", file);
    body.append("quality", compressQuality);

    const res = await fetch(`${BASE_URL}/pdf-tools/compress`, { method: "POST", body });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const blob = await res.blob();
    triggerDownload(blob, "compressed.pdf");

    const saved = file.size > 0 ? Math.round((1 - blob.size / file.size) * 100) : 0;
    compressResult.textContent =
      saved > 0
        ? `${formatBytes(file.size)} → ${formatBytes(blob.size)} (${saved}% smaller)`
        : `${formatBytes(file.size)} → ${formatBytes(blob.size)} (already well compressed)`;
    compressResult.classList.remove("hidden");
    compressDownload.classList.remove("hidden");
  } catch (err) {
    compressError.textContent = err.message || "Could not compress that file - try again.";
    compressError.classList.remove("hidden");
  } finally {
    resetCompressBtn();
  }
});

compressDownload.addEventListener("click", (e) => e.preventDefault());

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

const panelsByMode = {
  merge: mergePanel,
  split: splitPanel,
  protect: protectPanel,
  watermark: watermarkPanel,
  compress: compressPanel,
  ocr: ocrPanel,
};

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    modeTabs.forEach((t) => t.classList.toggle("active", t === tab));
    Object.entries(panelsByMode).forEach(([m, panel]) => {
      panel.classList.toggle("hidden", m !== mode);
    });
  });
});

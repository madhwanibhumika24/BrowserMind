import {
  generateForm,
  generateFormFromDocument,
  getFormResults,
  listMyForms,
} from "../utils/api.js";
import { createGoogleForm } from "../utils/googleForms.js";
import { saveGoogleFormRecord, getGoogleFormRecord } from "../utils/googleFormsStore.js";
import { exportResponsesToSheet } from "../utils/googleSheets.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const descriptionInput = document.getElementById("form-description");
const descriptionLabel = document.getElementById("description-label");
const charCounter = document.getElementById("char-counter");
const fieldMeta = document.querySelector(".field-meta");
const qtyAutoBtn = document.getElementById("qty-auto-btn");
const qtyMinusBtn = document.getElementById("qty-minus-btn");
const qtyPlusBtn = document.getElementById("qty-plus-btn");
const questionCountInput = document.getElementById("question-count-input");
const qtyStepper = document.querySelector(".qty-stepper");
const modeTabsContainer = document.querySelector(".mode-tabs");
const modeTabs = document.querySelectorAll(".mode-tab");
const textInputBlock = document.getElementById("text-input-block");
const documentInputBlock = document.getElementById("document-input-block");
const fileInput = document.getElementById("form-file");
const dropzoneText = document.getElementById("dropzone-text");
const kindOpts = document.querySelectorAll(".kind-opt");

const MODE_META = {
  quiz: {
    label: "What should this quiz test?",
    placeholder: "e.g. 20 questions on Java fundamentals - variables, loops, OOP, exceptions",
  },
  survey: {
    label: "What's this survey for?",
    placeholder: "e.g. Feedback survey for my study group's weekly session",
  },
};

let mode = "quiz"; // "quiz" | "survey" | "document"
let docKind = "quiz"; // only used when mode === "document"
let currentFormId = null;

const QTY_MIN = 1;
const QTY_MAX = 25;
let questionCountIsAuto = true;

const generateBtn = document.getElementById("generate-btn");
const generateError = document.getElementById("generate-error");
const generateCard = document.getElementById("generate-card");
const examplesSection = document.getElementById("examples-section");
const examplesLabel = document.querySelector(".examples-label");
const exampleChips = document.querySelectorAll(".example-chip");

const resultCard = document.getElementById("result-card");
const resultBackBtn = document.getElementById("result-back-btn");
const resultTitle = document.getElementById("result-title");
const resultDesc = document.getElementById("result-desc");
const newFormBtn = document.getElementById("new-form-btn");

const createGformBtn = document.getElementById("create-gform-btn");
const gformLoading = document.getElementById("gform-loading");
const gformResult = document.getElementById("gform-result");
const gformLinkInput = document.getElementById("gform-link");
const gformCopyBtn = document.getElementById("gform-copy-btn");
const gformOpenBtn = document.getElementById("gform-open-btn");
const gformResultsBtn = document.getElementById("gform-results-btn");
const exportSheetsBtn = document.getElementById("export-sheets-btn");
const exportSheetsLabel = document.getElementById("export-sheets-label");
const sheetsError = document.getElementById("sheets-error");
const sheetsSuccess = document.getElementById("sheets-success");
const sheetsOpenLink = document.getElementById("sheets-open-link");
const gformError = document.getElementById("gform-error");
const gformErrorText = document.getElementById("gform-error-text");
const gformRetryBtn = document.getElementById("gform-retry-btn");
const closeTabBtn = document.getElementById("close-tab-btn");

// The full form (title/description/kind/questions incl. correct answers) -
// kept in memory so "Create as Google Form" has everything it needs
// without another round trip. Set whenever the result view is populated,
// either right after generating or when reopening from My Forms.
let currentForm = null;

const myFormsNavBtn = document.getElementById("my-forms-nav-btn");
const myFormsView = document.getElementById("my-forms-view");
const myFormsList = document.getElementById("my-forms-list");
const myFormsNewBtn = document.getElementById("my-forms-new-btn");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---- View switching (generate / result / my-forms list) ----

function showView(view) {
  modeTabsContainer.classList.toggle("hidden", view !== "generate");
  generateCard.classList.toggle("hidden", view !== "generate");
  resultCard.classList.toggle("hidden", view !== "result");
  myFormsView.classList.toggle("hidden", view !== "list");

  if (view === "generate") {
    updateExamples(mode);
  } else {
    examplesSection.classList.add("hidden");
  }
}

function resetToGenerate() {
  currentFormId = null;
  currentForm = null;
  resetGformResult();
  descriptionInput.value = "";
  updateCharCounter();
  showView("generate");
}

// ---- Number-of-questions stepper (Auto, or a direct 1-25 value) ----

function setQtyAuto(isAuto) {
  // Deliberately NOT using the real `disabled` attribute here - a disabled
  // button/input can't be clicked or focused at all, which would trap the
  // user in Auto mode with no way to switch out of it. This is a purely
  // visual dim via CSS; the controls stay fully interactive underneath.
  questionCountIsAuto = isAuto;
  qtyAutoBtn.classList.toggle("active", isAuto);
  qtyStepper.classList.toggle("dimmed", isAuto);
}

function clampQty(value) {
  return Math.min(QTY_MAX, Math.max(QTY_MIN, value || QTY_MIN));
}

function getQuestionCount() {
  return questionCountIsAuto ? null : clampQty(parseInt(questionCountInput.value, 10));
}

qtyAutoBtn.addEventListener("click", () => setQtyAuto(true));

qtyMinusBtn.addEventListener("click", () => {
  setQtyAuto(false);
  questionCountInput.value = clampQty(parseInt(questionCountInput.value, 10) - 1);
});

qtyPlusBtn.addEventListener("click", () => {
  setQtyAuto(false);
  questionCountInput.value = clampQty(parseInt(questionCountInput.value, 10) + 1);
});

questionCountInput.addEventListener("focus", () => setQtyAuto(false));
questionCountInput.addEventListener("input", () => setQtyAuto(false));
questionCountInput.addEventListener("blur", () => {
  questionCountInput.value = clampQty(parseInt(questionCountInput.value, 10));
});

// ---- Character counter on the description textarea ----

function updateCharCounter() {
  const length = descriptionInput.value.length;
  const max = descriptionInput.maxLength;
  charCounter.textContent = `${length} / ${max}`;
  fieldMeta.classList.toggle("warn", length >= max * 0.95);
}

descriptionInput.addEventListener("input", updateCharCounter);

// ---- Generate flow ----

async function handleGenerate() {
  generateError.classList.add("hidden");
  const questionCount = getQuestionCount();

  if (mode === "document") {
    const file = fileInput.files[0];
    if (!file) {
      generateError.textContent = "Choose a PDF, Word, or PowerPoint file first.";
      generateError.classList.remove("hidden");
      return;
    }

    setGenerateBtnLoading(true);
    try {
      const form = await generateFormFromDocument(file, questionCount, docKind);
      showResult(form);
    } catch (err) {
      generateError.textContent = "Could not generate a form from that file - try again.";
      generateError.classList.remove("hidden");
    } finally {
      setGenerateBtnLoading(false);
    }
    return;
  }

  const description = descriptionInput.value.trim();
  if (!description) {
    generateError.textContent = "Describe what the form is for first.";
    generateError.classList.remove("hidden");
    return;
  }

  setGenerateBtnLoading(true);

  try {
    const form = await generateForm(description, questionCount, mode);
    showResult(form);
  } catch (err) {
    generateError.textContent = "Could not generate a form right now - try again.";
    generateError.classList.remove("hidden");
  } finally {
    setGenerateBtnLoading(false);
  }
}

const generateBtnLabel = generateBtn.querySelector(".btn-label");

function setGenerateBtnLoading(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.classList.toggle("loading", isLoading);
  generateBtnLabel.textContent = isLoading ? "Generating..." : "Generate form";
}

function setMode(newMode) {
  mode = newMode;
  modeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === newMode));
  textInputBlock.classList.toggle("hidden", newMode === "document");
  documentInputBlock.classList.toggle("hidden", newMode !== "document");

  const meta = MODE_META[newMode];
  if (meta) {
    descriptionLabel.textContent = meta.label;
    descriptionInput.placeholder = meta.placeholder;
  }

  updateExamples(newMode);
}

function updateExamples(newMode) {
  // Document mode has no text description to fill in, so the examples
  // (which only make sense for typed descriptions) are hidden there.
  examplesSection.classList.toggle("hidden", newMode === "document");
  if (newMode === "document") return;

  let visibleCount = 0;
  exampleChips.forEach((chip) => {
    const matches = chip.dataset.mode === newMode;
    chip.classList.toggle("hidden", !matches);
    if (matches) visibleCount += 1;
  });
  examplesLabel.textContent = visibleCount ? "Try an example" : "Examples";
}

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

kindOpts.forEach((opt) => {
  opt.addEventListener("click", () => {
    docKind = opt.dataset.kind;
    kindOpts.forEach((o) => o.classList.toggle("active", o === opt));
  });
});

fileInput.addEventListener("change", () => {
  dropzoneText.textContent = fileInput.files[0]?.name || "Click to upload";
});

exampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.dataset.mode) setMode(chip.dataset.mode);
    descriptionInput.value = chip.dataset.desc;
    updateCharCounter();
    descriptionInput.focus();
  });
});

generateBtn.addEventListener("click", handleGenerate);

// ---- Result view (freshly generated form, or opened from My Forms) ----

function showResult(form) {
  currentFormId = form.id;
  currentForm = form;
  showView("result");

  resultTitle.textContent = form.title;
  resultDesc.textContent = form.description;

  // Freshly generated - go straight to creating the Google Form, no extra
  // click needed.
  loadGformForCurrentFormId({ autoCreateIfMissing: true });
}

async function loadFormResults() {
  if (!currentFormId) return;

  try {
    const { form } = await getFormResults(currentFormId);
    currentForm = form;
    resultTitle.textContent = form.title;
    resultDesc.textContent = form.description;
  } catch (err) {
    resultTitle.textContent = "Could not load this form";
    resultDesc.textContent = "";
  }
}

async function openFormResults(formId) {
  currentFormId = formId;
  currentForm = null;
  showView("result");
  resultTitle.textContent = "Loading...";
  resultDesc.textContent = "";
  resetGformResult();
  await loadFormResults();
  // Reopening an older form - if we already created a Google Form for it
  // before, show that straight away instead of offering to create another.
  loadGformForCurrentFormId({ autoCreateIfMissing: false });
}

// ---- Create as Google Form (real form in the user's own Google Drive) ----
// Auto-created right after generating (see showResult). Once created, the
// {formId, responderUri, editUri} is saved to chrome.storage.local keyed by
// BrowserMind's own form id (googleFormsStore.js) - the backend never learns
// about it, so without this, reopening a form from My Forms would have no
// way to know a Google Form already exists for it and "Create Google Form"
// would silently spawn a duplicate every time it's clicked.

function setGformState(state) {
  // "manual" | "loading" | "result" | "error"
  createGformBtn.classList.toggle("hidden", state !== "manual");
  gformLoading.classList.toggle("hidden", state !== "loading");
  gformResult.classList.toggle("hidden", state !== "result");
  gformError.classList.toggle("hidden", state !== "error");
}

// The currently-displayed Google Form record (formId/responderUri/editUri) -
// kept so "Export responses to Sheets" knows which form to pull from.
let currentGformRecord = null;

function resetGformResult() {
  setGformState("manual");
  gformLinkInput.value = "";
  gformOpenBtn.href = "#";
  gformResultsBtn.href = "#";
  currentGformRecord = null;
  resetSheetsExport();
}

function applyGformRecord(record) {
  gformLinkInput.value = record.responderUri;
  gformOpenBtn.href = record.responderUri;
  gformResultsBtn.href = `https://docs.google.com/forms/d/${record.formId}/edit#responses`;
  currentGformRecord = record;
  resetSheetsExport();
  setGformState("result");
}

async function loadGformForCurrentFormId({ autoCreateIfMissing }) {
  const saved = await getGoogleFormRecord(currentFormId);
  if (saved) {
    applyGformRecord(saved);
  } else if (autoCreateIfMissing) {
    await createGoogleFormForCurrent();
  } else {
    resetGformResult();
  }
}

async function createGoogleFormForCurrent() {
  if (!currentForm) return;
  setGformState("loading");

  try {
    const record = await createGoogleForm(currentForm);
    await saveGoogleFormRecord(currentFormId, record);
    applyGformRecord(record);
  } catch (err) {
    gformErrorText.textContent = err.message || "Could not create the Google Form - try again.";
    setGformState("error");
  }
}

createGformBtn.addEventListener("click", createGoogleFormForCurrent);
gformRetryBtn.addEventListener("click", createGoogleFormForCurrent);

// ---- Export responses to Google Sheets (snapshot, not a live link - see
// utils/googleSheets.js for why) ----

function resetSheetsExport() {
  sheetsError.classList.add("hidden");
  sheetsSuccess.classList.add("hidden");
  sheetsOpenLink.href = "#";
  exportSheetsBtn.disabled = false;
  exportSheetsLabel.textContent = "Export responses to Sheets";
}

exportSheetsBtn.addEventListener("click", async () => {
  if (!currentGformRecord) return;

  sheetsError.classList.add("hidden");
  sheetsSuccess.classList.add("hidden");
  exportSheetsBtn.disabled = true;
  exportSheetsLabel.textContent = "Exporting...";

  try {
    const { spreadsheetUrl, responseCount } = await exportResponsesToSheet(
      currentGformRecord.formId,
      resultTitle.textContent
    );
    sheetsOpenLink.href = spreadsheetUrl;
    sheetsOpenLink.textContent = `Open spreadsheet (${responseCount} response${responseCount === 1 ? "" : "s"})`;
    sheetsSuccess.classList.remove("hidden");
  } catch (err) {
    sheetsError.textContent = err.message || "Could not export responses - try again.";
    sheetsError.classList.remove("hidden");
  } finally {
    exportSheetsBtn.disabled = false;
    exportSheetsLabel.textContent = "Export responses to Sheets";
  }
});

gformCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(gformLinkInput.value);
    gformCopyBtn.textContent = "Copied";
    gformCopyBtn.classList.add("copied");
    setTimeout(() => {
      gformCopyBtn.textContent = "Copy";
      gformCopyBtn.classList.remove("copied");
    }, 1500);
  } catch (err) {
    gformLinkInput.select();
  }
});

newFormBtn.addEventListener("click", resetToGenerate);
closeTabBtn.addEventListener("click", () => window.close());
resultBackBtn.addEventListener("click", () => {
  showView("list");
  loadMyForms();
});

// ---- My Forms list ----

function renderMyForms(forms) {
  if (!forms.length) {
    myFormsList.innerHTML = `<p class="response-empty">You haven't created any forms yet - generate one to get started.</p>`;
    return;
  }

  myFormsList.innerHTML = forms
    .map(
      (f) => `
      <div class="my-form-card">
        <div class="my-form-info">
          <span class="my-form-kind-badge kind-${f.kind}">${f.kind === "quiz" ? "Quiz" : "Survey"}</span>
          <h3>${escapeHtml(f.title)}</h3>
          <p class="my-form-meta">Created ${formatDate(f.created_at)}</p>
        </div>
        <div class="my-form-actions">
          <button class="my-form-open-btn" data-id="${f.id}">Open</button>
        </div>
      </div>`
    )
    .join("");

  myFormsList.querySelectorAll(".my-form-open-btn").forEach((btn) => {
    btn.addEventListener("click", () => openFormResults(btn.dataset.id));
  });
}

async function loadMyForms() {
  myFormsList.innerHTML = `<p class="response-empty">Loading...</p>`;
  try {
    const forms = await listMyForms();
    renderMyForms(forms);
  } catch (err) {
    myFormsList.innerHTML = `<p class="response-empty">Could not load your forms right now.</p>`;
  }
}

myFormsNavBtn.addEventListener("click", () => {
  showView("list");
  loadMyForms();
});

myFormsNewBtn.addEventListener("click", resetToGenerate);

// Sync labels/placeholder/examples with the default active tab on load.
updateExamples(mode);
setQtyAuto(true);
updateCharCounter();

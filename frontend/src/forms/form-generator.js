import {
  generateForm,
  generateFormFromDocument,
  getFormResults,
  formShareLink,
} from "../utils/api.js";

const descriptionInput = document.getElementById("form-description");
const descriptionLabel = document.getElementById("description-label");
const questionCountSelect = document.getElementById("question-count");
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
const generateBtn = document.getElementById("generate-btn");
const generateError = document.getElementById("generate-error");
const generateCard = document.getElementById("generate-card");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultDesc = document.getElementById("result-desc");
const shareLinkInput = document.getElementById("share-link");
const copyLinkBtn = document.getElementById("copy-link-btn");
const openLinkBtn = document.getElementById("open-link-btn");
const responseCount = document.getElementById("response-count");
const responsesList = document.getElementById("responses-list");
const refreshResponsesBtn = document.getElementById("refresh-responses-btn");
const newFormBtn = document.getElementById("new-form-btn");
const examplesSection = document.getElementById("examples-section");
const examplesLabel = document.querySelector(".examples-label");
const exampleChips = document.querySelectorAll(".example-chip");

let currentFormId = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function handleGenerate() {
  generateError.classList.add("hidden");
  const questionCount = parseInt(questionCountSelect.value, 10) || null;

  if (mode === "document") {
    const file = fileInput.files[0];
    if (!file) {
      generateError.textContent = "Choose a PDF or Word file first.";
      generateError.classList.remove("hidden");
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
    try {
      const form = await generateFormFromDocument(file, questionCount, docKind);
      currentFormId = form.id;
      showResult(form);
    } catch (err) {
      generateError.textContent = "Could not generate a form from that file - try again.";
      generateError.classList.remove("hidden");
    } finally {
      resetGenerateBtn();
    }
    return;
  }

  const description = descriptionInput.value.trim();
  if (!description) {
    generateError.textContent = "Describe what the form is for first.";
    generateError.classList.remove("hidden");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const form = await generateForm(description, questionCount, mode);
    currentFormId = form.id;
    showResult(form);
  } catch (err) {
    generateError.textContent = "Could not generate a form right now - try again.";
    generateError.classList.remove("hidden");
  } finally {
    resetGenerateBtn();
  }
}

function resetGenerateBtn() {
  generateBtn.disabled = false;
  generateBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Generate form`;
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

function showResult(form) {
  generateCard.classList.add("hidden");
  examplesSection.classList.add("hidden");
  resultCard.classList.remove("hidden");

  resultTitle.textContent = form.title;
  resultDesc.textContent = form.description;

  const link = formShareLink(form.id);
  shareLinkInput.value = link;
  openLinkBtn.href = link;

  responseCount.textContent = "0";
  responsesList.innerHTML = `<p class="response-empty">No responses yet - share the link above.</p>`;
}

async function refreshResponses() {
  if (!currentFormId) return;
  responsesList.innerHTML = `<p class="response-empty">Loading...</p>`;

  try {
    const { form, responses } = await getFormResults(currentFormId);
    responseCount.textContent = String(responses.length);

    if (!responses.length) {
      responsesList.innerHTML = `<p class="response-empty">No responses yet - share the link above.</p>`;
      return;
    }

    responsesList.innerHTML = responses
      .map((r, i) => {
        const answerLines = form.questions
          .map((q, qi) => `<strong>${escapeHtml(q.question)}</strong>: ${escapeHtml(r.answers[qi] ?? "-")}`)
          .join("<br>");
        return `<div class="response-item">Response ${i + 1}<br>${answerLines}</div>`;
      })
      .join("");
  } catch (err) {
    responsesList.innerHTML = `<p class="response-empty">Could not load responses right now.</p>`;
  }
}

copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyLinkBtn.textContent = "Copied";
    copyLinkBtn.classList.add("copied");
    setTimeout(() => {
      copyLinkBtn.textContent = "Copy";
      copyLinkBtn.classList.remove("copied");
    }, 1500);
  } catch (err) {
    shareLinkInput.select();
  }
});

refreshResponsesBtn.addEventListener("click", refreshResponses);

newFormBtn.addEventListener("click", () => {
  currentFormId = null;
  descriptionInput.value = "";
  resultCard.classList.add("hidden");
  generateCard.classList.remove("hidden");
  updateExamples(mode);
});

exampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.dataset.mode) setMode(chip.dataset.mode);
    descriptionInput.value = chip.dataset.desc;
    descriptionInput.focus();
  });
});

generateBtn.addEventListener("click", handleGenerate);

// Sync labels/placeholder/examples with the default active tab on load.
updateExamples(mode);

import { BASE_URL } from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const modeTabs = document.querySelectorAll(".mode-tab");
const grammarPanel = document.getElementById("grammar-panel");
const translatePanel = document.getElementById("translate-panel");

async function parseErrorResponse(res) {
  try {
    const data = await res.json();
    return data.detail || `Request failed: ${res.status}`;
  } catch (err) {
    return `Request failed: ${res.status}`;
  }
}

function wireCopyButton(btn, sourceTextarea) {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(sourceTextarea.value);
      const original = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    } catch (err) {
      sourceTextarea.select();
    }
  });
}

// ---- Grammar Checker ----

const grammarInput = document.getElementById("grammar-input");
const grammarBtn = document.getElementById("grammar-btn");
const grammarError = document.getElementById("grammar-error");
const grammarResult = document.getElementById("grammar-result");
const grammarOutput = document.getElementById("grammar-output");
const grammarCopyBtn = document.getElementById("grammar-copy-btn");

function resetGrammarBtn() {
  grammarBtn.disabled = false;
  grammarBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Check grammar`;
}

grammarBtn.addEventListener("click", async () => {
  grammarError.classList.add("hidden");
  grammarResult.classList.add("hidden");

  const text = grammarInput.value.trim();
  if (!text) {
    grammarError.textContent = "Paste or type some text first.";
    grammarError.classList.remove("hidden");
    return;
  }

  grammarBtn.disabled = true;
  grammarBtn.textContent = "Checking...";

  try {
    const res = await fetch(`${BASE_URL}/text-tools/grammar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const data = await res.json();
    grammarOutput.value = data.corrected;
    grammarResult.classList.remove("hidden");
  } catch (err) {
    grammarError.textContent = err.message || "Could not check that text - try again.";
    grammarError.classList.remove("hidden");
  } finally {
    grammarBtn.disabled = false;
    resetGrammarBtn();
  }
});

wireCopyButton(grammarCopyBtn, grammarOutput);

// ---- Translate ----

const translateInput = document.getElementById("translate-input");
const translateLanguage = document.getElementById("translate-language");
const translateBtn = document.getElementById("translate-btn");
const translateError = document.getElementById("translate-error");
const translateResult = document.getElementById("translate-result");
const translateOutput = document.getElementById("translate-output");
const translateCopyBtn = document.getElementById("translate-copy-btn");

function resetTranslateBtn() {
  translateBtn.disabled = false;
  translateBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.4L12 2z"/></svg>
    Translate`;
}

translateBtn.addEventListener("click", async () => {
  translateError.classList.add("hidden");
  translateResult.classList.add("hidden");

  const text = translateInput.value.trim();
  if (!text) {
    translateError.textContent = "Paste or type some text first.";
    translateError.classList.remove("hidden");
    return;
  }

  translateBtn.disabled = true;
  translateBtn.textContent = "Translating...";

  try {
    const res = await fetch(`${BASE_URL}/text-tools/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target_language: translateLanguage.value }),
    });
    if (!res.ok) throw new Error(await parseErrorResponse(res));

    const data = await res.json();
    translateOutput.value = data.translated;
    translateResult.classList.remove("hidden");
  } catch (err) {
    translateError.textContent = err.message || "Could not translate that text - try again.";
    translateError.classList.remove("hidden");
  } finally {
    translateBtn.disabled = false;
    resetTranslateBtn();
  }
});

wireCopyButton(translateCopyBtn, translateOutput);

// ---- Tabs ----

const panelsByMode = { grammar: grammarPanel, translate: translatePanel };

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    modeTabs.forEach((t) => t.classList.toggle("active", t === tab));
    Object.entries(panelsByMode).forEach(([m, panel]) => {
      panel.classList.toggle("hidden", m !== mode);
    });
  });
});

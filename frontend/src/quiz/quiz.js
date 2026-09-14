import { generateQuiz } from "../utils/api.js";
import { applyStoredTheme } from "../utils/theme.js";

applyStoredTheme();

const content = document.getElementById("quiz-content");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderQuestion(items, category, index, score) {
  if (index >= items.length) {
    const pct = items.length ? Math.round((score / items.length) * 100) : 0;
    content.innerHTML = `
      <div class="quiz-done">
        <div class="quiz-score-ring" style="--pct:${pct}"><span>${pct}%</span></div>
        <h2>Quiz complete!</h2>
        <p>You scored ${score} / ${items.length} on this ${escapeHtml(category)} page.</p>
        <button id="retry-btn">Close this tab</button>
      </div>`;
    document.getElementById("retry-btn").addEventListener("click", () => window.close());
    return;
  }

  const item = items[index];
  const progressPct = Math.round((index / items.length) * 100);
  content.innerHTML = `
    <div class="quiz-progress-row">
      <span class="quiz-category-chip">${escapeHtml(category)}</span>
      <span class="quiz-progress-text">Question ${index + 1} of ${items.length}</span>
    </div>
    <div class="quiz-progress-track"><div class="quiz-progress-fill" style="width:${progressPct}%"></div></div>
    <p class="quiz-question">${escapeHtml(item.question)}</p>
    <div class="quiz-options"></div>`;

  const optionsEl = content.querySelector(".quiz-options");
  item.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = option;
    btn.addEventListener("click", () => {
      const isCorrect = option === item.answer;
      optionsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
      btn.classList.add(isCorrect ? "quiz-correct" : "quiz-wrong");

      const nextBtn = document.createElement("button");
      nextBtn.id = "next-btn";
      nextBtn.textContent = index + 1 < items.length ? "Next question" : "See results";
      nextBtn.addEventListener("click", () => {
        renderQuestion(items, category, index + 1, score + (isCorrect ? 1 : 0));
      });
      content.appendChild(nextBtn);
    });
    optionsEl.appendChild(btn);
  });
}

async function start() {
  const { browsermindQuizTab } = await chrome.storage.local.get("browsermindQuizTab");

  if (!browsermindQuizTab) {
    content.innerHTML = `<p class="quiz-error">No page data found. Open this from the BrowserMind sidebar.</p>`;
    return;
  }

  try {
    const { category, items } = await generateQuiz(browsermindQuizTab);
    renderQuestion(items, category, 0, 0);
  } catch (err) {
    content.innerHTML = `<p class="quiz-error">Could not generate a quiz for this page.</p>`;
  }
}

start();

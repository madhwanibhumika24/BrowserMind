import { generateQuiz } from "../utils/api.js";

const content = document.getElementById("quiz-content");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderQuestion(items, category, index, score) {
  if (index >= items.length) {
    content.innerHTML = `
      <div class="quiz-done">
        <h2>Quiz complete!</h2>
        <p>You scored ${score} / ${items.length} on this ${category} page.</p>
        <button id="retry-btn">Take another look at this page</button>
      </div>`;
    document.getElementById("retry-btn").addEventListener("click", () => window.close());
    return;
  }

  const item = items[index];
  content.innerHTML = `
    <p class="quiz-progress">Question ${index + 1} of ${items.length} - ${category}</p>
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
    content.innerHTML = "<p>No page data found. Open this from the BrowserMind sidebar.</p>";
    return;
  }

  try {
    const { category, items } = await generateQuiz(browsermindQuizTab);
    renderQuestion(items, category, 0, 0);
  } catch (err) {
    content.innerHTML = "<p>Could not generate a quiz for this page.</p>";
  }
}

start();
